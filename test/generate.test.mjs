// The tests of src/generate.ts (built in dist/) and of the CUE files of the features.
// Start them with "pnpm test" after "pnpm build". The CUE tests need the cue CLI, and they skip without it.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateTsconfigFiles, linkCuePackage, mergePackageJson } from '../dist/generate.js';
import { readFeatures, resolveFeatures } from '../dist/features.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The cases of test/fixtures: a feature set and an optional existing package.json, by name. */
const cases = JSON.parse(readFileSync(join(root, 'test', 'fixtures', 'generate-cases.json'), 'utf-8'));
/** The files that cue-config 1.0.2 generated for each case (made with the 1.0.2 build). */
const files102 = JSON.parse(readFileSync(join(root, 'test', 'fixtures', 'generate-1.0.2.json'), 'utf-8'));

/** The tsconfig.test.json of the test feature. */
const TSCONFIG_TEST = `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": [
    "./tsconfig.json",
    "@mark1russell7/cue/ts/config/test.json"
  ]
}
`;

/** This function removes a temporary folder. It removes the links first, so rmSync does not follow them. */
function removeTemp(dir, links) {
  for (const link of links) {
    if (lstatSync(link, { throwIfNoEntry: false })) unlinkSync(link);
  }
  rmSync(dir, { recursive: true, force: true });
}

