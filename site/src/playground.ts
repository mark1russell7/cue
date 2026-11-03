// The playground: the presets and the features, the files with the feature of each line, the diff of one feature,
// and the merge into an existing package.json.
import { byId, copyText, h } from "@mark1russell7/site-pages/chrome";
import { resolveFeatures, type PackageJson } from "@mark1russell7/cue/core";
import { DATA } from "./data.ts";
import { BASE, commandsOf, featureDiff, filesOf, INPUT_FILE, needs, tagged, YOURS, type DiffLine, type TaggedLine } from "./model.ts";

const manifest = DATA.manifest;
const FEATURES = Object.keys(manifest.features);

/** The hue of the tag of each feature, in the sequence of `features.json`. */
export function hueOf(tag: string): number | null {
  const index = FEATURES.indexOf(tag);
  return index === -1 ? null : Math.round((205 + (index * 360) / FEATURES.length) % 360);
}

/** This function makes the tag of a feature, of `base` or of `yours`. */
export function tagEl(tag: string): HTMLElement {
  const hue = hueOf(tag);
  const kind = tag === BASE ? "base" : tag === YOURS ? "yours" : "feature";
  return h("b", { class: `tag t-${kind}`, style: hue === null ? null : `--h: ${hue}`, title: tagTitle(tag) }, tag);
}

function tagTitle(tag: string): string {
  if (tag === BASE) return "base.cue or the generator gives this line";
  if (tag === YOURS) return "your package.json gives this line";
  return `the feature ${tag} gives this line`;
}

/** An example of an existing package.json, as in the tests of the package. */
const EXAMPLE: PackageJson = {
  name: "@acme/example",
  version: "0.3.1",
  description: "An example package",
  type: "module",
  main: "./dist/index.js",
  scripts: { build: "tsc -b", test: "vitest run", lint: "eslint ." },
  dependencies: { zod: "^4.0.0" },
};

/** The playground of the page. It owns the requested features, and it draws the files at each change. */
export class Playground {
  private requested: string[] = [...(manifest.presets["lib"] ?? [])];
  private file = "package.json";
  private diff = "";
  private existing: PackageJson | null = null;
  private readonly code = byId("code");
  private readonly diffSelect = byId<HTMLSelectElement>("diff");
  private readonly existingInput = byId<HTMLTextAreaElement>("existing");

  constructor() {
    byId("presets").replaceChildren(
      ...Object.entries(manifest.presets).map(([name, features]) => {
        const button = h("button", { type: "button", class: "chip", "data-preset": name, title: features.join(", ") }, name);
        button.addEventListener("click", () => this.set([...features]));
        return button;
      }),
      (() => {
        const button = h("button", { type: "button", class: "chip", "data-preset": "" }, "none");
        button.addEventListener("click", () => this.set([]));
        return button;
      })(),
    );

    byId("features").replaceChildren(
      ...FEATURES.map((feature) => {
        const deps = manifest.features[feature]!.dependencies;
        const button = h(
          "button",
          { type: "button", class: "feature", "data-feature": feature, style: `--h: ${hueOf(feature)}` },
          h("span", { class: "box", "aria-hidden": "true" }),
          h("span", { class: "fname" }, feature),
          h("span", { class: "why" }, deps.length > 0 ? `needs ${deps.join(", ")}` : "needs nothing"),
        );
        button.addEventListener("click", () => this.toggle(feature));
        button.addEventListener("mouseenter", () => this.highlight(feature));
        button.addEventListener("mouseleave", () => this.highlight(null));
        button.addEventListener("focus", () => this.highlight(feature));
        button.addEventListener("blur", () => this.highlight(null));
        return h("li", {}, button);
      }),
    );

    this.diffSelect.addEventListener("change", () => {
      this.diff = this.diffSelect.value;
      this.render();
    });

    byId<HTMLButtonElement>("copy-commands").addEventListener("click", (event) => {
      void copyText(event.currentTarget as HTMLButtonElement, byId("commands").textContent ?? "");
    });
    byId<HTMLButtonElement>("copy-file").addEventListener("click", (event) => {
      void copyText(event.currentTarget as HTMLButtonElement, filesOf(this.requested, DATA, this.existing)[this.file] ?? "");
    });

    this.existingInput.addEventListener("input", () => this.readExisting());
    byId("existing-example").addEventListener("click", () => {
      this.existingInput.value = JSON.stringify(EXAMPLE, null, 2);
      this.readExisting();
    });
    byId("existing-clear").addEventListener("click", () => {
      this.existingInput.value = "";
      this.readExisting();
    });

    this.render();
  }

