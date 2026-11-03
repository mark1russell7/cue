/**
 * The parts of `cue-config generate` that do not start CUE: the merge of a generated
 * `package.json` into the existing one, the tsconfig files, and the link `cue.mod/pkg/mark1russell7.cue`
 * to the package. The merge and the tsconfig files are in `core.ts`, which has no Node.js module.
 */
export { generateTsconfigFiles, mergePackageJson, tsconfigPresetOf } from './core.js';
export type { PackageJson } from './core.js';
/**
 * This function makes `pkgDir` a link to `target`: a junction on Windows, a symbolic link on other
 * systems. It replaces a link to a different folder and a link to a folder that does not exist.
 * Under pnpm, the path of the package changes with each version, so an old link goes stale.
 * When the system cannot make a link, the function copies the CUE folders of the package.
 */
export declare function linkCuePackage(pkgDir: string, target: string): void;
//# sourceMappingURL=generate.d.ts.map