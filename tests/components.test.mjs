import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { parseHTML } from "linkedom";
import ts from "typescript";

let executionId = 0;
async function executeComponent(name) {
  const source = fs.readFileSync(new URL(`../dist/components/${name}.astro`, import.meta.url), "utf8")
    .split("<script>")[1].split("</script>")[0];
  let js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  for (const module of ["core", "template"]) {
    js = js.replaceAll(`"../${module}.js"`, JSON.stringify(new URL(`../dist/${module}.js`, import.meta.url).href));
  }
  await import("data:text/javascript;base64," + Buffer.from(js + `\n// ${++executionId}`).toString("base64"));
}

function environment(t, html, search) {
  const { document, window, Event, CustomEvent } = parseHTML(html);
  const previous = { document: globalThis.document, window: globalThis.window, CustomEvent: globalThis.CustomEvent, fetch: globalThis.fetch };
  Object.assign(globalThis, { document, window, CustomEvent });
  window.location = { search };
  t.after(() => Object.assign(globalThis, previous));
  return { document, window, Event };
}

test("ResultsGrid preserves slot markup and switches every state without owning a heading", async (t) => {
  const { document, window, Event } = environment(t, `<html><body><h1>Project heading</h1>
    <section data-search-root aria-live="polite" aria-busy="true">
      <div data-search-state="idle" hidden><p>Custom idle</p></div>
      <div data-search-state="invalid" hidden><p>Custom invalid</p></div>
      <div data-search-state="loading"><p><strong>Custom loading</strong></p></div>
      <div data-search-state="empty" hidden><p>Custom empty</p></div>
      <div data-search-state="error" hidden><p>Custom error</p></div>
      <div data-search-state="success" hidden><p><span data-search-count></span> <span data-search-count-label></span> <span data-search-query></span></p></div>
      <div data-search-results hidden></div>
      <template data-search-item><article><h2 data-search-text="name"></h2></article></template>
    </section></body></html>`, "?q=astro");
  const root = document.querySelector("[data-search-root]");
  root.dataset.searchConfig = JSON.stringify({ indexURL: "/component-states.json", keys: ["name"] });
  root.dataset.searchQueryParam = "q";
  root.dataset.searchMessages = JSON.stringify({ singular: "item", plural: "items" });
  root.dataset.searchLocale = "pt-BR";
  const events = [];
  document.addEventListener("search:state", (event) => events.push(event.detail));
  let release;
  let downloads = 0;
  globalThis.fetch = () => { downloads++; return new Promise((resolve) => { release = () => resolve({ ok: true, json: async () => [{ name: "Astro" }] }); }); };
  await executeComponent("ResultsGrid");
  assert.equal(root.getAttribute("aria-busy"), "true");
  assert.equal(root.querySelector('[data-search-state="loading"]').hidden, false);
  assert.equal(root.querySelector("strong").textContent, "Custom loading");
  release();
  const settle = async () => {
    for (let i = 0; i < 100 && root.getAttribute("aria-busy") === "true"; i++) await new Promise((resolve) => setTimeout(resolve, 10));
  };
  await settle();
  assert.equal(root.querySelector('[data-search-state="success"]').hidden, false);
  assert.equal(root.querySelector("[data-search-count]").textContent, "1");
  assert.equal(root.querySelector("[data-search-query]").textContent, "astro");
  assert.equal(root.querySelector("[data-search-results] article h2").textContent, "Astro");
  assert.equal(document.querySelector("h1").textContent, "Project heading");
  for (const [query, status] of [["", "idle"], ["?q=de+com", "invalid"], ["?q=xyzxyzxyz", "empty"]]) {
    window.location.search = query;
    document.dispatchEvent(new Event("astro:page-load"));
    await settle();
    assert.equal(root.querySelector(`[data-search-state="${status}"]`).hidden, false);
    assert.equal(root.querySelector("[data-search-results]").hidden, true);
    assert.equal(root.querySelector("[data-search-results]").children.length, 0);
  }
  assert.equal(downloads, 1);
  assert.deepEqual(events.at(-1), { query: "xyzxyzxyz", status: "empty", count: 0 });
  const failed = root.cloneNode(true);
  failed.dataset.searchConfig = JSON.stringify({ indexURL: "/component-error.json", keys: ["name"] });
  root.replaceWith(failed);
  globalThis.fetch = async () => ({ ok: false });
  window.location.search = "?q=astro";
  document.dispatchEvent(new Event("astro:page-load"));
  for (let i = 0; i < 100 && failed.getAttribute("aria-busy") === "true"; i++) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(failed.querySelector('[data-search-state="error"]').hidden, false);
  assert.equal(failed.querySelector('[data-search-state="error"]').textContent, "Custom error");
});

test("SearchBar syncs inputs independently and prefetches once without loading Fuse", async (t) => {
  const { document, window, Event } = environment(t, '<html><head></head><body><form data-search-form data-search-index="/bar.json"><input type="search" name="term"></form></body></html>', "?term=camera");
  globalThis.fetch = () => { throw new Error("The bar must not fetch the engine."); };
  await executeComponent("SearchBar");
  const input = document.querySelector("input");
  assert.equal(input.value, "camera");
  input.dispatchEvent(new Event("focus"));
  input.dispatchEvent(new Event("input"));
  document.dispatchEvent(new Event("astro:page-load"));
  assert.equal(document.querySelectorAll('link[rel="prefetch"]').length, 1);
  window.location.search = "?term=tripod";
  document.dispatchEvent(new Event("astro:page-load"));
  assert.equal(input.value, "tripod");
});

test("ResultsGrid consumes serialized language, formats numbers and applies plural categories", async (t) => {
  const { document, window, Event } = environment(t, `<html><body><section data-search-root>
    <div data-search-state="success" hidden><span data-search-count></span> <span data-search-count-label></span></div>
    <div data-search-state="invalid" hidden>Invalid</div>
    <div data-search-results hidden></div>
    <template data-search-item><p data-search-text="name"></p></template>
  </section></body></html>`, "?q=the");
  const root = document.querySelector("section");
  root.dataset.searchConfig = JSON.stringify({ locale: "en-US", indexURL: "/component-i18n.json", keys: ["name"] });
  root.dataset.searchLocale = "ar-EG";
  root.dataset.searchQueryParam = "q";
  root.dataset.searchMessages = JSON.stringify({ singular: "one", plural: "other", countLabels: { two: "اثنان" } });
  let downloads = 0;
  globalThis.fetch = async () => { downloads++; return { ok: true, json: async () => [{ name: "Camera" }, { name: "Camera" }] }; };
  await executeComponent("ResultsGrid");
  assert.equal(root.querySelector('[data-search-state="invalid"]').hidden, false);
  assert.equal(downloads, 0);
  window.location.search = "?q=the+camera";
  document.dispatchEvent(new Event("astro:page-load"));
  for (let i = 0; i < 100 && root.getAttribute("aria-busy") === "true"; i++) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(root.querySelector("[data-search-count]").textContent, new Intl.NumberFormat("ar-EG").format(2));
  assert.equal(root.querySelector("[data-search-count-label]").textContent, "اثنان");
  assert.equal(root.querySelector("[data-search-results]").children.length, 2);
});
