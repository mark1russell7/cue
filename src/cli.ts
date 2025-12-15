#!/usr/bin/env node

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Types
interface Feature {
  dependencies: string[];
}

interface FeaturesManifest {
  features: Record<string, Feature>;
  presets: Record<string, string[]>;
}

interface DependenciesJson {
  $schema?: string;
  dependencies: string[];
}

interface PackageJson {
  $schema?: string;
  name?: string;
  version?: string;
  [key: string]: unknown;
}

interface ParsedArgs {
  _: string[];
  [key: string]: string | boolean | string[];
}

// Constants
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '..');

// Tsconfig priority: later features override earlier (most specific wins)
const TSCONFIG_PRIORITY = ['ts', 'node', 'vite', 'react'];

// ============================================================================
// Core Functions
// ============================================================================

function loadFeatures(): FeaturesManifest {
  const featuresPath = resolve(packageRoot, 'features.json');
  if (!existsSync(featuresPath)) {
    console.error('Error: features.json not found in package');
    process.exit(1);
  }
  return JSON.parse(readFileSync(featuresPath, 'utf-8')) as FeaturesManifest;
}

function loadDependencies(projectPath: string = '.'): string[] | null {
  const depsPath = resolve(projectPath, 'dependencies.json');
  if (!existsSync(depsPath)) {
    return null;
  }
  const content = JSON.parse(readFileSync(depsPath, 'utf-8')) as DependenciesJson | string[];
  if (Array.isArray(content)) {
    return content;
  }
  if (content.dependencies && Array.isArray(content.dependencies)) {
    return content.dependencies;
  }
  console.error('dependencies.json must have a "dependencies" array');
  process.exit(1);
}

function saveDependencies(deps: string[], projectPath: string = '.'): void {
  const depsJson: DependenciesJson = {
    $schema: './node_modules/@mark1russell7/cue/dependencies/schema.json',
    dependencies: deps,
  };
  writeFileSync(resolve(projectPath, 'dependencies.json'), JSON.stringify(depsJson, null, 2) + '\n');
}

function loadPackageJson(projectPath: string = '.'): PackageJson | null {
  const pkgPath = resolve(projectPath, 'package.json');
  if (!existsSync(pkgPath)) {
    return null;
  }
  return JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson;
}

// Flood-fill resolve all transitive dependencies
function resolveFeatures(requested: string[], manifest: FeaturesManifest): string[] {
  const resolved = new Set<string>();
  const queue = [...requested];

  while (queue.length > 0) {
    const feature = queue.shift()!;
    if (resolved.has(feature)) continue;

    const featureDef = manifest.features[feature];
    if (!featureDef) {
      console.error(`Warning: Unknown feature '${feature}'`);
      continue;
    }

    resolved.add(feature);

    for (const dep of featureDef.dependencies) {
      if (!resolved.has(dep)) {
        queue.push(dep);
      }
    }
  }

  return Array.from(resolved);
}

// Map feature name to CUE file field name (handle vite-react -> viteReact)
function featureToFieldName(feature: string): string {
  if (feature === 'vite-react') return 'viteReact';
  return feature;
}

// ============================================================================
// CUE Evaluation
// ============================================================================

function checkCue(): boolean {
  try {
    execSync('cue version', { stdio: 'ignore' });
    return true;
  } catch {
    console.error('Error: CUE is not installed.');
    console.error('Install from: https://cuelang.org/docs/install/');
    return false;
  }
}

