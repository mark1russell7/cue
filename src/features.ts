/**
 * The feature manifest of the package (`features.json`): the features, what each one needs, and
 * the presets. The `cue-config` CLI and the library entry point both use this module.
 * The resolution of the features is in `core.ts`, which has no Node.js module.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FeaturesManifest } from './core.js';

export { resolveFeatures } from './core.js';
export type { Feature, FeaturesManifest } from './core.js';

/** The root folder of the installed package (it holds `features.json`, `npm/`, `git/` and `ts/`). */
export const packageRoot: string = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** This function reads `features.json` of the package. It throws when the file is missing. */
export function readFeatures(): FeaturesManifest {
  const featuresPath = resolve(packageRoot, 'features.json');
  return JSON.parse(readFileSync(featuresPath, 'utf-8')) as FeaturesManifest;
}
