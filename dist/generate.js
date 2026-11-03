/**
 * The parts of `cue-config generate` that do not start CUE: the merge of a generated
 * `package.json` into the existing one, the tsconfig files, and the link `cue.mod/pkg/mark1russell7.cue`
 * to the package. The merge and the tsconfig files are in `core.ts`, which has no Node.js module.
 */
import { cpSync, lstatSync, mkdirSync, realpathSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export { generateTsconfigFiles, mergePackageJson, tsconfigPresetOf } from './core.js';
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