// The tests of src/generate.ts (built in dist/) and of the CUE files of the features.
// Start them with "pnpm test" after "pnpm build". The CUE tests need the cue CLI, and they skip without it.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateTsconfigFiles, linkCuePackage, mergePackageJson, type PackageJson } from '../dist/generate.js';
import { readFeatures, resolveFeatures } from '../dist/features.js';
import { presetFeatures, type FeaturesManifest } from '../dist/index.js';
import { cueEvalArgs, cueFileOf, cueFiles, cueTargets, dependenciesJsonText, generateFiles, gitignoreText, type CueTarget } from '../dist/core.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** One case of test/fixtures: a feature set and an optional existing package.json. */
interface Case {
  features: string[];
  packageJson?: PackageJson;
}

/** The generated files of one case, by file name. */
type Files = Record<string, string>;

/** The cases of test/fixtures, by name. */
const cases = JSON.parse(readFileSync(join(root, 'test', 'fixtures', 'generate-cases.json'), 'utf-8')) as Record<string, Case>;
/**
 * The files that cue-config 1.0.2 generated for each case (made with the 1.0.2 build). Since 2.1.1, the
 * cue feature gives the range ^2.1.0, so the fixture has that range in place of ^1.0.0. Since 2.1.3, the ts feature
 * gives "!dist/.tsbuildinfo" after "dist" in files, so the fixture has that entry too.
 */
const files102 = JSON.parse(readFileSync(join(root, 'test', 'fixtures', 'generate-1.0.2.json'), 'utf-8')) as Record<string, Files>;

/** This function gives the files of a case of the fixture. It throws when the fixture does not have the case. */
function filesOf(name: string): Files {
  const files = files102[name];
  if (files === undefined) throw new Error(`test/fixtures/generate-1.0.2.json does not have the case "${name}"`);
  return files;
}

/** This function gives a case of test/fixtures. It throws when the fixture does not have the case. */
function caseOf(name: string): Case {
  const c = cases[name];
  if (c === undefined) throw new Error(`test/fixtures/generate-cases.json does not have the case "${name}"`);
  return c;
}

/** The scripts of a package.json. */
function scriptsOf(pkg: PackageJson): unknown {
  return pkg['scripts'];
}

/** The parts of a package.json that the tests read. */
interface PackageJsonOutput {
  type?: string;
  exports: Record<string, unknown>;
  scripts: { typecheck?: string; test?: string; lint?: string };
  files?: string[];
}

/** This function gives the package.json of a set of generated files. It throws when the set has no package.json. */
function packageOf(files: Files): PackageJsonOutput {
  const text = files['package.json'];
  if (text === undefined) throw new Error('the files have no package.json');
  return JSON.parse(text) as PackageJsonOutput;
}

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
function removeTemp(dir: string, links: readonly string[]): void {
  for (const link of links) {
    if (lstatSync(link, { throwIfNoEntry: false })) unlinkSync(link);
  }
  rmSync(dir, { recursive: true, force: true });
}

