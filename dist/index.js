/**
 * The library entry point of `@mark1russell7/cue`.
 *
 * Most users run the `cue-config` CLI. This entry point gives the same feature data to code: the
 * features and presets of `features.json`, the resolution of the features that a project needs,
 * and the paths of the configuration files in the package.
 */
import { resolve } from 'node:path';
import { packageRoot, readFeatures, resolveFeatures } from './features.js';
export { packageRoot, readFeatures, resolveFeatures };
/**
 * The names of the tsconfig presets in `ts/config` (for `"extends": "@mark1russell7/cue/ts/config/<name>.json"`).
 * `test` is not a full config: `tsconfig.test.json` extends `tsconfig.json` and then `test.json`.
 */
export const tsconfigPresets = ['base', 'esm', 'cjs', 'lib', 'ts', 'node', 'node-cjs', 'vite', 'react', 'test'];
/** This function gives the absolute path of a tsconfig preset of the package. */
export function tsconfigPresetPath(name) {
    return resolve(packageRoot, 'ts', 'config', `${name}.json`);
}
/**
 * This function gives the features of a preset (for example `lib`) with all the features that
 * they need. It throws for an unknown preset.
 */
export function presetFeatures(preset, manifest = readFeatures()) {
    const features = manifest.presets[preset];
    if (!features) {
        throw new Error(`Unknown preset '${preset}'. The presets are: ${Object.keys(manifest.presets).join(', ')}`);
    }
    return resolveFeatures(features, manifest);
}
//# sourceMappingURL=index.js.map