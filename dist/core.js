/**
 * The core of `cue-config generate`, with no Node.js module. Thus a browser can use it too.
 *
 * The CLI and the site of the package use this module. The module resolves the features, gives the
 * CUE files and the arguments of `cue eval`, and makes the text of each generated file from the
 * output of CUE. Only the CLI starts CUE and writes the files.
 */
/**
 * This function gives the requested features and all the features that they need (a flood
 * fill). `onUnknown` gets each requested name that the manifest does not have.
 */
export function resolveFeatures(requested, manifest, onUnknown = () => { }) {
    const resolved = new Set();
    const queue = [...requested];
    while (queue.length > 0) {
        const feature = queue.shift();
        if (resolved.has(feature))
            continue;
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
/** The folder of the CUE files of a target in the package, and the CUE expression that `cue eval` gives. */
export const cueTargets = {
    package: { dir: 'npm/package', expression: 'output' },
    ignore: { dir: 'git/ignore', expression: 'patterns' },
};
/** This function gives the CUE field name of a feature (`vite-react` is `viteReact`, `node-cjs` is `nodeCjs`). */
export function featureToFieldName(feature) {
    if (feature === 'vite-react')
        return 'viteReact';
    if (feature === 'node-cjs')
        return 'nodeCjs';
    return feature;
}
/** This function gives the name of the CUE file of a feature in the folder of a target. */
export function cueFileOf(feature, target) {
    return `${target === 'package' ? featureToFieldName(feature) : feature}.cue`;
}
/**
 * This function gives the CUE files that `generate` evaluates for the resolved features: `base.cue`,
 * then the file of each feature that has one. `has` tells if the folder of the target has a file.
 */
export function cueFiles(resolvedFeatures, target, has) {
    const files = ['base.cue'];
    for (const feature of resolvedFeatures) {
        const file = cueFileOf(feature, target);
        if (has(file))
            files.push(file);
    }
    return files;
}
/** This function gives the arguments of `cue eval` for the CUE files of a target. CUE starts in the folder of the target. */
export function cueEvalArgs(files, target) {
    return ['eval', ...files, '-e', cueTargets[target].expression, '--out', 'json'];
}
/**
 * The fields that the package owns. A generated value is only a default for a package that does
 * not have the field. The function `mergeType` merges `type`.
 */
const OWNED_FIELDS = ['exports', 'main', 'types', 'bin', 'sideEffects'];
/**
 * This function gives the merged `type`. A generated `module` replaces the type of the package.
 * The `ts` feature (`ts.json`, `verbatimModuleSyntax`) compiles ES modules, and `tsc` cannot compile
 * a CommonJS package with it. For example, `npm init` writes `"type": "commonjs"`.
 * A generated `commonjs` (the `node-cjs` feature) is only a default. `node-cjs.json` (module
 * `NodeNext`) follows the type of the package, so a package keeps its type.
 */
function mergeType(generated, existing) {
    if (generated === 'module' || existing === undefined)
        return generated;
    return existing;
}
/**
 * The scripts that earlier versions of `generate` wrote, by name. An existing script with one of
 * these values is a generated value, not a value of the package. Thus the generated script
 * replaces it. When a package adds the `test` feature, its `typecheck` and `test` scripts get the
 * new values. Without the `test` feature, the generated values are these values, so nothing changes.
 */
const OLD_GENERATED_SCRIPTS = {
    typecheck: ['tsc --noEmit'],
    test: ['vitest run --passWithNoTests'],
};
/**
 * This function merges the generated scripts into the existing scripts. An existing script wins,
 * but a script with an old generated value (`OLD_GENERATED_SCRIPTS`) gets the generated value.
 */
function mergeScripts(generated, existing) {
    const merged = { ...generated, ...existing };
    for (const [name, value] of Object.entries(generated)) {
        const current = existing?.[name];
        if (typeof current === 'string' && OLD_GENERATED_SCRIPTS[name]?.includes(current))
            merged[name] = value;
    }
    return merged;
}
/**
 * This function merges the `package.json` that CUE generated into the existing `package.json`
 * of a project. The result starts with `$schema`.
 */
export function mergePackageJson(generated, existingPkg) {
    const pkg = { ...existingPkg };
    // Apply generated values (existing values take precedence for some fields)
    for (const [key, value] of Object.entries(generated)) {
        if (key === 'name' || key === 'version' || key === 'description') {
            // Keep existing if present
            if (!pkg[key])
                pkg[key] = value;
        }
        else if (key === 'scripts') {
            pkg[key] = mergeScripts(value, pkg[key]);
        }
        else if (key === 'devDependencies' || key === 'peerDependencies') {
            // Merge objects
            pkg[key] = { ...value, ...(pkg[key] ?? {}) };
        }
        else if (key === 'files' && Array.isArray(value) && Array.isArray(pkg[key])) {
            // Merge arrays (deduplicated, generated first then existing)
            const merged = [...value];
            for (const item of pkg[key]) {
                if (!merged.includes(item))
                    merged.push(item);
            }
            pkg[key] = merged;
        }
        else if (key === 'type') {
            pkg[key] = mergeType(value, pkg[key]);
        }
        else if (OWNED_FIELDS.includes(key)) {
            // The package owns its entry points: the generated value is only a default.
            // (A generated "exports" with only "." used to replace a package's other entry points.)
            if (pkg[key] === undefined)
                pkg[key] = value;
        }
        else {
            // Generated values take precedence for other fields (for example, engines)
            pkg[key] = value;
        }
    }
    // Ensure $schema is first
    const ordered = { $schema: 'https://json.schemastore.org/package' };
    for (const [key, value] of Object.entries(pkg)) {
        if (key !== '$schema')
            ordered[key] = value;
    }
    return ordered;
}
// ============================================================================
// tsconfig.json, .gitignore and dependencies.json
// ============================================================================
/** The features with a tsconfig preset. A later feature wins: it is more specific. */
const TSCONFIG_PRIORITY = ['ts', 'node', 'node-cjs', 'vite', 'react'];
/** This function gives the name of the tsconfig preset of the features (`ts` when no other one applies). */
export function tsconfigPresetOf(resolvedFeatures) {
    let selected = 'ts';
    for (const feature of TSCONFIG_PRIORITY) {
        if (resolvedFeatures.includes(feature))
            selected = feature;
    }
    return selected;
}
/**
 * This function gives the tsconfig files that `generate` writes for the resolved features, by file
 * name. Without the `ts` feature, it gives no file. The `test` feature (opt-in) adds
 * `tsconfig.test.json`: it extends `tsconfig.json` and the preset `test.json`, which includes the
 * tests and emits nothing.
 */
export function generateTsconfigFiles(resolvedFeatures) {
    const files = {};
    if (!resolvedFeatures.includes('ts'))
        return files;
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
export function gitignoreText(patterns) {
    return patterns.join('\n') + '\n';
}
/** This function gives the text of the `dependencies.json` that `init` and `add` write for the requested features. */
export function dependenciesJsonText(dependencies) {
    const depsJson = {
        $schema: './node_modules/@mark1russell7/cue/dependencies/schema.json',
        dependencies,
    };
    return JSON.stringify(depsJson, null, 2) + '\n';
}
/**
 * This function gives the files that `generate` writes, by file name, in the sequence of the CLI:
 * `package.json`, the tsconfig files, then `.gitignore`. `existingPkg` is the `package.json` of the project, or null.
 */
export function generateFiles(resolvedFeatures, cue, existingPkg) {
    return {
        'package.json': JSON.stringify(mergePackageJson(cue.packageJson, existingPkg), null, 2) + '\n',
        ...generateTsconfigFiles(resolvedFeatures),
        '.gitignore': gitignoreText(cue.patterns),
    };
}
//# sourceMappingURL=core.js.map