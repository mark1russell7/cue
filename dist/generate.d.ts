/**
 * The parts of `cue-config generate` that do not start CUE: the merge of a generated
 * `package.json` into the existing one, and the link `cue.mod/pkg/mark1russell7.cue` to the package.
 */
/** A `package.json`, as JSON. */
export interface PackageJson {
    $schema?: string;
    name?: string;
    version?: string;
    [key: string]: unknown;
}
/**
 * This function merges the `package.json` that CUE generated into the existing `package.json`
 * of a project. The result starts with `$schema`.
 */
export declare function mergePackageJson(generated: PackageJson, existingPkg: PackageJson | null): PackageJson;
/**
 * This function makes `pkgDir` a link to `target`: a junction on Windows, a symbolic link on other
 * systems. It replaces a link to a different folder and a link to a folder that does not exist.
 * Under pnpm, the path of the package changes with each version, so an old link goes stale.
 * When the system cannot make a link, the function copies the CUE folders of the package.
 */
export declare function linkCuePackage(pkgDir: string, target: string): void;
//# sourceMappingURL=generate.d.ts.map