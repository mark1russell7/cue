/**
 * The probe of the playground. The site check of the Pages workflow starts it in a browser at each width, before
 * the deploy. A failed check stops the deploy.
 *
 * The site check reads this TypeScript file directly. It removes the types and the `export` line, and it starts the
 * result as the body of an async function.
 */

// The site check gives these helpers to the probe. Each element of this page is an HTML element.
declare const check: (name: string, ok: unknown, detail?: unknown) => boolean;
declare const until: <T>(fn: () => T | Promise<T>, ms?: number) => Promise<T>;
declare const $: (selector: string) => HTMLElement | null;
declare const $$: (selector: string) => HTMLElement[];
declare const type: (target: string | Element, text: string) => void;
declare const click: (target: string | Element) => void;

const code = () => $("#code")?.textContent ?? "";
const lineWith = (text: string) => $$("#code .ln").find((line) => (line.querySelector(".t")?.textContent ?? "").includes(text));
const tagsOf = (text: string) => lineWith(text)?.dataset["tags"] ?? "(no line)";
const tabs = () => $$("#tabs [data-file]").map((tab) => tab.dataset["file"]);
const openTab = (file: string) => click(`#tabs [data-file="${file}"]`);

check("the preset lib is on", await until(() => $('#presets [data-preset="lib"]')?.getAttribute("aria-pressed") === "true"));
check("package.json has the test script of vitest", await until(() => code().includes('"test": "vitest run --passWithNoTests"')), code().slice(0, 200));
check("the test script shows the feature vitest", tagsOf('"test":') === "vitest", tagsOf('"test":'));
check("the build script shows the feature ts", tagsOf('"build":') === "ts", tagsOf('"build":'));
check("npm is included, because ts needs it", $('#features [data-feature="npm"]')?.dataset["state"] === "implied");

click('#features [data-feature="node"]');
check("the feature node adds @types/node", await until(() => code().includes('"@types/node"')), code().slice(0, 200));
check("the line of @types/node shows the feature node", tagsOf('"@types/node"') === "node", tagsOf('"@types/node"'));
openTab("tsconfig.json");
check("tsconfig.json extends node.json", await until(() => code().includes("ts/config/node.json")), code());
check("the extends line shows the feature node", tagsOf("extends") === "node", tagsOf("extends"));

click('#features [data-feature="test"]');
check("the feature test adds tsconfig.test.json", await until(() => tabs().includes("tsconfig.test.json")), tabs().join());
openTab("package.json");
check("the feature test changes the typecheck script", await until(() => code().includes("tsc -p tsconfig.test.json")), code().slice(0, 300));
check("the test script shows vitest and test", tagsOf('"test":') === "vitest test", tagsOf('"test":'));

const diff = $("#diff") as HTMLSelectElement | null;
if (diff) {
  diff.value = "vite";
  diff.dispatchEvent(new Event("change", { bubbles: true }));
}
check("the diff of vite shows new lines", await until(() => $$("#code .d-add").length > 0), $$("#code .ln").length);
check("vite changes the build script", $$("#code .d-add").some((l) => (l.textContent ?? "").includes('"build": "vite build"')), code().slice(0, 300));
if (diff) {
  diff.value = "";
  diff.dispatchEvent(new Event("change", { bubbles: true }));
}
check("the files come back without the diff", await until(() => $$("#code .d-add").length === 0 && tagsOf('"build":') === "ts"), tagsOf('"build":'));

click('#presets [data-preset="app"]');
openTab("tsconfig.json");
check("the preset app extends react.json", await until(() => code().includes("ts/config/react.json")), code());
check("the extends line shows the feature react", tagsOf("extends") === "react", tagsOf("extends"));

openTab("package.json");
type("#existing", '{ "name": "my-lib", "version": "1.2.0", "scripts": { "lint": "eslint ." } }');
check("the merge keeps the name of your package.json", await until(() => code().includes('"name": "my-lib"')), code().slice(0, 200));
check("the name shows the tag yours", tagsOf('"name"') === "yours", tagsOf('"name"'));
check("the merge keeps your lint script", tagsOf('"lint"') === "yours", tagsOf('"lint"'));

check("the table shows each feature", $$("#feature-rows tr").length === 11, $$("#feature-rows tr").length);

export {};
