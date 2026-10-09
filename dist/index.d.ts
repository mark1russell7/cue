/**
 * The library entry point of `@mark1russell7/cue`.
 *
 * Most users run the `cue-config` CLI. This entry point gives the same feature data to code: the
 * features and presets of `features.json`, the resolution of the features that a project needs,
 * and the paths of the configuration files in the package.
 */
import { packageRoot, readFeatures, resolveFeatures, type FeaturesManifest } from './features.js';
export { packageRoot, readFeatures, resolveFeatures };
export type { Feature, FeaturesManifest } from './features.js';
/** The names of the tsconfig presets in `ts/config` (for `"extends": "@mark1russell7/cue/ts/config/<name>.json"`). */
export declare const tsconfigPresets: readonly ["base", "esm", "cjs", "lib", "ts", "node", "node-cjs", "vite", "react"];
/** One name of `tsconfigPresets`. */
export type TsconfigPreset = (typeof tsconfigPresets)[number];
/** This function gives the absolute path of a tsconfig preset of the package. */
export declare function tsconfigPresetPath(name: TsconfigPreset): string;
/**
 * This function gives the features of a preset (for example `lib`) with all the features that
 * they need. It throws for an unknown preset.
 */
export declare function presetFeatures(preset: string, manifest?: FeaturesManifest): string[];
//# sourceMappingURL=index.d.ts.map