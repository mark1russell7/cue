/**
 * The core of `cue-config generate`, with no Node.js module. Thus a browser can use it too.
 *
 * The CLI and the site of the package use this module. The module resolves the features, gives the
 * CUE files and the arguments of `cue eval`, and makes the text of each generated file from the
 * output of CUE. Only the CLI starts CUE and writes the files.
 */
/** One feature: the other features that it needs. */
export interface Feature {
    dependencies: string[];
}
/** The content of `features.json`. */
export interface FeaturesManifest {
    features: Record<string, Feature>;
    presets: Record<string, string[]>;
}
/**
 * This function gives the requested features and all the features that they need (a flood
 * fill). `onUnknown` gets each requested name that the manifest does not have.
 */
export declare function resolveFeatures(requested: readonly string[], manifest: FeaturesManifest, onUnknown?: (feature: string) => void): string[];
/** The two outputs of CUE: `package` gives `package.json`, and `ignore` gives `.gitignore`. */
export type CueTarget = 'package' | 'ignore';
/** The folder of the CUE files of a target in the package, and the CUE expression that `cue eval` gives. */
export declare const cueTargets: Readonly<Record<CueTarget, {
    readonly dir: string;
    readonly expression: string;
}>>;
/** This function gives the CUE field name of a feature (`vite-react` is `viteReact`, `node-cjs` is `nodeCjs`). */
export declare function featureToFieldName(feature: string): string;
/** This function gives the name of the CUE file of a feature in the folder of a target. */
export declare function cueFileOf(feature: string, target: CueTarget): string;
/**
 * This function gives the CUE files that `generate` evaluates for the resolved features: `base.cue`,
 * then the file of each feature that has one. `has` tells if the folder of the target has a file.
 */
export declare function cueFiles(resolvedFeatures: readonly string[], target: CueTarget, has: (file: string) => boolean): string[];
/** This function gives the arguments of `cue eval` for the CUE files of a target. CUE starts in the folder of the target. */
export declare function cueEvalArgs(files: readonly string[], target: CueTarget): string[];
/** A `package.json`, as JSON. */
export interface PackageJson {
    $schema?: string;
    name?: string;
    version?: string;
    [key: string]: unknown;
}
/**
 * This function merges the `package.json` that CUE generated into the existing `package.json`
 * of a project. The result starts with `$schema`.
 */
export declare function mergePackageJson(generated: PackageJson, existingPkg: PackageJson | null): PackageJson;
/** This function gives the name of the tsconfig preset of the features (`ts` when no other one applies). */
export declare function tsconfigPresetOf(resolvedFeatures: readonly string[]): string;
/**
 * This function gives the tsconfig files that `generate` writes for the resolved features, by file
 * name. Without the `ts` feature, it gives no file. The `test` feature (opt-in) adds
 * `tsconfig.test.json`: it extends `tsconfig.json` and the preset `test.json`, which includes the
 * tests and emits nothing.
 */
export declare function generateTsconfigFiles(resolvedFeatures: readonly string[]): Record<string, string>;
/** This function gives the text of the `.gitignore` for the patterns that CUE gave. */
export declare function gitignoreText(patterns: readonly string[]): string;
/** This function gives the text of the `dependencies.json` that `init` and `add` write for the requested features. */
export declare function dependenciesJsonText(dependencies: readonly string[]): string;
/** The output of CUE for one set of features: the `package.json` (`output`) and the `.gitignore` patterns (`patterns`). */
export interface CueOutput {
    packageJson: PackageJson;
    patterns: readonly string[];
}
/**
 * This function gives the files that `generate` writes, by file name, in the sequence of the CLI:
 * `package.json`, the tsconfig files, then `.gitignore`. `existingPkg` is the `package.json` of the project, or null.
 */
export declare function generateFiles(resolvedFeatures: readonly string[], cue: CueOutput, existingPkg: PackageJson | null): Record<string, string>;
//# sourceMappingURL=core.d.ts.map