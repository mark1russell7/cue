# Change history

## 1.0.2

### Corrections

- `generate` gives the type `module` of the `ts` feature to a package that has the type `commonjs`. For example, `npm init` writes `"type": "commonjs"`. In 1.0.1, `generate` kept that type, and `tsc` (`ts.json`, `verbatimModuleSyntax`) did not compile the package. A generated `commonjs` (the `node-cjs` feature) is still only a default, so a `node-cjs` package with the type `module` keeps its type.

## 1.0.1

### Corrections

- The `node-cjs` feature makes a CommonJS package. Before, the `ts` feature always set `"type": "module"`, so `tsc` (module `NodeNext`) emitted ES modules. The new file `npm/package/nodeCjs.cue` sets `"type": "commonjs"` and adds a `require` condition to `exports["."]`.
- `generate` keeps the `type` of an existing `package.json`, as it keeps the entry points. Before, the generated `type` replaced it. Thus `generate` does not change the `type` of a package that has one.
- `generate` makes the link `cue.mod/pkg/mark1russell7.cue` again when it goes to a different folder or to a folder that does not exist. Under pnpm, the path of the package changes with each version. Before, a stale link stopped `generate` with an error, after it wrote `package.json`, `tsconfig.json` and `.gitignore`.
- `pnpm test` starts the tests of the merge, of the link and of the CUE files of the features (`test/`). The CUE tests need the `cue` CLI.

## 1.0.0

The first version on npm. Before, projects installed the package from GitHub (`github:mark1russell7/cue`).

`@mark1russell7/cue` generates the configuration files of a TypeScript project from a list of features. A project lists its features in `dependencies.json` (for example `ts`, `node`, `vitest`). The `cue-config` CLI resolves the features that they need, evaluates the CUE files of the package, and writes `package.json`, `tsconfig.json` and `.gitignore`. CUE schemas validate the result.

### Functions

- The `cue-config` CLI: `init` (with the presets `lib`, `react-lib` and `app`), `add`, `remove`, `generate`, `validate`, `validate-manifest` and `validate-structure`.
- The features `git`, `npm`, `ts`, `node`, `node-cjs`, `react`, `vite`, `vite-react`, `cue` and `vitest`.
- Shared tsconfig presets in `ts/config/` (`base`, `esm`, `cjs`, `lib`, `ts`, `node`, `node-cjs`, `vite`, `react`).
- A library entry point: `readFeatures`, `resolveFeatures`, `presetFeatures`, `tsconfigPresetPath`, `tsconfigPresets` and `packageRoot`.

### Corrections

- `generate` keeps the entry points of a package (`exports`, `main`, `types`, `bin`, `sideEffects`). Before, a generated `exports` with only `.` replaced the other entry points of a package.
- The `vitest` feature has a CUE file (it adds the `vitest` dev dependency and the `test` script) and a schema entry. Before, it generated nothing, and `cue-config validate` refused what `cue-config init` wrote.
- The setup of `cue.mod` links the package with `fs.symlinkSync` (a junction on Windows) and copies it with `fs.cpSync`. Before, it ran shell commands that Windows does not have.
- The `node` preset adds the Node.js types.
- `generate` no longer writes `pnpm.onlyBuiltDependencies`, which pnpm 11 and later ignore in `package.json`.
- The library entry point exists. Before, `main` and `exports["."]` named `dist/index.js`, and the package did not have that file.
