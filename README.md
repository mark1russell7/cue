# @mark1russell7/cue

Shared CUE schemas, TypeScript configs, and project templates.

## Installation

```bash
npm install --save-dev github:mark1russell7/cue#main
```

## Quick Start

```bash
# Initialize a new TypeScript project
npx cue-config init my-lib

# Generate package.json from config.cue
npx cue-config generate > package.json

# Install dependencies
npm install
```

## Commands

| Command | Description |
|---------|-------------|
| `cue-config init <name> [--config TYPE]` | Initialize project with config.cue, tsconfig.json, .gitignore |
| `cue-config generate [--merge]` | Generate package.json from config.cue |
| `cue-config set-tsconfig <TYPE>` | Update tsconfig.json to extend a different config |
| `cue-config validate` | Validate config.cue against schemas |

### Config Types

| Type | Use Case |
|------|----------|
| `esm` | Node.js ESM packages (default) |
| `cjs` | Node.js CommonJS packages |
| `frontend` | Browser/React apps with bundler |

## What Gets Created

Running `cue-config init my-lib` creates:

- **config.cue** - CUE configuration for package.json (edit to customize)
- **tsconfig.json** - Extends from `@mark1russell7/cue/ts/config/tsconfig/esm.lib.json`
- **cue.mod/** - CUE module setup (links to installed package)
- **.gitignore** - Composed from modular gitignore templates
- **src/index.ts** - Entry point (if missing)

## Customizing config.cue

Edit `config.cue` to customize your package:

```cue
package config

import "mark1russell7.cue/npm/package"

output: package.#PackageJson & {
    $schema:     "https://json.schemastore.org/package"
    name:        "@mark1russell7/my-lib"
    version:     "0.0.0"
    description: "My awesome library"  // <- customize
    // ... other fields

    dependencies: {
        "lodash": "^4.17.21"  // <- add dependencies
    }
}
```

Then regenerate: `npx cue-config generate > package.json`

## Project Structure

```
@mark1russell7/cue/
├── npm/package/
│   ├── schema.cue        # Base package.json schema
│   ├── ts.cue            # TypeScript-specific additions
│   └── templates.cue     # Templates
├── ts/config/tsconfig/
│   ├── shared.json       # Hyper-strict base settings
│   ├── esm.lib.json      # ESM library config
│   ├── commonjs.lib.json # CommonJS library config
│   └── frontend.json     # Browser/React config
├── gitignore/
│   ├── base              # OS, editors
│   ├── npm               # node_modules
│   ├── typescript        # dist, .tsbuildinfo
│   ├── cue               # cue.mod/pkg
│   └── ...
└── src/cli.ts            # CLI source
```

## Modular Gitignore

The `.gitignore` is composed from modular parts in `gitignore/`:

- **base** - OS files (.DS_Store, Thumbs.db), editor files
- **npm** - node_modules, npm logs
- **typescript** - dist/, *.tsbuildinfo
- **cue** - cue.mod/pkg/ (regenerated on install)
- **vscode** - .vscode/
- **env** - .env files

## Requirements

- Node.js >= 25.0.0
- npm >= 11.0.0
- [CUE](https://cuelang.org/docs/install/) (for config generation)

## Dogfooding

This package uses itself - `package.json` is generated from CUE:

```bash
npm run generate:self
```