  /** This function sets the requested features (a preset, or no feature). */
  private set(requested: string[]): void {
    this.requested = requested;
    this.render();
  }

  /** A click on a feature: an off feature goes on, an included feature goes in the list, and an on feature goes off. */
  private toggle(feature: string): void {
    if (this.requested.includes(feature)) this.requested = this.requested.filter((f) => f !== feature);
    else this.requested = [...this.requested, feature];
    this.render();
  }

  private readExisting(): void {
    const hint = byId("existing-hint");
    const text = this.existingInput.value.trim();
    if (text === "") {
      this.existing = null;
      this.existingInput.removeAttribute("aria-invalid");
      hint.textContent = "";
    } else {
      try {
        const value: unknown = JSON.parse(text);
        if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("a package.json is a JSON object");
        this.existing = value as PackageJson;
        this.existingInput.removeAttribute("aria-invalid");
        hint.textContent = "The playground merges this package.json. Its lines show the tag yours.";
        hint.classList.remove("bad");
      } catch (error) {
        this.existingInput.setAttribute("aria-invalid", "true");
        hint.textContent = `This is not a JSON object: ${(error as Error).message}. The playground uses the last good value.`;
        hint.classList.add("bad");
        return;
      }
    }
    this.render();
  }

  /** This function marks the lines that a feature gave, while the pointer or the focus is on the feature. */
  private highlight(feature: string | null): void {
    for (const line of this.code.querySelectorAll<HTMLElement>(".ln")) {
      line.classList.toggle("hl", feature !== null && (line.dataset["tags"] ?? "").split(" ").includes(feature));
    }
  }

