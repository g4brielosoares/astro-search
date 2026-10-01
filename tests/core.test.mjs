import assert from "node:assert/strict";
import test from "node:test";
import { createSearch, normalizeSearchText } from "../dist/core.js";
import { defineSearchConfig } from "../dist/config.js";

test("normalization and project defaults remain configurable", () => {
  assert.equal(normalizeSearchText("Como fazer programação com Astro?"), "fazer programacao astro");
  assert.equal(normalizeSearchText("The Camera", { locale: "en", stopwords: new Set(["the"]) }), "camera");
  const config = defineSearchConfig({ pageURL: "/products/", keys: ["name"] });
  assert.equal(config.pageURL, "/products/");
  assert.equal(config.queryParam, "q");
  assert.deepEqual(config.keys, ["name"]);
});

test("generic records, invalid queries, result limits and shared engine", async (t) => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, json: async () => Array.from({ length: 60 }, (_, id) => ({ id, name: "Camera" })) };
  };
  const settings = { indexURL: "/test-products.json", keys: ["name"] };
  const search = createSearch(settings);
  const states = [];
  await search.run("", (state) => states.push(state.status));
  await search.run("de com", (state) => states.push(state.status));
  assert.deepEqual(states, ["idle", "invalid"]);
  assert.equal(calls, 0);
  let final;
  await search.run("camera", (state) => { final = state; });
  assert.equal(final.status, "success");
  assert.equal(final.results.length, 50);
  await createSearch({ ...settings, limit: 2 }).run("camera", (state) => { final = state; });
  assert.equal(final.results.length, 2);
  assert.equal(calls, 1);
  await search.run("unrelatedxyz", (state) => { final = state; });
  assert.equal(final.status, "empty");
});

test("older pending searches and cancelled searches cannot emit results", async (t) => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  let release;
  globalThis.fetch = () => new Promise((resolve) => {
    release = () => resolve({ ok: true, json: async () => [{ name: "Camera" }] });
  });
  const search = createSearch({ indexURL: "/test-slow.json", keys: ["name"] });
  const states = [];
  const pending = search.run("camera", (state) => states.push(state.status));
  await search.run("", (state) => states.push(state.status));
  release();
  await pending;
  assert.deepEqual(states, ["loading", "idle"]);
  const cancelled = [];
  const second = search.run("camera", (state) => cancelled.push(state.status));
  search.cancel();
  await second;
  assert.deepEqual(cancelled, ["loading"]);
});

test("failed index emits error and retains the cached failure", async (t) => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false }; };
  const search = createSearch({ indexURL: "/test-error.json", keys: ["name"] });
  const states = [];
  await search.run("camera", (state) => states.push(state.status));
  await search.run("camera", (state) => states.push(state.status));
  assert.deepEqual(states, ["loading", "error", "loading", "error"]);
  assert.equal(calls, 1);
});
