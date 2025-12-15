#!/usr/bin/env node

import { execSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Types
type ConfigType = 'esm' | 'cjs' | 'commonjs' | 'frontend' | 'browser';

interface ParsedArgs {
  _: string[];
  [key: string]: string | boolean | string[];
}

interface PackageJson {
  $schema?: string;
  name?: string;
  version?: string;
  description?: string;
  [key: string]: unknown;
}

// Constants
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '..');

const CONFIG_TYPES: readonly ConfigType[] = ['esm', 'cjs', 'commonjs', 'frontend', 'browser'] as const;

const TSCONFIG_PATHS: Record<ConfigType, string> = {
  esm: '@mark1russell7/cue/ts/config/tsconfig/esm.lib.json',
  cjs: '@mark1russell7/cue/ts/config/tsconfig/commonjs.lib.json',
  commonjs: '@mark1russell7/cue/ts/config/tsconfig/commonjs.lib.json',
  frontend: '@mark1russell7/cue/ts/config/tsconfig/frontend.json',
  browser: '@mark1russell7/cue/ts/config/tsconfig/frontend.json',
};

// Utilities
function usage(): void {
  console.log(`Usage: cue-config <command> [options]

Commands:
  init <name> [--config TYPE]   Initialize project with config.cue and tsconfig.json
  generate [--merge]            Generate package.json from config.cue
  set-tsconfig <TYPE>           Update tsconfig.json to extend a different config
  validate                      Validate config.cue against schemas

Config types: ${CONFIG_TYPES.join(', ')}

Examples:
  cue-config init my-lib                    # Initialize ESM library
  cue-config init my-app --config frontend  # Initialize frontend app
  cue-config generate                       # Generate package.json (overwrites)
  cue-config generate --merge               # Merge with existing package.json
  cue-config set-tsconfig cjs               # Switch to CommonJS config
  cue-config validate                       # Check config.cue is valid
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

function isConfigType(value: string): value is ConfigType {
  return CONFIG_TYPES.includes(value as ConfigType);
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

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const overrideValue = override[key];
    const baseValue = base[key];
    if (
      overrideValue &&
      typeof overrideValue === 'object' &&
      !Array.isArray(overrideValue) &&
      baseValue &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      result[key] = deepMerge(baseValue as Record<string, unknown>, overrideValue as Record<string, unknown>);
    } else {
      result[key] = overrideValue;
    }
  }
  return result;
}

// CUE module setup
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
      execSync(`cp -r "${packageRoot}/cue.mod" "${pkgDir}/"`, { stdio: 'ignore' });
    }
  }
}

// Commands
function init(args: string[]): void {
  const parsed = parseArgs(args, ['config']);
  const name = parsed._[0];
  const configTypeArg = typeof parsed['config'] === 'string' ? parsed['config'] : 'esm';

  if (!isConfigType(configTypeArg)) {
    console.error(`Invalid config type: ${configTypeArg}`);
    console.error(`Valid types: ${CONFIG_TYPES.join(', ')}`);
    process.exit(1);
  }

  const configType: ConfigType = configTypeArg;

  // Determine project name
  let projectName = name;
  if (!projectName) {
    if (existsSync('package.json')) {
      try {
        const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as PackageJson;
        projectName = pkg.name?.replace('@mark1russell7/', '') ?? '';
      } catch {
        // Ignore parse errors
      }
    }
    if (!projectName) {
      projectName = process.cwd().split(/[\\/]/).pop() ?? 'project';
    }
  }

  const shortName = projectName.replace('@mark1russell7/', '');

  // Create config.cue - inline values to avoid cross-package interpolation issues
  const configCue = `package config

import "mark1russell7.cue/npm/package"

// Project configuration
// Run: npx cue-config generate

output: package.#PackageJson & {
\t$schema:     "https://json.schemastore.org/package"
\tname:        "@mark1russell7/${shortName}"
\tversion:     "0.0.0"
\tdescription: "Package description"
\tlicense:     "MIT"
\tauthor:      "Mark Russell <marktheprogrammer17@gmail.com>"
\ttype:        "module"
\tmain:        "./dist/index.js"
\ttypes:       "./dist/index.d.ts"
\texports: ".": {
\t\ttypes:  "./dist/index.d.ts"
\t\timport: "./dist/index.js"
\t}
\tfiles: ["dist", "src"]
\tscripts: {
\t\tbuild:     "tsc -b"
\t\ttypecheck: "tsc --noEmit"
\t\tclean:     "rm -rf dist .tsbuildinfo"
\t}
\tsideEffects: false
\tdevDependencies: {
\t\t"@mark1russell7/cue": "github:mark1russell7/cue#main"
\t\ttypescript:          "^5.9.3"
\t}
\tkeywords: []
\trepository: {
\t\ttype: "git"
\t\turl:  "https://github.com/mark1russell7/${shortName}.git"
\t}
\tbugs: url:     "https://github.com/mark1russell7/${shortName}/issues"
\thomepage:      "https://github.com/mark1russell7/${shortName}#readme"
\tpublishConfig: access: "public"
\tengines: {
\t\tnode: ">=25.0.0"
\t\tnpm:  ">=11.0.0"
\t}
}
`;

  if (existsSync('config.cue') && !parsed['force']) {
    console.log('config.cue already exists (use --force to overwrite)');
  } else {
    writeFileSync('config.cue', configCue);
    console.log('Created config.cue');
  }

  // Create tsconfig.json
  const tsconfig = {
    $schema: 'https://json.schemastore.org/tsconfig',
    extends: TSCONFIG_PATHS[configType],
  };

  if (existsSync('tsconfig.json') && !parsed['force']) {
    console.log('tsconfig.json already exists (use --force to overwrite)');
  } else {
    writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 2) + '\n');
    console.log(`Created tsconfig.json (extends ${configType})`);
  }

  // Setup CUE module
  setupCueMod();
  console.log('Created cue.mod/');

  // Create src/index.ts if missing
  if (!existsSync('src')) {
    mkdirSync('src', { recursive: true });
  }
  if (!existsSync('src/index.ts')) {
    writeFileSync('src/index.ts', '// Entry point\nexport {};\n');
    console.log('Created src/index.ts');
  }

  // Compose .gitignore from modular parts
  const gitignoreDir = resolve(packageRoot, 'gitignore');
  const gitignoreModules = ['base', 'npm', 'typescript', 'cue'];
  if (!existsSync('.gitignore') || parsed['force']) {
    let gitignoreContent = '';
    for (const mod of gitignoreModules) {
      const modPath = resolve(gitignoreDir, mod);
      if (existsSync(modPath)) {
        gitignoreContent += readFileSync(modPath, 'utf-8');
      }
    }
    if (gitignoreContent) {
      writeFileSync('.gitignore', gitignoreContent);
      console.log('Created .gitignore');
    }
  }

  console.log(`
Next steps:
  1. Edit config.cue to customize your package
  2. Run: npx cue-config generate
  3. Run: npm install
`);
}

function generate(args: string[]): void {
  if (!checkCue()) process.exit(1);

  const parsed = parseArgs(args, []);
  const merge = parsed['merge'] === true;

  if (!existsSync('config.cue')) {
    console.error('No config.cue found. Run: npx cue-config init <name>');
    process.exit(1);
  }

  const result: SpawnSyncReturns<string> = spawnSync('cue', ['eval', 'config.cue', '-e', 'output', '--out', 'json'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    console.error('CUE evaluation failed:');
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }

  let generated: Record<string, unknown>;
  try {
    generated = JSON.parse(result.stdout) as Record<string, unknown>;
  } catch {
    console.error('Failed to parse CUE output as JSON');
    console.error(result.stdout);
    process.exit(1);
  }

  let output = generated;

  // Merge with existing if requested
  if (merge && existsSync('package.json')) {
    try {
      const existing = JSON.parse(readFileSync('package.json', 'utf-8')) as Record<string, unknown>;
      output = deepMerge(generated, existing);
      // Always use the name from CUE
      output['name'] = generated['name'];
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('Failed to read existing package.json:', message);
    }
  }

  // Write or output
  if (process.stdout.isTTY) {
    writeFileSync('package.json', JSON.stringify(output, null, 2) + '\n');
    console.log('Generated package.json');
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}

function setTsconfig(args: string[]): void {
  const configTypeArg = args[0];

  if (!configTypeArg) {
    console.error('Usage: cue-config set-tsconfig <TYPE>');
    console.error(`Types: ${CONFIG_TYPES.join(', ')}`);
    process.exit(1);
  }

  if (!isConfigType(configTypeArg)) {
    console.error(`Invalid config type: ${configTypeArg}`);
    console.error(`Valid types: ${CONFIG_TYPES.join(', ')}`);
    process.exit(1);
  }

  const configType: ConfigType = configTypeArg;

  let tsconfig: Record<string, unknown> = {};
  if (existsSync('tsconfig.json')) {
    try {
      tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf-8')) as Record<string, unknown>;
    } catch {
      // Ignore parse errors, start fresh
    }
  }

  tsconfig['$schema'] = 'https://json.schemastore.org/tsconfig';
  tsconfig['extends'] = TSCONFIG_PATHS[configType];

  writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 2) + '\n');
  console.log(`Updated tsconfig.json to extend ${configType}`);
}

function validate(): void {
  if (!checkCue()) process.exit(1);

  if (!existsSync('config.cue')) {
    console.error('No config.cue found. Run: npx cue-config init <name>');
    process.exit(1);
  }

  const result = spawnSync('cue', ['vet', 'config.cue'], { stdio: 'inherit' });

  if (result.status === 0) {
    console.log('Validation passed');
  }
  process.exit(result.status ?? 1);
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
  case 'set-tsconfig':
    setTsconfig(args.slice(1));
    break;
  case 'validate':
    validate();
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
