/**
 * The parts of `cue-config generate` that do not start CUE: the merge of a generated
 * `package.json` into the existing one, and the link `cue.mod/pkg/mark1russell7.cue` to the package.
 */
import { cpSync, lstatSync, mkdirSync, realpathSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
/**
 * The fields that the package owns. A generated value is only a default for a package that does
 * not have the field. `type` is in the list because it tells how Node.js reads the entry points.
 */
const OWNED_FIELDS = ['exports', 'main', 'types', 'bin', 'sideEffects', 'type'];
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
        else if (key === 'devDependencies' || key === 'peerDependencies' || key === 'scripts') {
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
        else if (OWNED_FIELDS.includes(key)) {
            // The package owns its entry points and its module type: the generated value is only a default.
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