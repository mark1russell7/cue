// The start of the page: the theme, the playground, the table of the features, the copy buttons and the build line.
import { byId, copyText, h, setupTheme } from "@mark1russell7/site-pages/chrome";
import { cueFileOf, cueTargets, type CueTarget } from "@mark1russell7/cue/core";
import { CUE_SOURCES, DATA } from "./data.ts";
import { featureDiff } from "./model.ts";
import { Playground, tagEl } from "./playground.ts";
import "./style.css";

setupTheme(byId<HTMLButtonElement>("theme"), "cue-theme");
new Playground();

const sets = Object.keys(DATA.table.package).length + Object.keys(DATA.table.ignore).length;
byId("honest").replaceChildren(
  "This page starts the core of the package in your browser (",
  h("code", {}, "@mark1russell7/cue/core"),
  "), the same code as the CLI. A browser cannot start CUE. Thus the page reads the output of ",
  h("code", {}, "cue eval"),
  ` for each of the ${sets} sets of CUE files that the features can give. CI makes this record again with ${DATA.table.cue.replace(/^cue version /, "CUE ")}, and fails when it is different.`,
);

/** This function shows the text of a CUE file of the package below the table. */
function showSource(target: CueTarget, file: string): void {
  byId("cue-source-name").textContent = `${cueTargets[target].dir}/${file}`;
  byId("cue-source").textContent = CUE_SOURCES[target].get(file) ?? "";
  const box = byId<HTMLDetailsElement>("cue-source-box");
  box.open = true;
  box.scrollIntoView({ block: "nearest" });
}

byId("feature-rows").replaceChildren(
  ...Object.entries(DATA.manifest.features).map(([feature, def]) => {
    const files = (["package", "ignore"] as const).flatMap((target) => {
      const file = cueFileOf(feature, target);
      if (!DATA.cueFiles[target].has(file)) return [];
      const button = h("button", { type: "button", class: "link", "data-source": `${target}:${file}` }, `${cueTargets[target].dir}/${file}`);
      button.addEventListener("click", () => showSource(target, file));
      return [button];
    });
    const diff = featureDiff([feature], feature, DATA, null);
    const changes = Object.entries(diff.files)
      .map(([name, lines]) => [name, lines.filter((l) => l.op === "+").length, lines.filter((l) => l.op === "-").length] as const)
      .filter(([name, add, del]) => name !== "dependencies.json" && add + del > 0);
    return h(
      "tr",
      { "data-feature": feature },
      h("td", {}, tagEl(feature)),
      h("td", {}, def.dependencies.length > 0 ? def.dependencies.map((d) => h("code", { class: "dep" }, d)) : h("span", { class: "muted" }, "nothing")),
      h("td", { class: "files-cell" }, files.length > 0 ? files : h("span", { class: "muted" }, "none")),
      h(
        "td",
        {},
        changes.length > 0
          ? changes.map(([name, add, del]) => h("span", { class: "change" }, h("code", {}, name), ` +${add}${del > 0 ? ` −${del}` : ""}`))
          : h("span", { class: "muted" }, "nothing: other features need it"),
      ),
    );
  }),
);

for (const button of document.querySelectorAll<HTMLButtonElement>("button[data-copy]")) {
  button.addEventListener("click", () => void copyText(button, byId(button.dataset["copy"]!).textContent ?? ""));
}

byId("build").append(
  `Version ${__BUILD__.version}, build `,
  __BUILD__.sha === "local" ? "local" : h("a", { href: `https://github.com/mark1russell7/cue/commit/${__BUILD__.sha}` }, __BUILD__.sha),
  ` of ${__BUILD__.date}`,
);
