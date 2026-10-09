/**
 * The feature manifest of the package (`features.json`): the features, what each one needs, and
 * the presets. The `cue-config` CLI and the library entry point both use this module.
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
/** The root folder of the installed package (it holds `features.json`, `npm/`, `git/` and `ts/`). */
export declare const packageRoot: string;
/** This function reads `features.json` of the package. It throws when the file is missing. */
export declare function readFeatures(): FeaturesManifest;
/**
 * This function gives the requested features and all the features that they need (a flood
 * fill). `onUnknown` gets each requested name that the manifest does not have.
 */
export declare function resolveFeatures(requested: readonly string[], manifest: FeaturesManifest, onUnknown?: (feature: string) => void): string[];
//# sourceMappingURL=features.d.ts.map