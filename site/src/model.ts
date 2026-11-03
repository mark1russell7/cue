// The model of the playground: the files of a feature set, the features that gave each line, and the diff of one feature.
// The files come from the core of the package (@mark1russell7/cue/core), the same code as `cue-config generate`.
import {
  cueFiles,
  dependenciesJsonText,
  generateFiles,
  resolveFeatures,
  type CueTarget,
  type FeaturesManifest,
  type PackageJson,
} from "@mark1russell7/cue/core";

/** The record of `scripts/cue-table.ts`: the output of `cue eval` for each set of CUE files, by key. */
export interface CueTable {
  readonly cue: string;
  readonly package: Readonly<Record<string, PackageJson>>;
  readonly ignore: Readonly<Record<string, readonly string[]>>;
}

/** The data of the model: the features of `features.json`, the CUE record, and the CUE files of the package. */
export interface Data {
  readonly manifest: FeaturesManifest;
  readonly table: CueTable;
  readonly cueFiles: Readonly<Record<CueTarget, ReadonlySet<string>>>;
}

/** The file that the visitor gives (`dependencies.json`), after the files that `generate` writes. */
export const INPUT_FILE = "dependencies.json";

/** This function gives the key of the CUE record for the resolved features. The key sorts the files, as the record does. */
export function cueKey(resolved: readonly string[], target: CueTarget, data: Data): string {
  return cueFiles(resolved, target, (file) => data.cueFiles[target].has(file)).sort().join(" ");
}

/**
 * This function gives the files of the requested features, by name: the files that `generate` writes,
 * then `dependencies.json`. `existing` is the `package.json` of the project, or null.
 */
export function filesOf(requested: readonly string[], data: Data, existing: PackageJson | null): Record<string, string> {
  const resolved = resolveFeatures(requested, data.manifest);
  const packageKey = cueKey(resolved, "package", data);
  const ignoreKey = cueKey(resolved, "ignore", data);
  const packageJson = data.table.package[packageKey];
  const patterns = data.table.ignore[ignoreKey];
  if (!packageJson) throw new Error(`The CUE record has no package.json for ${packageKey}.`);
  if (!patterns) throw new Error(`The CUE record has no .gitignore for ${ignoreKey}.`);
  return { ...generateFiles(resolved, { packageJson, patterns }, existing), [INPUT_FILE]: dependenciesJsonText(requested) };
}

/** One line of a file. `key` names its value (a path and a value, or a line of `.gitignore`). A line with no value has no key. */
export interface Line {
  readonly text: string;
  readonly key: string | null;
}

/** This function gives the lines of a JSON value, as `JSON.stringify(value, null, 2)` writes them, with a key for each value. */
export function jsonLines(value: unknown): Line[] {
  const lines: Line[] = [];
  const walk = (v: unknown, path: string, indent: string, prefix: string, comma: string): void => {
    if (Array.isArray(v) && v.length > 0) {
      lines.push({ text: `${indent}${prefix}[`, key: null });
      v.forEach((item, i) => walk(item, `${path}[]`, `${indent}  `, "", i < v.length - 1 ? "," : ""));
      lines.push({ text: `${indent}]${comma}`, key: null });
    } else if (v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0) {
      const entries = Object.entries(v);
      lines.push({ text: `${indent}${prefix}{`, key: null });
      entries.forEach(([name, item], i) => walk(item, `${path}/${name}`, `${indent}  `, `${JSON.stringify(name)}: `, i < entries.length - 1 ? "," : ""));
      lines.push({ text: `${indent}}${comma}`, key: null });
    } else {
      const text = JSON.stringify(v);
      lines.push({ text: `${indent}${prefix}${text}${comma}`, key: `${path}=${text}` });
    }
  };
  walk(value, "", "", "", "");
  return lines;
}

/** This function gives the lines of a file: JSON lines for a `.json` file, and one key for each line of other files. */
export function linesOf(name: string, text: string): Line[] {
  if (name.endsWith(".json")) return jsonLines(JSON.parse(text));
  return text.replace(/\n$/, "").split("\n").map((line) => ({ text: line, key: line === "" ? null : `=${line}` }));
}

/** This function gives the keys of each file, by file name. */
function keysOf(files: Readonly<Record<string, string>>): Map<string, Set<string>> {
  const keys = new Map<string, Set<string>>();
  for (const [name, text] of Object.entries(files)) {
    keys.set(name, new Set(linesOf(name, text).flatMap((line) => (line.key === null ? [] : [line.key]))));
  }
  return keys;
}

/** This function tells if `feature` needs `other` (directly or through other features). A feature does not need itself. */
export function needs(feature: string, other: string, manifest: FeaturesManifest): boolean {
  return feature !== other && resolveFeatures([feature], manifest).includes(other);
}

/** This function gives the resolved features without `feature` and without each feature that needs it. */
export function without(resolved: readonly string[], feature: string, manifest: FeaturesManifest): string[] {
  return resolved.filter((f) => f !== feature && !needs(f, feature, manifest));
}