describe('mergePackageJson', () => {
  it('gives the generated type "module" to each package', () => {
    // The ts feature compiles ES modules, so a CommonJS package (for example from npm init) gets "module"
    const generated = { name: 'x', type: 'module', main: './dist/index.js' };
    assert.equal(mergePackageJson(generated, { name: 'a', type: 'commonjs' })['type'], 'module');
    assert.equal(mergePackageJson(generated, { name: 'a', type: 'module' })['type'], 'module');
    assert.equal(mergePackageJson(generated, { name: 'a' })['type'], 'module');
  });

  it('keeps the type of an existing package for the generated type "commonjs" (node-cjs)', () => {
    const generated = { name: 'x', type: 'commonjs', main: './dist/index.js' };
    assert.equal(mergePackageJson(generated, { name: 'a', type: 'module' })['type'], 'module');
    assert.equal(mergePackageJson(generated, { name: 'a', type: 'commonjs' })['type'], 'commonjs');
    assert.equal(mergePackageJson(generated, { name: 'a' })['type'], 'commonjs');
    assert.equal(mergePackageJson(generated, null)['type'], 'commonjs');
  });

  it('keeps the type of a package when the features generate no type', () => {
    assert.equal(mergePackageJson({ name: 'x' }, { name: 'a', type: 'commonjs' })['type'], 'commonjs');
  });

  it('keeps the entry points, merges the scripts and puts $schema first', () => {
    const merged = mergePackageJson(
      { name: 'x', main: './dist/index.js', scripts: { build: 'tsc -b', test: 'vitest' }, engines: { node: '>=22' } },
      { name: 'a', main: './lib/a.js', scripts: { test: 'node --test' }, engines: { node: '>=18' } },
    );
    assert.deepEqual(Object.keys(merged)[0], '$schema');
    assert.equal(merged.name, 'a');
    assert.equal(merged['main'], './lib/a.js');
    assert.deepEqual(scriptsOf(merged), { build: 'tsc -b', test: 'node --test' });
    assert.deepEqual(merged['engines'], { node: '>=22' });
  });

  it('gives the new generated value to a script with an old generated value (the test feature)', () => {
    const generated = { scripts: { typecheck: 'tsc --noEmit && tsc -p tsconfig.test.json', test: 'vitest run' } };
    const merged = mergePackageJson(generated, { scripts: { typecheck: 'tsc --noEmit', test: 'vitest run --passWithNoTests' } });
    assert.deepEqual(scriptsOf(merged), generated.scripts);
  });

  it('keeps a script of the package that is not an old generated value', () => {
    const generated = { scripts: { typecheck: 'tsc --noEmit && tsc -p tsconfig.test.json', test: 'vitest run' } };
    const existing = { scripts: { typecheck: 'tsc --noEmit -p tsconfig.build.json', test: 'vitest run --exclude e2e' } };
    assert.deepEqual(scriptsOf(mergePackageJson(generated, existing)), existing.scripts);
  });

  it('changes no script without the test feature (the generated values are the old values)', () => {
    const generated = { scripts: { build: 'tsc -b', typecheck: 'tsc --noEmit', test: 'vitest run --passWithNoTests' } };
    const existing = { scripts: { typecheck: 'tsc --noEmit', test: 'vitest run', lint: 'eslint .' } };
    const merged = mergePackageJson(generated, existing);
    assert.equal(JSON.stringify(scriptsOf(merged)), JSON.stringify({ build: 'tsc -b', typecheck: 'tsc --noEmit', test: 'vitest run', lint: 'eslint .' }));
  });
});

