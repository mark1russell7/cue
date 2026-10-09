/**
 * The feature manifest of the package (`features.json`): the features, what each one needs, and
 * the presets. The `cue-config` CLI and the library entry point both use this module.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
export const packageRoot: string = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** This function reads `features.json` of the package. It throws when the file is missing. */
export function readFeatures(): FeaturesManifest {
  const featuresPath = resolve(packageRoot, 'features.json');
  return JSON.parse(readFileSync(featuresPath, 'utf-8')) as FeaturesManifest;
}

/**
 * This function gives the requested features and all the features that they need (a flood
 * fill). `onUnknown` gets each requested name that the manifest does not have.
 */
export function resolveFeatures(
  requested: readonly string[],
  manifest: FeaturesManifest,
  onUnknown: (feature: string) => void = () => {}
): string[] {
  const resolved = new Set<string>();
  const queue = [...requested];

  while (queue.length > 0) {
    const feature = queue.shift()!;
    if (resolved.has(feature)) continue;

    const featureDef = manifest.features[feature];
    if (!featureDef) {
      onUnknown(feature);
      continue;
    }

    resolved.add(feature);

    for (const dep of featureDef.dependencies) {
      if (!resolved.has(dep)) {
        queue.push(dep);
      }
    }
  }

  return Array.from(resolved);
}
