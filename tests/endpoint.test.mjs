import assert from "node:assert/strict";
import test from "node:test";
import { createSearchEndpoint, createSearchText } from "../dist/endpoint.js";

test("async adapters emit JSON in source order and keep compact body terms", async () => {
  const handler = createSearchEndpoint({
    getItems: async () => [{ id: 1 }, { id: 2 }],
    mapItem: async ({ id }) => ({ id, searchText: createSearchText("Astro e programação com Astro") }),
  });
  const response = await handler({});
  assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.deepEqual(await response.json(), [
    { id: 1, searchText: "astro programacao" },
    { id: 2, searchText: "astro programacao" },
  ]);
});
