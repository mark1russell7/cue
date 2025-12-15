#!/usr/bin/env node

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Types
interface Feature {
  description: string;
  requires?: string[];
  gitignore?: string[];
  tsconfig?: string;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  packageFields?: Record<string, unknown>;
  generates?: string[];
}

interface FeaturesManifest {
  features: Record<string, Feature>;
  defaults: Record<string, string[]>;
}

interface Dependencies {
  $schema?: string;
  name: string;
  scope?: string;
  version?: string;
  description?: string;
  license?: string;
  author?: string;
  features: string[];
  tsconfig?: string;
  packageJson?: Record<string, unknown>;
}

interface PackageJson {
  $schema?: string;
  name?: string;
  version?: string;
  description?: string;
  [key: string]: unknown;
}

interface ParsedArgs {
  _: string[];
  [key: string]: string | boolean | string[];
}

// Constants
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '..');

// Tsconfig mapping: feature tsconfig value -> actual file path
const TSCONFIG_FILES: Record<string, string> = {
  'esm': 'esm.json',
  'esm.lib': 'esm.lib.json',
  'commonjs': 'commonjs.json',
  'commonjs.lib': 'commonjs.lib.json',
  'frontend': 'frontend.json',
  'react': 'react.json',
  'shared': 'shared.json',
  'lib': 'lib.json',
};

// Load features manifest
function loadFeatures(): FeaturesManifest {
  const featuresPath = resolve(packageRoot, 'features.json');
  if (!existsSync(featuresPath)) {
    console.error('Error: features.json not found in package');
    process.exit(1);
  }
  return JSON.parse(readFileSync(featuresPath, 'utf-8')) as FeaturesManifest;
}

// Load project dependencies.json
function loadDependencies(projectPath: string = '.'): Dependencies | null {
  const depsPath = resolve(projectPath, 'dependencies.json');
  if (!existsSync(depsPath)) {
    return null;
  }
  return JSON.parse(readFileSync(depsPath, 'utf-8')) as Dependencies;
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

    // Add required features to queue
    if (featureDef.requires) {
      for (const req of featureDef.requires) {
        if (!resolved.has(req)) {
          queue.push(req);
        }
      }
    }
  }

  return Array.from(resolved);
}

// Merge features into package.json structure
function buildPackageJson(deps: Dependencies, resolvedFeatures: string[], manifest: FeaturesManifest): PackageJson {
  const pkg: PackageJson = {
    $schema: 'https://json.schemastore.org/package',
    name: deps.scope ? `${deps.scope}/${deps.name}` : deps.name,
    version: deps.version ?? '0.0.0',
  };

  if (deps.description) pkg['description'] = deps.description;
  if (deps.license) pkg['license'] = deps.license;
  if (deps.author) pkg['author'] = deps.author;

  // Collect from all resolved features
  const devDependencies: Record<string, string> = {};
  const peerDependencies: Record<string, string> = {};
  const scripts: Record<string, string> = {};

  // Process features in dependency order (most fundamental first)
  // Reverse the resolved list since flood-fill adds dependencies after their dependents
  const orderedFeatures = [...resolvedFeatures].reverse();

  for (const featureName of orderedFeatures) {
    const feature = manifest.features[featureName];
    if (!feature) continue;

    // Merge devDependencies
    if (feature.devDependencies) {
      Object.assign(devDependencies, feature.devDependencies);
    }

    // Merge peerDependencies
    if (feature.peerDependencies) {
      Object.assign(peerDependencies, feature.peerDependencies);
    }

    // Merge scripts (later features override earlier)
    if (feature.scripts) {
      Object.assign(scripts, feature.scripts);
    }

    // Merge packageFields
    if (feature.packageFields) {
      for (const [key, value] of Object.entries(feature.packageFields)) {
        pkg[key] = value;
      }
    }
  }

  // Apply project-specific overrides from packageJson
  if (deps.packageJson) {
    for (const [key, value] of Object.entries(deps.packageJson)) {
      if (key === 'scripts' && typeof value === 'object' && value !== null) {
        Object.assign(scripts, value as Record<string, string>);
      } else {
        pkg[key] = value;
      }
    }
  }

  // Add collected dependencies and scripts
  if (Object.keys(devDependencies).length > 0) {
    pkg['devDependencies'] = sortObject(devDependencies);
  }
  if (Object.keys(peerDependencies).length > 0) {
    pkg['peerDependencies'] = sortObject(peerDependencies);
  }
  if (Object.keys(scripts).length > 0) {
    pkg['scripts'] = scripts;
  }

  return pkg;
}

