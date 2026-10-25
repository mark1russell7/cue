// The tests of src/generate.ts (built in dist/) and of the CUE files of the features.
// Start them with "pnpm test" after "pnpm build". The CUE tests need the cue CLI, and they skip without it.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { linkCuePackage, mergePackageJson } from '../dist/generate.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('mergePackageJson', () => {
  it('keeps the type of an existing package, and gives the generated type to a new package', () => {
    const generated = { name: 'x', type: 'commonjs', main: './dist/index.js' };
    assert.equal(mergePackageJson(generated, { name: 'a', type: 'module' }).type, 'module');
    assert.equal(mergePackageJson(generated, { name: 'a' }).type, 'commonjs');
    assert.equal(mergePackageJson(generated, null).type, 'commonjs');
  });

  it('keeps the entry points, merges the scripts and puts $schema first', () => {
    const merged = mergePackageJson(
      { name: 'x', main: './dist/index.js', scripts: { build: 'tsc -b', test: 'vitest' }, engines: { node: '>=22' } },
      { name: 'a', main: './lib/a.js', scripts: { test: 'node --test' }, engines: { node: '>=18' } },
    );
    assert.deepEqual(Object.keys(merged)[0], '$schema');
    assert.equal(merged.name, 'a');
    assert.equal(merged.main, './lib/a.js');
    assert.deepEqual(merged.scripts, { build: 'tsc -b', test: 'node --test' });
    assert.deepEqual(merged.engines, { node: '>=22' });
  });
});

describe('linkCuePackage', () => {
  /** A new temporary folder with two package versions, "v1" and "v2", and the path of the link. */
  function setup() {
    const dir = mkdtempSync(join(tmpdir(), 'cue-link-'));
    for (const version of ['v1', 'v2']) {
      for (const sub of ['ts', 'npm', 'git']) mkdirSync(join(dir, version, sub), { recursive: true });
      writeFileSync(join(dir, version, 'npm', 'version.txt'), version);
    }
    return { dir, link: join(dir, 'project', 'cue.mod', 'pkg', 'mark1russell7.cue') };
  }

  it('makes a link to the package', () => {
    const { dir, link } = setup();
    try {
      linkCuePackage(link, join(dir, 'v1'));
      assert.equal(realpathSync(link), realpathSync(join(dir, 'v1')));
      // A second run keeps the link
      linkCuePackage(link, join(dir, 'v1'));
      assert.equal(realpathSync(link), realpathSync(join(dir, 'v1')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('replaces a link to an old version of the package', () => {
    const { dir, link } = setup();
    try {
      linkCuePackage(link, join(dir, 'v1'));
      linkCuePackage(link, join(dir, 'v2'));
      assert.equal(realpathSync(link), realpathSync(join(dir, 'v2')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('replaces a link to a folder that does not exist', () => {
    const { dir, link } = setup();
    try {
      linkCuePackage(link, join(dir, 'v1'));
      // pnpm removes the folder of the old version
      rmSync(join(dir, 'v1'), { recursive: true, force: true });
      linkCuePackage(link, join(dir, 'v2'));
      assert.equal(realpathSync(link), realpathSync(join(dir, 'v2')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

const hasCue = spawnSync('cue', ['version'], { stdio: 'ignore' }).status === 0;

describe('the CUE files of the features', { skip: hasCue ? false : 'the cue CLI is not installed' }, () => {
  /** The package.json that CUE generates for these feature files. */
  const output = (...files) =>
    JSON.parse(execFileSync('cue', ['eval', 'base.cue', ...files, '-e', 'output', '--out', 'json'], { cwd: join(root, 'npm', 'package'), encoding: 'utf-8' }));

  it('gives the type "module" for ts and node', () => {
    assert.equal(output('ts.cue').type, 'module');
    assert.equal(output('ts.cue', 'node.cue').type, 'module');
  });

  it('gives the type "commonjs" and a require condition for node-cjs', () => {
    const pkg = output('ts.cue', 'nodeCjs.cue');
    assert.equal(pkg.type, 'commonjs');
    assert.deepEqual(pkg.exports['.'], { types: './dist/index.d.ts', import: './dist/index.js', require: './dist/index.js' });
  });
});
