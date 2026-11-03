// The data of the page, from the package itself: features.json, the CUE files of the features, and the CUE record.
import type { CueTarget, FeaturesManifest } from "@mark1russell7/cue/core";
import manifest from "@mark1russell7/cue/features.json";
import table from "./cue-table.json";
import type { CueTable, Data } from "./model.ts";

/** The text of each CUE file of `package.json` and of `.gitignore`, by file name. Vite reads the files of the package at build time. */
const packageCue = import.meta.glob<string>("../../npm/package/*.cue", { query: "?raw", import: "default", eager: true });
const ignoreCue = import.meta.glob<string>("../../git/ignore/*.cue", { query: "?raw", import: "default", eager: true });

/** This function gives the CUE files of a glob by file name. */
function byName(files: Readonly<Record<string, string>>): Map<string, string> {
  return new Map(Object.entries(files).map(([path, text]) => [path.slice(path.lastIndexOf("/") + 1), text]));
}

/** The text of the CUE files of each target, by file name. */
export const CUE_SOURCES: Readonly<Record<CueTarget, ReadonlyMap<string, string>>> = {
  package: byName(packageCue),
  ignore: byName(ignoreCue),
};

/** The data of the model. */
export const DATA: Data = {
  manifest: manifest as FeaturesManifest,
  table: table as CueTable,
  cueFiles: { package: new Set(CUE_SOURCES.package.keys()), ignore: new Set(CUE_SOURCES.ignore.keys()) },
};