describe('mergePackageJson', () => {
  it('gives the generated type "module" to each package', () => {
    // The ts feature compiles ES modules, so a CommonJS package (for example from npm init) gets "module"
    const generated = { name: 'x', type: 'module', main: './dist/index.js' };
    assert.equal(mergePackageJson(generated, { name: 'a', type: 'commonjs' }).type, 'module');
    assert.equal(mergePackageJson(generated, { name: 'a', type: 'module' }).type, 'module');
    assert.equal(mergePackageJson(generated, { name: 'a' }).type, 'module');
  });

  it('keeps the type of an existing package for the generated type "commonjs" (node-cjs)', () => {
    const generated = { name: 'x', type: 'commonjs', main: './dist/index.js' };
    assert.equal(mergePackageJson(generated, { name: 'a', type: 'module' }).type, 'module');
    assert.equal(mergePackageJson(generated, { name: 'a', type: 'commonjs' }).type, 'commonjs');
    assert.equal(mergePackageJson(generated, { name: 'a' }).type, 'commonjs');
    assert.equal(mergePackageJson(generated, null).type, 'commonjs');
  });

  it('keeps the type of a package when the features generate no type', () => {
    assert.equal(mergePackageJson({ name: 'x' }, { name: 'a', type: 'commonjs' }).type, 'commonjs');
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

  it('gives the new generated value to a script with an old generated value (the test feature)', () => {
    const generated = { scripts: { typecheck: 'tsc --noEmit && tsc -p tsconfig.test.json', test: 'vitest run' } };
    const merged = mergePackageJson(generated, { scripts: { typecheck: 'tsc --noEmit', test: 'vitest run --passWithNoTests' } });
    assert.deepEqual(merged.scripts, generated.scripts);
  });

  it('keeps a script of the package that is not an old generated value', () => {
    const generated = { scripts: { typecheck: 'tsc --noEmit && tsc -p tsconfig.test.json', test: 'vitest run' } };
    const existing = { scripts: { typecheck: 'tsc --noEmit -p tsconfig.build.json', test: 'vitest run --exclude e2e' } };
    assert.deepEqual(mergePackageJson(generated, existing).scripts, existing.scripts);
  });

  it('changes no script without the test feature (the generated values are the old values)', () => {
    const generated = { scripts: { build: 'tsc -b', typecheck: 'tsc --noEmit', test: 'vitest run --passWithNoTests' } };
    const existing = { scripts: { typecheck: 'tsc --noEmit', test: 'vitest run', lint: 'eslint .' } };
    const merged = mergePackageJson(generated, existing);
    assert.equal(JSON.stringify(merged.scripts), JSON.stringify({ build: 'tsc -b', typecheck: 'tsc --noEmit', test: 'vitest run', lint: 'eslint .' }));
  });
});

describe('generateTsconfigFiles', () => {
  const manifest = readFeatures();

  it('gives the tsconfig.json of 1.0.2 and no tsconfig.test.json without the test feature', () => {
    for (const [name, c] of Object.entries(cases)) {
      const expected = {};
      if (files102[name]['tsconfig.json'] !== undefined) expected['tsconfig.json'] = files102[name]['tsconfig.json'];
      assert.deepEqual(generateTsconfigFiles(resolveFeatures(c.features, manifest)), expected, name);
    }
  });

  it('adds tsconfig.test.json with the test feature', () => {
    const files = generateTsconfigFiles(resolveFeatures(['node', 'test'], manifest));
    assert.deepEqual(Object.keys(files), ['tsconfig.json', 'tsconfig.test.json']);
    assert.equal(files['tsconfig.json'], files102['node']['tsconfig.json']);
    assert.equal(files['tsconfig.test.json'], TSCONFIG_TEST);
  });

  it('makes the test feature need the ts feature', () => {
    assert.deepEqual(manifest.features['test'], { dependencies: ['ts'] });
    assert.ok(resolveFeatures(['test'], manifest).includes('ts'));
  });
});

describe('the preset ts/config/test.json', () => {
  it('is an entry point of the package', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
    assert.equal(pkg.exports['./ts/config/test.json'], './ts/config/test.json');
  });

  it('includes the tests, the benchmarks and the config files, and emits nothing', () => {
    const preset = JSON.parse(readFileSync(join(root, 'ts', 'config', 'test.json'), 'utf-8'));
    assert.deepEqual(preset.compilerOptions, {
      noEmit: true,
      composite: false,
      incremental: false,
      declaration: false,
      declarationMap: false,
      isolatedDeclarations: false,
      rootDir: '${configDir}',
    });
    assert.deepEqual(preset.include, ['src/**/*', 'test/**/*', '__tests__/**/*', 'e2e/**/*', 'bench/**/*', '*.config.ts', '*.config.mts'].map((p) => `\${configDir}/${p}`));
    assert.deepEqual(preset.exclude, ['${configDir}/node_modules', '${configDir}/dist']);
  });

  it('type-checks the test files of a package with tsc', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cue-tsc-'));
    const link = join(dir, 'node_modules', '@mark1russell7', 'cue');
    try {
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(root, link, process.platform === 'win32' ? 'junction' : 'dir');
      writeFileSync(join(dir, 'package.json'), '{ "name": "x", "type": "module" }\n');
      for (const [file, content] of Object.entries(generateTsconfigFiles(['git', 'npm', 'ts', 'test']))) writeFileSync(join(dir, file), content);
      for (const sub of ['src', 'test']) mkdirSync(join(dir, sub));
      writeFileSync(join(dir, 'src', 'index.ts'), 'export const a: number = 1;\n');
      writeFileSync(join(dir, 'src', 'index.test.ts'), 'import { a } from "./index.js";\nexport const b: string = a;\n');
      writeFileSync(join(dir, 'test', 'helper.ts'), 'export const c: number = "c";\n');
      writeFileSync(join(dir, 'vitest.config.ts'), 'export const d: boolean = 1;\n');
      const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
      const run = (...args) => spawnSync(process.execPath, [tsc, ...args, '--pretty', 'false'], { cwd: dir, encoding: 'utf-8' });

      // tsconfig.test.json reads the tests: ${configDir} is the package folder
      const result = run('-p', 'tsconfig.test.json');
      assert.equal(result.status, 2, result.stdout);
      const errors = result.stdout.split('\n').filter(Boolean).map((line) => line.slice(0, line.indexOf('(')));
      assert.deepEqual(errors.sort(), ['src/index.test.ts', 'test/helper.ts', 'vitest.config.ts']);
      // It emits nothing, and it writes no .tsbuildinfo (incremental false)
      assert.ok(!existsSync(join(dir, 'dist')), 'tsconfig.test.json writes no file');
      // tsconfig.json (lib.json) does not read the tests
      assert.equal(run('--noEmit').status, 0);
    } finally {
      removeTemp(dir, [link]);
    }
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

  it('gives the typecheck and test scripts of the test feature', () => {
    assert.equal(output('ts.cue', 'vitest.cue').scripts.typecheck, 'tsc --noEmit');
    assert.equal(output('ts.cue', 'vitest.cue').scripts.test, 'vitest run --passWithNoTests');
    const scripts = output('ts.cue', 'vitest.cue', 'test.cue').scripts;
    assert.equal(scripts.typecheck, 'tsc --noEmit && tsc -p tsconfig.test.json');
    assert.equal(scripts.test, 'vitest run');
    // Without vitest, the test feature adds no test script
    assert.equal(output('ts.cue', 'test.cue').scripts.test, undefined);
  });
});

describe('cue-config generate', { skip: hasCue ? false : 'the cue CLI is not installed' }, () => {
  const fileNames = ['package.json', 'tsconfig.json', 'tsconfig.test.json', '.gitignore'];

  /** The files that `cue-config generate` writes in a new folder for these features (and an existing package.json). */
  function generate(features, packageJson) {
    const dir = mkdtempSync(join(tmpdir(), 'cue-generate-'));
    try {
      writeFileSync(join(dir, 'dependencies.json'), JSON.stringify({ dependencies: features }, null, 2) + '\n');
      if (packageJson) writeFileSync(join(dir, 'package.json'), JSON.stringify(packageJson, null, 2) + '\n');
      execFileSync(process.execPath, [join(root, 'dist', 'cli.js'), 'generate'], { cwd: dir, stdio: 'pipe' });
      const files = {};
      for (const name of fileNames) {
        if (existsSync(join(dir, name))) files[name] = readFileSync(join(dir, name), 'utf-8');
      }
      return files;
    } finally {
      removeTemp(dir, [join(dir, 'cue.mod', 'pkg', 'mark1russell7.cue')]);
    }
  }

  for (const [name, c] of Object.entries(cases)) {
    it(`writes the same files as 1.0.2 without the test feature: ${name}`, () => {
      assert.deepEqual(generate(c.features, c.packageJson), files102[name]);
    });
  }

  it('writes tsconfig.test.json and the scripts of the test feature', () => {
    const files = generate(['ts', 'node', 'cue', 'vitest', 'test']);
    const before = files102['ts, node, cue, vitest'];
    assert.equal(files['tsconfig.json'], before['tsconfig.json']);
    assert.equal(files['tsconfig.test.json'], TSCONFIG_TEST);
    assert.equal(files['.gitignore'], before['.gitignore']);
    const pkg = JSON.parse(files['package.json']);
    assert.equal(pkg.scripts.typecheck, 'tsc --noEmit && tsc -p tsconfig.test.json');
    assert.equal(pkg.scripts.test, 'vitest run');
    // Only the two scripts change
    const old = JSON.parse(before['package.json']);
    assert.deepEqual({ ...pkg, scripts: { ...pkg.scripts, typecheck: '', test: '' } }, { ...old, scripts: { ...old.scripts, typecheck: '', test: '' } });
  });

  it('gives the scripts of the test feature to an existing package with the old generated scripts', () => {
    const c = cases['an existing package with the old defaults (ts, vitest)'];
    const pkg = JSON.parse(generate([...c.features, 'test'], c.packageJson)['package.json']);
    assert.equal(pkg.scripts.typecheck, 'tsc --noEmit && tsc -p tsconfig.test.json');
    assert.equal(pkg.scripts.test, 'vitest run');
  });

  it('keeps the other scripts of an existing package with the test feature', () => {
    const c = cases['an existing package (ts, node, cue, vitest)'];
    const pkg = JSON.parse(generate([...c.features, 'test'], c.packageJson)['package.json']);
    assert.equal(pkg.scripts.typecheck, 'tsc --noEmit && tsc -p tsconfig.test.json');
    assert.equal(pkg.scripts.test, 'vitest run');
    assert.equal(pkg.scripts.lint, 'eslint .');
  });
});