function generatePackageJson(resolvedFeatures: string[], existingPkg: PackageJson | null, _projectPath: string = '.'): PackageJson {
  const configDir = resolve(packageRoot, 'npm/package');

  // Build list of CUE files to evaluate
  const files: string[] = ['base.cue'];
  for (const feature of resolvedFeatures) {
    const fieldName = featureToFieldName(feature);
    const cuePath = resolve(configDir, `${fieldName}.cue`);
    if (existsSync(cuePath)) {
      files.push(`${fieldName}.cue`);
    }
  }

  // Run cue eval
  const result = spawnSync('cue', ['eval', ...files, '-e', 'output', '--out', 'json'], {
    cwd: configDir,
    encoding: 'utf-8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    console.error('CUE evaluation failed for package.json:');
    console.error(result.stderr);
    process.exit(1);
  }

  const generated = JSON.parse(result.stdout) as PackageJson;

  // Merge with existing package.json
  const pkg: PackageJson = { ...existingPkg };

  // Apply generated values (existing values take precedence for some fields)
  for (const [key, value] of Object.entries(generated)) {
    if (key === 'name' || key === 'version' || key === 'description') {
      // Keep existing if present
      if (!pkg[key]) pkg[key] = value as string;
    } else if (key === 'devDependencies' || key === 'peerDependencies' || key === 'scripts') {
      // Merge objects
      pkg[key] = { ...(value as Record<string, unknown>), ...(pkg[key] as Record<string, unknown> ?? {}) };
    } else if (key === 'files' && Array.isArray(value) && Array.isArray(pkg[key])) {
      // Merge arrays (deduplicated, generated first then existing)
      const merged = [...(value as string[])];
      for (const item of pkg[key] as string[]) {
        if (!merged.includes(item)) merged.push(item);
      }
      pkg[key] = merged;
    } else {
      // Generated values take precedence for other fields
      pkg[key] = value;
    }
  }

  // Ensure $schema is first
  const ordered: PackageJson = { $schema: 'https://json.schemastore.org/package' };
  for (const [key, value] of Object.entries(pkg)) {
    if (key !== '$schema') ordered[key] = value;
  }

  return ordered;
}

function generateGitignore(resolvedFeatures: string[]): string {
  const configDir = resolve(packageRoot, 'git/ignore');

  // Build list of CUE files to evaluate
  const files: string[] = ['base.cue'];
  for (const feature of resolvedFeatures) {
    const cuePath = resolve(configDir, `${feature}.cue`);
    if (existsSync(cuePath)) {
      files.push(`${feature}.cue`);
    }
  }

  // Run cue eval
  const result = spawnSync('cue', ['eval', ...files, '-e', 'patterns', '--out', 'json'], {
    cwd: configDir,
    encoding: 'utf-8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    console.error('CUE evaluation failed for .gitignore:');
    console.error(result.stderr);
    process.exit(1);
  }

  const patterns = JSON.parse(result.stdout) as string[];
  return patterns.join('\n') + '\n';
}

function determineTsconfig(resolvedFeatures: string[]): string {
  // Find the most specific tsconfig (highest priority feature wins)
  let selected = 'ts'; // default
  for (const feature of TSCONFIG_PRIORITY) {
    if (resolvedFeatures.includes(feature)) {
      selected = feature;
    }
  }
  return selected;
}

// ============================================================================
// Commands
// ============================================================================

function usage(): void {
  console.log(`Usage: cue-config <command> [options]

Commands:
  init [--preset NAME]     Initialize dependencies.json
  add <feature>            Add a feature to dependencies.json
  remove <feature>         Remove a feature from dependencies.json
  generate                 Generate package.json, tsconfig.json, .gitignore
  validate                 Validate dependencies.json

Presets: lib, react-lib, app
Features: git, npm, ts, node, react, vite, vite-react, cue

Examples:
  cue-config init                        # Initialize with default 'lib' preset
  cue-config init --preset react-lib     # Initialize React library
  cue-config add node                    # Add node feature
  cue-config remove vite                 # Remove vite feature
  cue-config generate                    # Generate all configs
`);
}

function parseArgs(args: string[], flagsWithValues: string[] = []): ParsedArgs {
  const result: ParsedArgs = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg?.startsWith('--')) {
      const flag = arg.slice(2);
      const nextArg = args[i + 1];
      if (flagsWithValues.includes(flag) && nextArg && !nextArg.startsWith('--')) {
        result[flag] = nextArg;
        i++;
      } else {
        result[flag] = true;
      }
    } else if (arg) {
      result._.push(arg);
    }
  }
  return result;
}

function init(args: string[]): void {
  const manifest = loadFeatures();
  const parsed = parseArgs(args, ['preset']);
  const presetName = typeof parsed['preset'] === 'string' ? parsed['preset'] : 'lib';

  const preset = manifest.presets[presetName];
  if (!preset) {
    console.error(`Unknown preset: ${presetName}`);
    console.error(`Available presets: ${Object.keys(manifest.presets).join(', ')}`);
    process.exit(1);
  }

  if (existsSync('dependencies.json') && !parsed['force']) {
    console.log('dependencies.json already exists (use --force to overwrite)');
  } else {
    saveDependencies(preset);
    console.log(`Created dependencies.json with preset '${presetName}'`);
  }

  if (!existsSync('src')) {
    mkdirSync('src', { recursive: true });
  }
  if (!existsSync('src/index.ts')) {
    writeFileSync('src/index.ts', '// Entry point\nexport {};\n');
    console.log('Created src/index.ts');
  }

  console.log(`
Next steps:
  1. Run: npx cue-config generate
  2. Run: npm install
`);
}

function add(args: string[]): void {
  const feature = args[0];
  if (!feature) {
    console.error('Usage: cue-config add <feature>');
    process.exit(1);
  }

  const manifest = loadFeatures();
  if (!manifest.features[feature]) {
    console.error(`Unknown feature: ${feature}`);
    console.error(`Available: ${Object.keys(manifest.features).join(', ')}`);
    process.exit(1);
  }

  const deps = loadDependencies() ?? [];
  if (deps.includes(feature)) {
    console.log(`Feature '${feature}' is already in dependencies`);
    return;
  }

  deps.push(feature);
  saveDependencies(deps);
  console.log(`Added '${feature}' to dependencies.json`);
}

