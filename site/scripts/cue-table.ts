/**
 * This script writes `site/src/cue-table.json`: the output of `cue eval` for each set of CUE files that a
 * set of features gives. A browser cannot start CUE, so the site reads this record. The site makes
 * each file from it with the core of the package, as `cue-config generate` does.
 *
 * Start it after the build of the package: `pnpm --filter @cue/site run cue-table`. It needs the cue CLI.
 * With `--check`, it writes nothing, and it fails when the record is not the output of the CUE files.
 * CI starts the check.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cueEvalArgs, cueFiles, cueTargets, resolveFeatures, type CueTarget, type FeaturesManifest } from "@mark1russell7/cue/core";

const root = fileURLToPath(new URL("../../", import.meta.url));
const out = fileURLToPath(new URL("../src/cue-table.json", import.meta.url));
const manifest = JSON.parse(readFileSync(`${root}features.json`, "utf8")) as FeaturesManifest;
const targets: readonly CueTarget[] = ["package", "ignore"];

/** The key of a set of CUE files in the record. CUE unifies the files in any sequence, so the key sorts them. */
function keyOf(files: readonly string[]): string {
  return [...files].sort().join(" ");
}

/** The CUE files of each feature set, by key, for one target. Each subset of the features gives one set. */
function fileSets(target: CueTarget): Map<string, string[]> {
  const dir = `${root}${cueTargets[target].dir}/`;
  const names = Object.keys(manifest.features);
  const sets = new Map<string, string[]>();
  for (let mask = 0; mask < 1 << names.length; mask++) {
    const requested = names.filter((_, i) => (mask & (1 << i)) !== 0);
    const files = cueFiles(resolveFeatures(requested, manifest), target, (file) => existsSync(dir + file));
    sets.set(keyOf(files), [...files].sort());
  }
  return new Map([...sets].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** The text of the record: one line for each set of CUE files, so a change shows as a small diff. */
function record(): string {
  const version = execFileSync("cue", ["version"], { encoding: "utf8" }).split("\n")[0]!.trim();
  const parts: string[] = [`{\n  "cue": ${JSON.stringify(version)}`];
  for (const target of targets) {
    const cwd = `${root}${cueTargets[target].dir}`;
    const rows = [...fileSets(target)].map(([key, files]) => {
      const output: unknown = JSON.parse(execFileSync("cue", cueEvalArgs(files, target), { cwd, encoding: "utf8" }));
      return `    ${JSON.stringify(key)}: ${JSON.stringify(output)}`;
    });
    parts.push(`  ${JSON.stringify(target)}: {\n${rows.join(",\n")}\n  }`);
  }
  return `${parts.join(",\n")}\n}\n`;
}

const text = record();
if (process.argv.includes("--check")) {
  const current = existsSync(out) ? readFileSync(out, "utf8").replace(/\r\n/g, "\n") : "";
  if (current !== text) {
    console.error("site/src/cue-table.json is not the output of the CUE files. Run: pnpm --filter @cue/site run cue-table");
    process.exit(1);
  }
  console.log("site/src/cue-table.json is the output of the CUE files.");
} else {
  writeFileSync(out, text);
  console.log(`Wrote ${out}.`);
}