// Sort object keys alphabetically
function sortObject(obj: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key]!;
  }
  return sorted;
}

// Determine which tsconfig to use (highest-priority feature wins)
function determineTsconfig(deps: Dependencies, resolvedFeatures: string[], manifest: FeaturesManifest): string | null {
  // Explicit override
  if (deps.tsconfig) {
    return deps.tsconfig;
  }

  // Find the most specific tsconfig from resolved features
  // Priority: react > frontend > esm.lib (later in the list = more specific)
  let tsconfig: string | null = null;
  for (const featureName of resolvedFeatures) {
    const feature = manifest.features[featureName];
    if (feature?.tsconfig) {
      tsconfig = feature.tsconfig;
    }
  }

  return tsconfig;
}

// Build .gitignore from resolved features
function buildGitignore(resolvedFeatures: string[], manifest: FeaturesManifest): string {
  const gitignoreDir = resolve(packageRoot, 'gitignore');
  const modules = new Set<string>();

  for (const featureName of resolvedFeatures) {
    const feature = manifest.features[featureName];
    if (feature?.gitignore) {
      for (const mod of feature.gitignore) {
        modules.add(mod);
      }
    }
  }

  let content = '';
  for (const mod of modules) {
    const modPath = resolve(gitignoreDir, mod);
    if (existsSync(modPath)) {
      content += readFileSync(modPath, 'utf-8');
    }
  }

  return content;
}

// Utilities
function usage(): void {
  console.log(`Usage: cue-config <command> [options]

Commands:
  init [--preset NAME]     Initialize dependencies.json from preset
  generate                 Generate package.json, tsconfig.json, .gitignore from dependencies.json
  validate                 Validate dependencies.json and generated configs

Presets: lib, react-lib, app

Examples:
  cue-config init                        # Initialize with default 'lib' preset
  cue-config init --preset react-lib     # Initialize React library
  cue-config generate                    # Generate all configs
  cue-config validate                    # Check configs are valid
`);
}

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
      console.log('Note: Creating copy of CUE schemas (symlink failed)');
      mkdirSync(pkgDir, { recursive: true });
      execSync(`cp -r "${packageRoot}/ts" "${pkgDir}/"`, { stdio: 'ignore' });
      execSync(`cp -r "${packageRoot}/npm" "${pkgDir}/"`, { stdio: 'ignore' });
    }
  }
}

