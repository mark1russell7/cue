# Change history

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
