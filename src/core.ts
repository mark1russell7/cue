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

// ============================================================================
// CUE: the files and the arguments of `cue eval`
// ============================================================================

/** The two outputs of CUE: `package` gives `package.json`, and `ignore` gives `.gitignore`. */
export type CueTarget = 'package' | 'ignore';

/** The folder of the CUE files of a target in the package, and the CUE expression that `cue eval` gives. */
export const cueTargets: Readonly<Record<CueTarget, { readonly dir: string; readonly expression: string }>> = {
  package: { dir: 'npm/package', expression: 'output' },
  ignore: { dir: 'git/ignore', expression: 'patterns' },
};

/** This function gives the CUE field name of a feature (`vite-react` is `viteReact`, `node-cjs` is `nodeCjs`). */
export function featureToFieldName(feature: string): string {
  if (feature === 'vite-react') return 'viteReact';
  if (feature === 'node-cjs') return 'nodeCjs';
  return feature;
}

/** This function gives the name of the CUE file of a feature in the folder of a target. */
export function cueFileOf(feature: string, target: CueTarget): string {
  return `${target === 'package' ? featureToFieldName(feature) : feature}.cue`;
}

/**
 * This function gives the CUE files that `generate` evaluates for the resolved features: `base.cue`,
 * then the file of each feature that has one. `has` tells if the folder of the target has a file.
 */
export function cueFiles(resolvedFeatures: readonly string[], target: CueTarget, has: (file: string) => boolean): string[] {
  const files = ['base.cue'];
  for (const feature of resolvedFeatures) {
    const file = cueFileOf(feature, target);
    if (has(file)) files.push(file);
  }
  return files;
}

/** This function gives the arguments of `cue eval` for the CUE files of a target. CUE starts in the folder of the target. */
export function cueEvalArgs(files: readonly string[], target: CueTarget): string[] {
  return ['eval', ...files, '-e', cueTargets[target].expression, '--out', 'json'];
}

// ============================================================================
// package.json
// ============================================================================

/** A `package.json`, as JSON. */
export interface PackageJson {
  $schema?: string;
  name?: string;
  version?: string;
  [key: string]: unknown;
}

/**
 * The fields that the package owns. A generated value is only a default for a package that does
 * not have the field. The function `mergeType` merges `type`.
 */
const OWNED_FIELDS: readonly string[] = ['exports', 'main', 'types', 'bin', 'sideEffects'];

/**
 * This function gives the merged `type`. A generated `module` replaces the type of the package.
 * The `ts` feature (`ts.json`, `verbatimModuleSyntax`) compiles ES modules, and `tsc` cannot compile
 * a CommonJS package with it. For example, `npm init` writes `"type": "commonjs"`.
 * A generated `commonjs` (the `node-cjs` feature) is only a default. `node-cjs.json` (module
 * `NodeNext`) follows the type of the package, so a package keeps its type.
 */
function mergeType(generated: unknown, existing: unknown): unknown {
  if (generated === 'module' || existing === undefined) return generated;
  return existing;
}

/**
 * The scripts that earlier versions of `generate` wrote, by name. An existing script with one of
 * these values is a generated value, not a value of the package. Thus the generated script
 * replaces it. When a package adds the `test` feature, its `typecheck` and `test` scripts get the
 * new values. Without the `test` feature, the generated values are these values, so nothing changes.
 */
const OLD_GENERATED_SCRIPTS: Readonly<Record<string, readonly string[]>> = {
  typecheck: ['tsc --noEmit'],
  test: ['vitest run --passWithNoTests'],
};

/**
 * This function merges the generated scripts into the existing scripts. An existing script wins,
 * but a script with an old generated value (`OLD_GENERATED_SCRIPTS`) gets the generated value.
 */
function mergeScripts(generated: Record<string, unknown>, existing: Record<string, unknown> | undefined): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...generated, ...existing };
  for (const [name, value] of Object.entries(generated)) {
    const current = existing?.[name];
    if (typeof current === 'string' && OLD_GENERATED_SCRIPTS[name]?.includes(current)) merged[name] = value;
  }
  return merged;
}

/**
 * This function merges the `package.json` that CUE generated into the existing `package.json`
 * of a project. The result starts with `$schema`.
 */