// Commands
function init(args: string[]): void {
  const manifest = loadFeatures();
  const parsed = parseArgs(args, ['preset']);
  const presetName = typeof parsed['preset'] === 'string' ? parsed['preset'] : 'lib';

  const preset = manifest.defaults[presetName];
  if (!preset) {
    console.error(`Unknown preset: ${presetName}`);
    console.error(`Available presets: ${Object.keys(manifest.defaults).join(', ')}`);
    process.exit(1);
  }

  // Determine project name from existing package.json or folder
  let projectName = process.cwd().split(/[\\/]/).pop() ?? 'project';
  if (existsSync('package.json')) {
    try {
      const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as PackageJson;
      const name = pkg.name?.replace(/@[^/]+\//, '') ?? '';
      if (name) projectName = name;
    } catch {
      // Ignore
    }
  }

  const deps: Dependencies = {
    $schema: './node_modules/@mark1russell7/cue/dependencies/schema.json',
    name: projectName,
    scope: '@mark1russell7',
    version: '0.0.0',
    description: 'Package description',
    license: 'MIT',
    author: 'Mark Russell <marktheprogrammer17@gmail.com>',
    features: preset,
    packageJson: {
      keywords: [],
      repository: {
        type: 'git',
        url: `https://github.com/mark1russell7/${projectName}.git`,
      },
      bugs: {
        url: `https://github.com/mark1russell7/${projectName}/issues`,
      },
      homepage: `https://github.com/mark1russell7/${projectName}#readme`,
      publishConfig: {
        access: 'public',
      },
      engines: {
        node: '>=25.0.0',
        npm: '>=11.0.0',
      },
    },
  };

  if (existsSync('dependencies.json') && !parsed['force']) {
    console.log('dependencies.json already exists (use --force to overwrite)');
  } else {
    writeFileSync('dependencies.json', JSON.stringify(deps, null, 2) + '\n');
    console.log('Created dependencies.json');
  }

  // Create src/index.ts if missing
  if (!existsSync('src')) {
    mkdirSync('src', { recursive: true });
  }
  if (!existsSync('src/index.ts')) {
    writeFileSync('src/index.ts', '// Entry point\nexport {};\n');
    console.log('Created src/index.ts');
  }

  console.log(`
Next steps:
  1. Edit dependencies.json to customize your project
  2. Run: npx cue-config generate
  3. Run: npm install
`);
}

function generate(_args: string[]): void {
  const manifest = loadFeatures();
  const deps = loadDependencies();

  if (!deps) {
    console.error('No dependencies.json found. Run: npx cue-config init');
    process.exit(1);
  }

  // Resolve all transitive dependencies
  const resolvedFeatures = resolveFeatures(deps.features, manifest);
  console.log(`Resolved features: ${resolvedFeatures.join(', ')}`);

  // Generate package.json
  const packageJson = buildPackageJson(deps, resolvedFeatures, manifest);
  writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
  console.log('Generated package.json');

  // Generate tsconfig.json
  const tsconfigName = determineTsconfig(deps, resolvedFeatures, manifest);
  if (tsconfigName) {
    const tsconfigFile = TSCONFIG_FILES[tsconfigName] ?? `${tsconfigName}.json`;
    const tsconfig = {
      $schema: 'https://json.schemastore.org/tsconfig',
      extends: `@mark1russell7/cue/ts/config/${tsconfigFile}`,
    };
    writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 2) + '\n');
    console.log(`Generated tsconfig.json (extends ${tsconfigName})`);
  }

  // Generate .gitignore
  const gitignoreContent = buildGitignore(resolvedFeatures, manifest);
  if (gitignoreContent) {
    writeFileSync('.gitignore', gitignoreContent);
    console.log('Generated .gitignore');
  }

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

  // Validate all requested features exist
  for (const feature of deps.features) {
    if (!manifest.features[feature]) {
      console.error(`Error: Unknown feature '${feature}'`);
      process.exit(1);
    }
  }

  // Validate with CUE if available
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

// Self-generate for dogfooding
function selfGenerate(): void {
  const manifest = loadFeatures();
  const deps = loadDependencies(packageRoot);

  if (!deps) {
    console.error('No dependencies.json found in package root');
    process.exit(1);
  }

  const resolvedFeatures = resolveFeatures(deps.features, manifest);
  console.log(`Self-generate: resolved features: ${resolvedFeatures.join(', ')}`);

  const packageJson = buildPackageJson(deps, resolvedFeatures, manifest);
  const outputPath = resolve(packageRoot, 'package.json');
  writeFileSync(outputPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`Generated ${outputPath}`);
}

// Main
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'init':
    init(args.slice(1));
    break;
  case 'generate':
    generate(args.slice(1));
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
