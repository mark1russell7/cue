/**
 * The parts of `cue-config generate` that do not start CUE: the merge of a generated
 * `package.json` into the existing one, and the link `cue.mod/pkg/mark1russell7.cue` to the package.
 */
import { cpSync, lstatSync, mkdirSync, realpathSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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
/** The real path of `path`, or null when it does not exist (for example a link to a removed folder). */
function realPath(path) {
    try {
        return realpathSync(path);
    }
    catch {
        return null;
    }
}
/**
 * This function makes `pkgDir` a link to `target`: a junction on Windows, a symbolic link on other
 * systems. It replaces a link to a different folder and a link to a folder that does not exist.
 * Under pnpm, the path of the package changes with each version, so an old link goes stale.
 * When the system cannot make a link, the function copies the CUE folders of the package.
 */
export function linkCuePackage(pkgDir, target) {
    const existing = lstatSync(pkgDir, { throwIfNoEntry: false });
    if (existing?.isSymbolicLink()) {
        if (realPath(pkgDir) === realPath(target))
            return;
        // A stale link: it goes to an old version of the package, or to a folder that does not exist
        unlinkSync(pkgDir);
    }
    else if (existing) {
        // A folder (a copy from an earlier fallback) or a file: keep it, as before
        return;
    }
    mkdirSync(dirname(pkgDir), { recursive: true });
    try {
        symlinkSync(target, pkgDir, process.platform === 'win32' ? 'junction' : 'dir');
    }
    catch {
        // Fall back to a copy. fs.cpSync instead of 'cp -r', which a Windows shell does not have.
        mkdirSync(pkgDir, { recursive: true });
        for (const dir of ['ts', 'npm', 'git']) {
            cpSync(resolve(target, dir), resolve(pkgDir, dir), { recursive: true });
        }
    }
}
//# sourceMappingURL=generate.js.map