  private render(): void {
    const resolved = resolveFeatures(this.requested, manifest);
    const files = filesOf(this.requested, DATA, this.existing);
    if (!(this.file in files)) this.file = "package.json";
    if (this.diff !== "" && !FEATURES.includes(this.diff)) this.diff = "";

    // The presets and the features
    const presetName = Object.entries(manifest.presets).find(([, f]) => f.length === this.requested.length && f.every((x, i) => x === this.requested[i]))?.[0];
    for (const button of byId("presets").querySelectorAll<HTMLButtonElement>("button")) {
      const name = button.dataset["preset"]!;
      button.setAttribute("aria-pressed", String(name === "" ? this.requested.length === 0 : name === presetName));
    }
    for (const button of byId("features").querySelectorAll<HTMLButtonElement>("button.feature")) {
      const feature = button.dataset["feature"]!;
      const on = this.requested.includes(feature);
      const implied = !on && resolved.includes(feature);
      const state = on ? "on" : implied ? "implied" : "off";
      button.dataset["state"] = state;
      button.setAttribute("aria-pressed", String(on));
      const why = button.querySelector(".why")!;
      const deps = manifest.features[feature]!.dependencies;
      if (implied) {
        const by = this.requested.filter((r) => needs(r, feature, manifest));
        why.textContent = `included: ${by.join(", ")} needs it`;
      } else {
        why.textContent = deps.length > 0 ? `needs ${deps.join(", ")}` : "needs nothing";
      }
      button.setAttribute("aria-label", `${feature}: ${state === "on" ? "on" : state === "implied" ? "included" : "off"}, ${why.textContent}`);
    }
    byId("feature-count").textContent = `${this.requested.length} on, ${resolved.length - this.requested.length} included`;
    byId("commands").textContent = commandsOf(this.requested, manifest).join("\n");

    // The diff select
    this.diffSelect.replaceChildren(
      h("option", { value: "" }, "none"),
      ...FEATURES.map((f) => h("option", { value: f }, resolved.includes(f) ? `${f} (in the set)` : `${f} (add it)`)),
    );
    this.diffSelect.value = this.diff;

    const diff = this.diff === "" ? null : featureDiff(this.requested, this.diff, DATA, this.existing);
    const lines = tagged(this.requested, DATA, this.existing);

    // The tabs: the files of the set, and in a diff also a file that goes away
    const names = [...Object.keys(files)];
    if (diff) for (const name of Object.keys(diff.files)) if (!names.includes(name)) names.splice(names.length - 1, 0, name);
    const tabs = byId("tabs");
    tabs.replaceChildren(
      ...names.map((name) => {
        const changes = diff?.files[name]?.filter((l) => l.op !== " ").length ?? 0;
        const button = h(
          "button",
          { type: "button", role: "tab", class: "tab", "data-file": name, "aria-selected": String(name === this.file), tabindex: name === this.file ? 0 : -1, "aria-controls": "code" },
          name,
          name === INPUT_FILE ? h("span", { class: "badge in" }, "input") : null,
          changes > 0 ? h("span", { class: "badge ch", "aria-label": `${changes} changed lines` }, `±${changes}`) : null,
        );
        button.addEventListener("click", () => {
          this.file = name;
          this.render();
        });
        return button;
      }),
    );
    tabs.onkeydown = (event: KeyboardEvent) => {
      const step = ({ ArrowRight: 1, ArrowLeft: -1 } as Record<string, number>)[event.key];
      if (step === undefined) return;
      event.preventDefault();
      const index = names.indexOf(this.file);
      this.file = names[(index + step + names.length) % names.length]!;
      this.render();
      tabs.querySelector<HTMLButtonElement>(`[data-file="${CSS.escape(this.file)}"]`)?.focus();
    };
    if (!names.includes(this.file)) this.file = "package.json";

    // The code
    this.code.dataset["mode"] = diff ? "diff" : "tags";
    this.code.dataset["file"] = this.file;
    this.code.setAttribute("aria-label", diff ? `The diff of ${this.diff} in ${this.file}` : `${this.file}, with the feature of each line`);
    if (diff) this.code.replaceChildren(...(diff.files[this.file] ?? []).map(diffLineEl));
    else this.code.replaceChildren(...(lines[this.file] ?? []).map(taggedLineEl));

    // The notes
    const note = byId("file-note");
    if (diff) {
      const count = Object.values(diff.files).reduce((n, f) => n + f.filter((l) => l.op !== " ").length, 0);
      note.textContent = diff.added
        ? `What ${diff.feature} adds: the files without ${diff.feature}, then with it. ${count} lines change.`
        : `What cue-config add ${diff.feature} changes. ${count} lines change.`;
    } else if (this.file === INPUT_FILE) {
      note.textContent = "The input: init and add write this file. The other tabs are the files that generate writes.";
    } else {
      note.textContent = "Each line shows the feature that gave it. Point at a feature to mark its lines.";
    }
    const legend = byId("legend");
    if (diff) legend.replaceChildren(h("span", { class: "op-add" }, "+ new line"), " ", h("span", { class: "op-del" }, "− line that goes away"));
    else {
      const used = new Set((lines[this.file] ?? []).flatMap((l) => l.tags));
      legend.replaceChildren(...[...FEATURES, BASE, YOURS].filter((t) => used.has(t)).flatMap((t) => [tagEl(t), " "]));
    }
  }
}

function taggedLineEl(line: TaggedLine): HTMLElement {
  return h("div", { class: "ln", "data-tags": line.tags.join(" ") }, h("span", { class: "g" }, ...line.tags.map(tagEl)), h("code", { class: "t" }, line.text || " "));
}

function diffLineEl(line: DiffLine): HTMLElement {
  const op = line.op === "+" ? "add" : line.op === "-" ? "del" : "same";
  return h(
    "div",
    { class: `ln d-${op}`, "data-op": op },
    h("span", { class: "g op", "aria-label": op === "add" ? "new line" : op === "del" ? "line that goes away" : null }, line.op === "-" ? "−" : line.op),
    h("code", { class: "t" }, line.text || " "),
  );
}