/**
 * This function gives the requested features after the removal of `feature` and of each feature that needs it.
 * The result keeps the other features of the set: it adds each one that the rest no longer brings.
 * For example, `node` without `node` gives `ts`.
 */
export function requestedWithout(requested: readonly string[], feature: string, manifest: FeaturesManifest): string[] {
  const rest = without(resolveFeatures(requested, manifest), feature, manifest);
  const kept = requested.filter((f) => rest.includes(f));
  const covered = resolveFeatures(kept, manifest);
  const missing = rest.filter((f) => !covered.includes(f));
  return [...kept, ...missing.filter((f) => !missing.some((g) => needs(g, f, manifest)))];
}

/** A line of a file with the features that gave it. `yours` marks a value of the existing `package.json`. */
export interface TaggedLine extends Line {
  readonly tags: readonly string[];
}

/** The tag of a value that no feature gives: `base.cue`, or a value of the generator. */
export const BASE = "base";
/** The tag of a value of the existing `package.json`. */
export const YOURS = "yours";

/**
 * This function gives the lines of each file with the features that gave each line. A feature gave a line
 * when the line changes without the feature. Of those features, a line shows only the most specific ones:
 * a feature that another one of them needs is not shown. Thus `"build": "vite build"` shows `vite`, not `ts`.
 */
export function tagged(requested: readonly string[], data: Data, existing: PackageJson | null): Record<string, TaggedLine[]> {
  const resolved = resolveFeatures(requested, data.manifest);
  const files = filesOf(requested, data, existing);
  const ablated = resolved.map((feature) => ({ feature, keys: keysOf(filesOf(requestedWithout(requested, feature, data.manifest), data, existing)) }));
  const yours = new Set(existing ? jsonLines(existing).flatMap((line) => (line.key === null ? [] : [line.key])) : []);
  const result: Record<string, TaggedLine[]> = {};
  for (const [name, text] of Object.entries(files)) {
    result[name] = linesOf(name, text).map((line) => {
      if (line.key === null) return { ...line, tags: [] };
      const changers = ablated.filter((a) => !a.keys.get(name)?.has(line.key!)).map((a) => a.feature);
      const tags = changers.filter((f) => !changers.some((g) => needs(g, f, data.manifest)));
      if (tags.length > 0) return { ...line, tags };
      return { ...line, tags: [name === "package.json" && yours.has(line.key) ? YOURS : BASE] };
    });
  }
  return result;
}

/** One line of a diff: ` ` stays, `+` is new, `-` goes away. */
export interface DiffLine {
  readonly op: " " | "+" | "-";
  readonly text: string;
}

/**
 * This function gives the line diff of two texts (the longest common subsequence of their lines). It compares
 * the lines without a comma at the end, so a new last entry of a JSON object does not change the entry before it.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before === "" ? [] : before.replace(/\n$/, "").split("\n");
  const b = after === "" ? [] : after.replace(/\n$/, "").split("\n");
  const same = (x: string, y: string): boolean => x.replace(/,$/, "") === y.replace(/,$/, "");
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = same(a[i]!, b[j]!) ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && same(a[i]!, b[j]!)) {
      out.push({ op: " ", text: b[j]! });
      i++;
      j++;
    } else if (i < n && (j >= m || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      out.push({ op: "-", text: a[i]! });
      i++;
    } else {
      out.push({ op: "+", text: b[j]! });
      j++;
    }
  }
  return out;
}

/** The diff of one feature: the files without it and with it. `added` is false when the visitor has not picked the feature. */
export interface FeatureDiff {
  readonly feature: string;
  readonly added: boolean;
  readonly files: Readonly<Record<string, DiffLine[]>>;
}

/**
 * This function gives what one feature changes. For a feature of the set, it compares the files without the
 * feature (and without each feature that needs it) with the files of the set. For another feature, it compares
 * the files of the set with the files after `cue-config add` of the feature.
 */
export function featureDiff(requested: readonly string[], feature: string, data: Data, existing: PackageJson | null): FeatureDiff {
  const resolved = resolveFeatures(requested, data.manifest);
  const added = resolved.includes(feature);
  const before = added ? filesOf(requestedWithout(requested, feature, data.manifest), data, existing) : filesOf(requested, data, existing);
  const after = added ? filesOf(requested, data, existing) : filesOf([...requested, feature], data, existing);
  const files: Record<string, DiffLine[]> = {};
  for (const name of new Set([...Object.keys(after), ...Object.keys(before)])) {
    files[name] = diffLines(before[name] ?? "", after[name] ?? "");
  }
  return { feature, added, files };
}

/** This function gives the commands of the CLI that write the `dependencies.json` of the requested features, then the files. */
export function commandsOf(requested: readonly string[], manifest: FeaturesManifest): string[] {
  const preset = Object.entries(manifest.presets).find(([, features]) => features.length === requested.length && features.every((f, i) => f === requested[i]));
  const first = preset ? [`npx cue-config init --preset ${preset[0]}`] : requested.map((f) => `npx cue-config add ${f}`);
  return [...first, "npx cue-config generate"];
}
