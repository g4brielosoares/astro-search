import assert from "node:assert/strict";
import test from "node:test";
import { getSearchTerms, normalizeSearchText, createSearch } from "../dist/core.js";
import { createSearchText } from "../dist/endpoint.js";
import { defineSearchConfig } from "../dist/config.js";
import { getSearchTranslations } from "../dist/i18n.js";

test("locale presets and serializable overrides normalize index and query consistently", () => {
  for (const [locale, text, expected] of [
    ["pt-BR", "A programação com Astro", "programacao astro"],
    ["en-GB", "The camera and tripod", "camera tripod"],
    ["es-MX", "La cámara y el trípode", "camara tripode"],
    ["fr-CA", "Le café et les images", "cafe images"],
    ["de-DE", "Die Bilder und das Foto", "bilder foto"],
    ["it-IT", "La ricerca e le immagini", "ricerca immagini"],
  ]) {
    const config = JSON.parse(JSON.stringify(defineSearchConfig({ locale })));
    assert.equal(createSearchText(text, config), expected);
    assert.equal(normalizeSearchText(text, { locale }), expected);
  }
  const custom = JSON.parse(JSON.stringify(defineSearchConfig({ locale: "en", normalization: { stopwords: ["CAMERA"], removeDiacritics: false } })));
  assert.equal(createSearchText("The camera café café", custom), "the café");
  assert.equal(normalizeSearchText("The camera café", { ...custom.normalization, locale: custom.locale }), "the café");
  assert.equal(normalizeSearchText("de the la", { locale: "en", stopwords: false }), "de the la");
  assert.equal(normalizeSearchText("a de the", { locale: "nl" }), "a de the");
});

test("Unicode preserves non-Latin scripts and segments languages without spaces", () => {
  assert.equal(normalizeSearchText("I İ ISTANBUL", { locale: "tr" }), "ı i ıstanbul");
  assert.equal(normalizeSearchText("ภาษาไทย", { locale: "th", removeDiacritics: false }).replaceAll(" ", ""), "ภาษาไทย");
  for (const [locale, text] of [["ja", "東京の写真"], ["zh", "中文搜索图片"], ["th", "ภาษาไทยค้นหา"]]) {
    const terms = getSearchTerms(text, { locale });
    assert.ok(terms.length > 1, `${locale} must split words`);
    assert.equal(createSearchText(text, { locale }), [...new Set(terms)].join(" "));
  }
  assert.deepEqual(getSearchTerms("中文搜索", { locale: "zh", tokenizer: "unicode" }), ["中文搜索"]);
  assert.equal(normalizeSearchText("بحث عربي", { locale: "ar" }), "بحث عربي");
});

test("translation catalogs follow locale language, fallback to English, and return independent copies", () => {
  assert.equal(getSearchTranslations("pt-PT").labels.button, "Buscar");
  assert.equal(getSearchTranslations("en-GB").messages.loading, "Searching...");
  assert.equal(getSearchTranslations("es-MX").labels.placeholder, "Título, palabra clave...");
  assert.equal(getSearchTranslations("ja-JP").labels.button, "Search");
  const first = getSearchTranslations("en");
  first.labels.button = "Changed";
  assert.equal(getSearchTranslations("en").labels.button, "Search");
});

test("serialized locales select independent indexes and multilingual search keeps stopwords", async (t) => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  const indexes = {
    "/i18n-en.json": [{ id: "en", searchText: "camera" }],
    "/i18n-pt.json": [{ id: "pt", searchText: "camera" }],
    "/i18n-mixed.json": [{ id: "en", searchText: "the camera" }, { id: "pt", searchText: "a camera" }],
    "/i18n-accents.json": [{ id: "accent", title: "Café" }],
  };
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(url); return { ok: true, json: async () => indexes[url] }; };
  let final;
  const execute = async (config, query) => { await createSearch(JSON.parse(JSON.stringify(config))).run(query, (state) => { final = state; }); return final; };
  for (const [locale, query, id] of [["en", "the camera", "en"], ["pt", "a camera", "pt"]]) {
    const config = defineSearchConfig({ locale, indexURL: `/i18n-${id}.json`, keys: ["searchText"] });
    assert.equal((await execute(config, query)).results[0].id, id);
    assert.equal((await execute(config, locale === "en" ? "the" : "de")).status, "invalid");
  }
  assert.deepEqual(calls, ["/i18n-en.json", "/i18n-pt.json"]);
  const mixed = defineSearchConfig({ locale: "en", indexURL: "/i18n-mixed.json", keys: ["searchText"], normalization: { stopwords: false } });
  assert.equal((await execute(mixed, "camera")).results.length, 2);
  assert.equal((await execute(mixed, "the")).results[0].id, "en");
  assert.equal((await execute(defineSearchConfig({ locale: "fr", indexURL: "/i18n-accents.json", keys: ["title"], threshold: 0 }), "cafe")).status, "success");
  assert.equal((await execute(defineSearchConfig({ locale: "fr", indexURL: "/i18n-accents.json", keys: ["title"], threshold: 0, normalization: { removeDiacritics: false } }), "cafe")).status, "empty");
});