export function mergePackageJson(generated: PackageJson, existingPkg: PackageJson | null): PackageJson {
  const pkg: PackageJson = { ...existingPkg };

  // Apply generated values (existing values take precedence for some fields)
  for (const [key, value] of Object.entries(generated)) {
    if (key === 'name' || key === 'version' || key === 'description') {
      // Keep existing if present
      if (!pkg[key]) pkg[key] = value as string;
    } else if (key === 'scripts') {
      pkg[key] = mergeScripts(value as Record<string, unknown>, pkg[key] as Record<string, unknown> | undefined);
    } else if (key === 'devDependencies' || key === 'peerDependencies') {
      // Merge objects
      pkg[key] = { ...(value as Record<string, unknown>), ...(pkg[key] as Record<string, unknown> ?? {}) };
    } else if (key === 'files' && Array.isArray(value) && Array.isArray(pkg[key])) {
      // Merge arrays (deduplicated, generated first then existing)
      const merged = [...(value as string[])];
      for (const item of pkg[key] as string[]) {
        if (!merged.includes(item)) merged.push(item);
      }
      pkg[key] = merged;
    } else if (key === 'type') {
      pkg[key] = mergeType(value, pkg[key]);
    } else if (OWNED_FIELDS.includes(key)) {
      // The package owns its entry points: the generated value is only a default.
      // (A generated "exports" with only "." used to replace a package's other entry points.)
      if (pkg[key] === undefined) pkg[key] = value;
    } else {
      // Generated values take precedence for other fields (for example, engines)
      pkg[key] = value;
    }
  }

  // Ensure $schema is first
  const ordered: PackageJson = { $schema: 'https://json.schemastore.org/package' };
  for (const [key, value] of Object.entries(pkg)) {
    if (key !== '$schema') ordered[key] = value;
  }
  return ordered;
}

// ============================================================================
// tsconfig.json, .gitignore and dependencies.json
// ============================================================================

/** The features with a tsconfig preset. A later feature wins: it is more specific. */
const TSCONFIG_PRIORITY: readonly string[] = ['ts', 'node', 'node-cjs', 'vite', 'react'];

/** This function gives the name of the tsconfig preset of the features (`ts` when no other one applies). */
export function tsconfigPresetOf(resolvedFeatures: readonly string[]): string {
  let selected = 'ts';
  for (const feature of TSCONFIG_PRIORITY) {
    if (resolvedFeatures.includes(feature)) selected = feature;
  }
  return selected;
}

/**
 * This function gives the tsconfig files that `generate` writes for the resolved features, by file
 * name. Without the `ts` feature, it gives no file. The `test` feature (opt-in) adds
 * `tsconfig.test.json`: it extends `tsconfig.json` and the preset `test.json`, which includes the
 * tests and emits nothing.
 */
export function generateTsconfigFiles(resolvedFeatures: readonly string[]): Record<string, string> {
  const files: Record<string, string> = {};
  if (!resolvedFeatures.includes('ts')) return files;
  const tsconfig = {
    $schema: 'https://json.schemastore.org/tsconfig',
    extends: `@mark1russell7/cue/ts/config/${tsconfigPresetOf(resolvedFeatures)}.json`,
  };
  files['tsconfig.json'] = JSON.stringify(tsconfig, null, 2) + '\n';
  if (resolvedFeatures.includes('test')) {
    const tsconfigTest = {
      $schema: 'https://json.schemastore.org/tsconfig',
      extends: ['./tsconfig.json', '@mark1russell7/cue/ts/config/test.json'],
    };
    files['tsconfig.test.json'] = JSON.stringify(tsconfigTest, null, 2) + '\n';
  }
  return files;
}

/** This function gives the text of the `.gitignore` for the patterns that CUE gave. */
export function gitignoreText(patterns: readonly string[]): string {
  return patterns.join('\n') + '\n';
}

/** This function gives the text of the `dependencies.json` that `init` and `add` write for the requested features. */
export function dependenciesJsonText(dependencies: readonly string[]): string {
  const depsJson = {
    $schema: './node_modules/@mark1russell7/cue/dependencies/schema.json',
    dependencies,
  };
  return JSON.stringify(depsJson, null, 2) + '\n';
}

/** The output of CUE for one set of features: the `package.json` (`output`) and the `.gitignore` patterns (`patterns`). */
export interface CueOutput {
  packageJson: PackageJson;
  patterns: readonly string[];
}

/**
 * This function gives the files that `generate` writes, by file name, in the sequence of the CLI:
 * `package.json`, the tsconfig files, then `.gitignore`. `existingPkg` is the `package.json` of the project, or null.
 */
export function generateFiles(resolvedFeatures: readonly string[], cue: CueOutput, existingPkg: PackageJson | null): Record<string, string> {
  return {
    'package.json': JSON.stringify(mergePackageJson(cue.packageJson, existingPkg), null, 2) + '\n',
    ...generateTsconfigFiles(resolvedFeatures),
    '.gitignore': gitignoreText(cue.patterns),
  };
}
