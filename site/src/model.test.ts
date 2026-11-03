import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DATA } from "./data.ts";
import { BASE, INPUT_FILE, commandsOf, diffLines, featureDiff, filesOf, jsonLines, requestedWithout, tagged, YOURS } from "./model.ts";

const fixture = (name: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url)), "utf8"));
const cases = fixture("generate-cases.json") as Record<string, { features: string[]; packageJson?: Record<string, unknown> }>;
const files102 = fixture("generate-1.0.2.json") as Record<string, Record<string, string>>;

/** The tags of the first line of a file that has the text. */
function tagsOf(requested: string[], file: string, text: string, existing: Record<string, unknown> | null = null): readonly string[] | undefined {
  return tagged(requested, DATA, existing)[file]?.find((line) => line.text.includes(text))?.tags;
}

describe("jsonLines", () => {
  it("writes the lines of JSON.stringify with two spaces", () => {
    for (const value of [{ a: 1, b: [1, "x", { c: null }], d: {}, e: [] }, ["a"], "text", { $schema: "s", scripts: { build: "tsc -b" } }]) {
      expect(jsonLines(value).map((line) => line.text).join("\n")).toBe(JSON.stringify(value, null, 2));
    }
  });
});

describe("filesOf", () => {
  it("has a CUE output for each subset of the features", () => {
    const names = Object.keys(DATA.manifest.features);
    for (let mask = 0; mask < 1 << names.length; mask++) {
      const requested = names.filter((_, i) => (mask & (1 << i)) !== 0);
      expect(() => filesOf(requested, DATA, null)).not.toThrow();
    }
  });

  it("gives the files of cue-config generate for each case of the tests of the package", () => {
    for (const [name, c] of Object.entries(cases)) {
      const files = filesOf(c.features, DATA, c.packageJson ?? null);
      const { [INPUT_FILE]: input, ...generated } = files;
      expect(generated, name).toEqual(files102[name]);
      expect(JSON.parse(input!).dependencies, name).toEqual(c.features);
    }
  });

  it("adds tsconfig.test.json and the scripts of the test feature", () => {
    const files = filesOf(["ts", "vitest", "test"], DATA, null);
    expect(Object.keys(files)).toEqual(["package.json", "tsconfig.json", "tsconfig.test.json", ".gitignore", INPUT_FILE]);
    expect(JSON.parse(files["package.json"]!).scripts).toMatchObject({ typecheck: "tsc --noEmit && tsc -p tsconfig.test.json", test: "vitest run" });
  });
});

describe("tagged", () => {
  it("shows the most specific feature that gave each line", () => {
    expect(tagsOf(["ts", "node"], "package.json", '"@types/node"')).toEqual(["node"]);
    expect(tagsOf(["ts", "node"], "package.json", '"build"')).toEqual(["ts"]);
    expect(tagsOf(["ts", "node"], "tsconfig.json", "node.json")).toEqual(["node"]);
    expect(tagsOf(["vite-react"], "package.json", '"build"')).toEqual(["vite"]);
    expect(tagsOf(["vite-react"], "tsconfig.json", "react.json")).toEqual(["react"]);
    expect(tagsOf(["ts", "vitest", "test"], "package.json", '"test": "vitest run"')).toEqual(["vitest", "test"]);
    expect(tagsOf(["ts"], ".gitignore", "node_modules/")).toEqual(["npm"]);
    expect(tagsOf(["ts"], "package.json", '"name"')).toEqual([BASE]);
    expect(tagsOf(["ts"], ".gitignore", ".DS_Store")).toEqual([BASE]);
    expect(tagsOf(["ts", "node"], INPUT_FILE, '"node"')).toEqual(["node"]);
  });

  it("marks the values of the existing package.json", () => {
    expect(tagsOf(["ts"], "package.json", '"name"', { name: "my-lib", scripts: { lint: "eslint ." } })).toEqual([YOURS]);
    expect(tagsOf(["ts"], "package.json", '"lint"', { name: "my-lib", scripts: { lint: "eslint ." } })).toEqual([YOURS]);
  });
});

describe("featureDiff", () => {
  it("shows what a feature of the set adds", () => {
    const diff = featureDiff(["ts", "node"], "node", DATA, null);
    expect(diff.added).toBe(true);
    expect(diff.files["package.json"]!.filter((l) => l.op === "+").map((l) => l.text.trim())).toEqual(['"@types/node": "^22.0.0"']);
    expect(diff.files["tsconfig.json"]!.filter((l) => l.op !== " ").map((l) => `${l.op}${l.text.trim()}`)).toEqual([
      '-"extends": "@mark1russell7/cue/ts/config/ts.json"',
      '+"extends": "@mark1russell7/cue/ts/config/node.json"',
    ]);
  });

  it("shows what a new feature changes", () => {
    const diff = featureDiff(["ts"], "test", DATA, null);
    expect(diff.added).toBe(false);
    expect(diff.files["tsconfig.test.json"]!.every((l) => l.op === "+")).toBe(true);
  });
});

describe("the helpers", () => {
  it("keeps the rest of the set without a feature", () => {
    expect(requestedWithout(["node"], "node", DATA.manifest)).toEqual(["ts"]);
    expect(requestedWithout(["node", "cue"], "ts", DATA.manifest)).toEqual(["cue"]);
    expect(requestedWithout(["vite-react", "vitest"], "react", DATA.manifest)).toEqual(["vitest", "vite"]);
  });

  it("gives the commands of the CLI", () => {
    expect(commandsOf(["ts", "cue", "vitest"], DATA.manifest)).toEqual(["npx cue-config init --preset lib", "npx cue-config generate"]);
    expect(commandsOf(["ts", "node"], DATA.manifest)).toEqual(["npx cue-config add ts", "npx cue-config add node", "npx cue-config generate"]);
  });

  it("gives a line diff", () => {
    expect(diffLines("a\nb\nc\n", "a\nx\nc\n")).toEqual([
      { op: " ", text: "a" },
      { op: "-", text: "b" },
      { op: "+", text: "x" },
      { op: " ", text: "c" },
    ]);
  });
});
