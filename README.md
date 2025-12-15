# @mark1russell7/cue

CUE-driven configuration generation for TypeScript projects. Define your features in `dependencies.json`, run `cue-config generate`, and get a complete project setup.

## Installation

```bash
npm install --save-dev @mark1russell7/cue
# or from GitHub
npm install --save-dev github:mark1russell7/cue#main
```

Requires [CUE](https://cuelang.org/docs/install/) to be installed.

## Quick Start

```bash
# Initialize with default preset (lib)
npx cue-config init

# Or with a specific preset
npx cue-config init --preset react-lib

# Generate all config files
npx cue-config generate

# Install dependencies
npm install
```

## How It Works

1. **dependencies.json** - Declares which features your project needs
2. **features.json** - Defines the dependency graph between features (in the cue package)
3. **CUE files** - Each feature contributes config via CUE unification
4. **cue-config generate** - Shells out to `cue eval` and generates all configs

### dependencies.json

```json
{
  "$schema": "./node_modules/@mark1russell7/cue/dependencies/schema.json",
  "dependencies": ["ts", "node", "cue"]
}
```

### Available Features

| Feature | Dependencies | Description |
|---------|--------------|-------------|
| `git` | - | Base gitignore patterns |
| `npm` | git | Node.js package setup |
| `ts` | npm | TypeScript configuration |
| `node` | ts | Node.js specific (@types/node) |
| `react` | ts | React types + peer dependencies |
| `vite` | ts | Vite bundler setup |
| `vite-react` | vite, react | Vite + React app |
| `cue` | npm | CUE module setup |

### Presets

| Preset | Features | Use Case |
|--------|----------|----------|
| `lib` | ts, cue | TypeScript library |
| `react-lib` | react, cue | React component library |
| `app` | vite-react, cue | Vite + React application |

## Commands

```bash
cue-config init [--preset NAME]   # Create dependencies.json (default: lib)
cue-config add <feature>          # Add a feature
cue-config remove <feature>       # Remove a feature
cue-config generate               # Generate package.json, tsconfig.json, .gitignore
cue-config validate               # Validate dependencies.json
```

## Generated Files

### package.json

Generated via CUE from `npm/package/*.cue`. Each feature contributes its config:

- **ts.cue** - type: module, exports, build scripts, typescript devDep
- **node.cue** - @types/node devDep
- **react.cue** - @types/react devDep, react peerDep
- **cue.cue** - @mark1russell7/cue devDep

Existing values in package.json are preserved for name, version, description. Objects like devDependencies and scripts are merged.

### tsconfig.json

Extends a pre-built config based on your most specific feature:

| Feature | Extends |
|---------|---------|
| `ts` | `@mark1russell7/cue/ts/config/ts.json` |
| `node` | `@mark1russell7/cue/ts/config/node.json` |
| `vite` | `@mark1russell7/cue/ts/config/vite.json` |
| `react` | `@mark1russell7/cue/ts/config/react.json` |

Priority: ts < node < vite < react (most specific wins)

### .gitignore

Generated via CUE from `git/ignore/*.cue`. Patterns are collected from each feature and concatenated.

## Project Structure

```
@mark1russell7/cue/
├── features.json           # Feature dependency graph
├── dependencies.json       # Self: ["ts", "node"]
│
├── git/ignore/             # .gitignore generation
│   ├── base.cue            # Always included
│   ├── npm.cue             # node_modules, etc.
│   ├── ts.cue              # dist/, *.tsbuildinfo
│   └── ...
│
├── npm/package/            # package.json generation
│   ├── base.cue            # Schema + base fields
│   ├── ts.cue              # TypeScript config
│   ├── node.cue            # Node.js types
│   ├── react.cue           # React types + peer deps
│   └── ...
│
├── ts/config/              # Pre-built tsconfigs
│   ├── base.json           # Hyper-strict base settings
│   ├── ts.json             # Default TypeScript lib
│   ├── node.json           # Node.js specific
│   ├── vite.json           # Vite/bundler config
│   └── react.json          # React JSX config
│
├── dependencies/
│   └── schema.cue          # Validates dependencies.json
│
└── src/cli.ts              # CLI source
```

## Requirements

- Node.js >= 25.0.0
- npm >= 11.0.0
- [CUE](https://cuelang.org/docs/install/)

## Dogfooding

This package generates its own config:

```bash
npm run generate:self
```
