/**
 * The feature manifest of the package (`features.json`): the features, what each one needs, and
 * the presets. The `cue-config` CLI and the library entry point both use this module.
 * The resolution of the features is in `core.ts`, which has no Node.js module.
 */
import type { FeaturesManifest } from './core.js';
export { resolveFeatures } from './core.js';
export type { Feature, FeaturesManifest } from './core.js';
/** The root folder of the installed package (it holds `features.json`, `npm/`, `git/` and `ts/`). */
export declare const packageRoot: string;
/** This function reads `features.json` of the package. It throws when the file is missing. */
export declare function readFeatures(): FeaturesManifest;
//# sourceMappingURL=features.d.ts.map