function remove(args: string[]): void {
  const feature = args[0];
  if (!feature) {
    console.error('Usage: cue-config remove <feature>');
    process.exit(1);
  }

  const deps = loadDependencies();
  if (!deps) {
    console.error('No dependencies.json found');
    process.exit(1);
  }

  const idx = deps.indexOf(feature);
  if (idx === -1) {
    console.log(`Feature '${feature}' is not in dependencies`);
    return;
  }

  deps.splice(idx, 1);
  saveDependencies(deps);
  console.log(`Removed '${feature}' from dependencies.json`);
}

function generate(): void {
  if (!checkCue()) process.exit(1);

  const manifest = loadFeatures();
  const deps = loadDependencies();

  if (!deps) {
    console.error('No dependencies.json found. Run: npx cue-config init');
    process.exit(1);
  }

  const resolvedFeatures = resolveFeatures(deps, manifest);
  console.log(`Resolved features: ${resolvedFeatures.join(', ')}`);

  const existingPkg = loadPackageJson();

  // Generate package.json via CUE
  const packageJson = generatePackageJson(resolvedFeatures, existingPkg);
  writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
  console.log('Generated package.json');

  // Generate tsconfig.json
  if (resolvedFeatures.includes('ts')) {
    const tsconfigName = determineTsconfig(resolvedFeatures);
    const tsconfig = {
      $schema: 'https://json.schemastore.org/tsconfig',
      extends: `@mark1russell7/cue/ts/config/${tsconfigName}.json`,
    };
    writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 2) + '\n');
    console.log(`Generated tsconfig.json (extends ${tsconfigName}.json)`);
  }

  // Generate .gitignore via CUE
  const gitignoreContent = generateGitignore(resolvedFeatures);
  writeFileSync('.gitignore', gitignoreContent);
  console.log('Generated .gitignore');

  // Setup CUE module if cue feature is present
  if (resolvedFeatures.includes('cue')) {
    setupCueMod();
    console.log('Setup cue.mod/');
  }
}

function validate(): void {
  const deps = loadDependencies();

  if (!deps) {
    console.error('No dependencies.json found. Run: npx cue-config init');
    process.exit(1);
  }

  const manifest = loadFeatures();

  for (const feature of deps) {
    if (!manifest.features[feature]) {
      console.error(`Error: Unknown feature '${feature}'`);
      process.exit(1);
    }
  }

  if (checkCue()) {
    const schemaPath = resolve(packageRoot, 'dependencies/schema.cue');
    if (existsSync(schemaPath)) {
      const result = spawnSync('cue', ['vet', '-d', '#Dependencies', schemaPath, 'dependencies.json'], {
        stdio: 'inherit',
      });
      if (result.status !== 0) {
        process.exit(result.status ?? 1);
      }
    }
  }

  console.log('Validation passed');
}

function setupCueMod(): void {
  if (!existsSync('cue.mod')) {
    mkdirSync('cue.mod', { recursive: true });
  }

  writeFileSync(
    'cue.mod/module.cue',
    `module: "project.local"
language: {
\tversion: "v0.15.1"
}
`
  );

  const pkgDir = 'cue.mod/pkg/mark1russell7.cue';
  if (!existsSync(pkgDir)) {
    mkdirSync(dirname(pkgDir), { recursive: true });
    try {
      if (process.platform === 'win32') {
        execSync(`mklink /J "${pkgDir}" "${packageRoot}"`, { stdio: 'ignore', shell: 'cmd.exe' });
      } else {
        execSync(`ln -s "${packageRoot}" "${pkgDir}"`, { stdio: 'ignore' });
      }
    } catch {
      mkdirSync(pkgDir, { recursive: true });
      execSync(`cp -r "${packageRoot}/ts" "${pkgDir}/"`, { stdio: 'ignore' });
      execSync(`cp -r "${packageRoot}/npm" "${pkgDir}/"`, { stdio: 'ignore' });
      execSync(`cp -r "${packageRoot}/git" "${pkgDir}/"`, { stdio: 'ignore' });
    }
  }
}

// Self-generate for dogfooding
function selfGenerate(): void {
  if (!checkCue()) process.exit(1);

  const manifest = loadFeatures();
  const deps = loadDependencies(packageRoot);

  if (!deps) {
    console.error('No dependencies.json found in package root');
    process.exit(1);
  }

  const resolvedFeatures = resolveFeatures(deps, manifest);
  console.log(`Self-generate: resolved features: ${resolvedFeatures.join(', ')}`);

  const existingPkg = loadPackageJson(packageRoot);
  const packageJson = generatePackageJson(resolvedFeatures, existingPkg, packageRoot);

  const outputPath = resolve(packageRoot, 'package.json');
  writeFileSync(outputPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`Generated ${outputPath}`);
}

// ============================================================================
// Main
// ============================================================================

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'init':
    init(args.slice(1));
    break;
  case 'add':
    add(args.slice(1));
    break;
  case 'remove':
    remove(args.slice(1));
    break;
  case 'generate':
    generate();
    break;
  case 'validate':
    validate();
    break;
  case 'self-generate':
    selfGenerate();
    break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    usage();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    usage();
    process.exit(1);
}
