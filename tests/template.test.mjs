import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";
import { createTemplateRenderer } from "../dist/template.js";

test("generic repeated objects preserve their scope and text is not HTML", () => {
  const { document } = parseHTML("<html><body></body></html>");
  globalThis.document = document;
  const template = document.createElement("template");
  template.innerHTML = '<article><h2 data-search-text="name"></h2><div data-search-each="features"><template><a data-search-text="name" data-search-href="url"></a></template></div></article>';
  const render = createTemplateRenderer();
  const result = render(template, { name: "<script>bad</script>", features: [{ name: "Fast", url: "/fast" }] });
  assert.equal(result.querySelector("h2").textContent, "<script>bad</script>");
  assert.equal(result.querySelector("script"), null);
  assert.equal(result.querySelector("a").textContent, "Fast");
  assert.equal(result.querySelector("a").getAttribute("href"), "/fast");
  const empty = render(template, { name: "Empty", features: [] });
  assert.equal(empty.querySelector("[data-search-each]").hidden, true);
  assert.equal(template.content.querySelector("h2").textContent, "");
});

test("responsive image attributes are optional and dates can be formatted", () => {
  const { document } = parseHTML("<html><body></body></html>");
  globalThis.document = document;
  const template = document.createElement("template");
  template.innerHTML = '<img data-search-src="image.src" data-search-srcset="image.srcset" data-search-sizes="image.sizes" data-search-width="image.width" data-search-height="image.height"><time data-search-date="date"></time>';
  const render = createTemplateRenderer({ formatDate: (date) => "Date: " + date });
  const result = render(template, { image: { src: "/image.webp", srcset: "/small.webp 320w", sizes: "100vw", width: 670, height: 377 }, date: "2026-01-01" });
  assert.equal(result.querySelector("img").getAttribute("srcset"), "/small.webp 320w");
  assert.equal(result.querySelector("img").getAttribute("width"), "670");
  assert.equal(result.querySelector("time").getAttribute("datetime"), "2026-01-01");
  assert.equal(result.querySelector("time").textContent, "Date: 2026-01-01");
  const simple = render(template, { image: { src: "/cdn.jpg" } });
  assert.equal(simple.querySelector("img").getAttribute("srcset"), null);
  assert.equal(simple.querySelector("img").getAttribute("width"), null);
});