describe('generateTsconfigFiles', () => {
  const manifest = readFeatures();

  it('gives the tsconfig.json of 1.0.2 and no tsconfig.test.json without the test feature', () => {
    for (const [name, c] of Object.entries(cases)) {
      const expected: Files = {};
      const tsconfig = filesOf(name)['tsconfig.json'];
      if (tsconfig !== undefined) expected['tsconfig.json'] = tsconfig;
      assert.deepEqual(generateTsconfigFiles(resolveFeatures(c.features, manifest)), expected, name);
    }
  });

  it('adds tsconfig.test.json with the test feature', () => {
    const files = generateTsconfigFiles(resolveFeatures(['node', 'test'], manifest));
    assert.deepEqual(Object.keys(files), ['tsconfig.json', 'tsconfig.test.json']);
    assert.equal(files['tsconfig.json'], filesOf('node')['tsconfig.json']);
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
      const run = (...args: string[]) => spawnSync(process.execPath, [tsc, ...args, '--pretty', 'false'], { cwd: dir, encoding: 'utf-8' });

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
  function setup(): { dir: string; link: string } {
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
  const output = (...files: string[]): PackageJsonOutput =>
    JSON.parse(execFileSync('cue', ['eval', 'base.cue', ...files, '-e', 'output', '--out', 'json'], { cwd: join(root, 'npm', 'package'), encoding: 'utf-8' })) as PackageJsonOutput;

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

  it('keeps the build info file of tsc out of the npm package (files has "!dist/.tsbuildinfo" after "dist")', () => {
    for (const files of [['ts.cue'], ['ts.cue', 'node.cue'], ['ts.cue', 'nodeCjs.cue'], ['ts.cue', 'vite.cue']]) {
      assert.deepEqual(output(...files).files, ['dist', '!dist/.tsbuildinfo', 'src']);
    }
  });
});

describe('cue-config generate', { skip: hasCue ? false : 'the cue CLI is not installed' }, () => {
  const fileNames = ['package.json', 'tsconfig.json', 'tsconfig.test.json', '.gitignore'];

  /** The files that `cue-config generate` writes in a new folder for these features (and an existing package.json). */
  function generate(features: readonly string[], packageJson?: PackageJson): Files {
    const dir = mkdtempSync(join(tmpdir(), 'cue-generate-'));
    try {
      writeFileSync(join(dir, 'dependencies.json'), JSON.stringify({ dependencies: features }, null, 2) + '\n');
      if (packageJson) writeFileSync(join(dir, 'package.json'), JSON.stringify(packageJson, null, 2) + '\n');
      execFileSync(process.execPath, [join(root, 'dist', 'cli.js'), 'generate'], { cwd: dir, stdio: 'pipe' });
      const files: Files = {};
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
    const before = filesOf('ts, node, cue, vitest');
    assert.equal(files['tsconfig.json'], before['tsconfig.json']);
    assert.equal(files['tsconfig.test.json'], TSCONFIG_TEST);
    assert.equal(files['.gitignore'], before['.gitignore']);
    const pkg = packageOf(files);
    assert.equal(pkg.scripts.typecheck, 'tsc --noEmit && tsc -p tsconfig.test.json');
    assert.equal(pkg.scripts.test, 'vitest run');
    // Only the two scripts change
    const old = packageOf(before);
    assert.deepEqual({ ...pkg, scripts: { ...pkg.scripts, typecheck: '', test: '' } }, { ...old, scripts: { ...old.scripts, typecheck: '', test: '' } });
  });

  it('gives the scripts of the test feature to an existing package with the old generated scripts', () => {
    const c = caseOf('an existing package with the old defaults (ts, vitest)');
    const pkg = packageOf(generate([...c.features, 'test'], c.packageJson));
    assert.equal(pkg.scripts.typecheck, 'tsc --noEmit && tsc -p tsconfig.test.json');
    assert.equal(pkg.scripts.test, 'vitest run');
  });

  it('keeps the other scripts of an existing package with the test feature', () => {
    const c = caseOf('an existing package (ts, node, cue, vitest)');
    const pkg = packageOf(generate([...c.features, 'test'], c.packageJson));
    assert.equal(pkg.scripts.typecheck, 'tsc --noEmit && tsc -p tsconfig.test.json');
    assert.equal(pkg.scripts.test, 'vitest run');
    assert.equal(pkg.scripts.lint, 'eslint .');
  });

  it('gives "!dist/.tsbuildinfo" after "dist" to an existing package that packs dist', () => {
    const c = caseOf('an existing package (ts, node, cue, vitest)');
    for (const [files, merged] of [
      [['dist'], ['dist', '!dist/.tsbuildinfo', 'src']],
      [['dist', 'README.md'], ['dist', '!dist/.tsbuildinfo', 'src', 'README.md']],
    ]) {
      const pkg = packageOf(generate(c.features, { ...c.packageJson, files }));
      assert.deepEqual(pkg.files, merged);
    }
  });
});

describe('the core entry (@mark1russell7/cue/core)', () => {
  const manifest = readFeatures();
  const inFolder = (target: CueTarget) => (file: string) => existsSync(join(root, cueTargets[target].dir, file));

  it('imports no module of Node.js, so a browser can start it', () => {
    const text = readFileSync(join(root, 'dist', 'core.js'), 'utf-8');
    assert.doesNotMatch(text, /\bfrom\s+['"]/);
    assert.doesNotMatch(text, /\bimport\s*\(/);
  });

  it('is an entry point of the package', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as PackageJsonOutput;
    assert.deepEqual(pkg.exports['./core'], { types: './dist/core.d.ts', import: './dist/core.js', default: './dist/core.js' });
  });

  it('gives base.cue, then the CUE file of each feature that has one', () => {
    const resolved = resolveFeatures(['vite-react', 'test'], manifest);
    const files = cueFiles(resolved, 'package', inFolder('package'));
    assert.equal(files[0], 'base.cue');
    assert.ok(files.includes('viteReact.cue'), files.join());
    assert.ok(!files.includes('git.cue'), files.join());
    assert.deepEqual(cueFiles(['git', 'npm'], 'ignore', inFolder('ignore')), ['base.cue', 'npm.cue']);
    assert.equal(cueFileOf('node-cjs', 'package'), 'nodeCjs.cue');
    assert.equal(cueFileOf('node-cjs', 'ignore'), 'node-cjs.cue');
  });

  it('gives the arguments of cue eval for each target', () => {
    assert.deepEqual(cueEvalArgs(['base.cue', 'ts.cue'], 'package'), ['eval', 'base.cue', 'ts.cue', '-e', 'output', '--out', 'json']);
    assert.deepEqual(cueEvalArgs(['base.cue'], 'ignore'), ['eval', 'base.cue', '-e', 'patterns', '--out', 'json']);
    assert.equal(cueTargets.package.dir, 'npm/package');
    assert.equal(cueTargets.ignore.dir, 'git/ignore');
  });

  it('makes the files of generate from the output of cue eval', () => {
    const resolved = resolveFeatures(['node', 'test'], manifest);
    const cue = { packageJson: { scripts: { build: 'tsc -b' } }, patterns: ['dist/', 'node_modules/'] };
    const files = generateFiles(resolved, cue, { name: 'x', version: '1.0.0' });
    assert.deepEqual(Object.keys(files).sort(), ['.gitignore', 'package.json', 'tsconfig.json', 'tsconfig.test.json']);
    assert.equal((JSON.parse(files['package.json'] ?? '{}') as PackageJson).name, 'x');
    assert.match(files['tsconfig.json'] ?? '', /ts\/config\/node\.json/);
    assert.equal(files['tsconfig.test.json'], TSCONFIG_TEST);
    assert.equal(files['.gitignore'], 'dist/\nnode_modules/\n');
    assert.equal(gitignoreText(cue.patterns), files['.gitignore']);
  });

  it('writes dependencies.json as JSON with a new line at the end', () => {
    const text = dependenciesJsonText(['ts', 'node']);
    assert.ok(text.endsWith('\n'));
    assert.deepEqual(JSON.parse(text), { $schema: './node_modules/@mark1russell7/cue/dependencies/schema.json', dependencies: ['ts', 'node'] });
  });
});

describe('a key of the prototype', () => {
  const manifest = readFeatures();
  const names = ['constructor', '__proto__', 'toString', 'hasOwnProperty'];

  it('is not a feature: resolveFeatures gives it to onUnknown and skips it', () => {
    const unknown: string[] = [];
    assert.deepEqual(resolveFeatures(['ts', ...names], manifest, (name) => unknown.push(name)), resolveFeatures(['ts'], manifest));
    assert.deepEqual(unknown, names);
  });

  it('is not a feature of a dependency list either', () => {
    const own = { features: { a: { dependencies: ['constructor', 'b'] }, b: { dependencies: [] } }, presets: {} };
    assert.deepEqual(resolveFeatures(['a'], own), ['a', 'b']);
  });

  it('is not a preset: presetFeatures throws the error of an unknown preset', () => {
    for (const name of names) assert.throws(() => presetFeatures(name, manifest), /Unknown preset/);
  });

  it('is a feature when the manifest has it as its own key', () => {
    const own = { features: { constructor: { dependencies: [] } }, presets: {} } as unknown as FeaturesManifest;
    assert.deepEqual(resolveFeatures(['constructor'], own), ['constructor']);
  });
});
