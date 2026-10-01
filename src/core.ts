import type Fuse from "fuse.js";
import type { IFuseOptions } from "fuse.js";
import { normalizeSearchText, type SerializableNormalizationOptions } from "./normalization.js";
export { getSearchTerms, normalizeSearchText } from "./normalization.js";
export type { NormalizationOptions, SerializableNormalizationOptions } from "./normalization.js";

export type SearchStatus = "idle" | "invalid" | "loading" | "success" | "empty" | "error";
export type SearchState<T> = { query: string; status: SearchStatus; results: T[] };

// Serializable settings can also be supplied as props to the Astro component.
export interface SearchSettings {
  locale?: string;
  normalization?: SerializableNormalizationOptions;
  indexURL: string;
  keys: (string | string[] | { name: string | string[]; weight?: number })[];
  limit?: number;
  threshold?: number;
  ignoreLocation?: boolean;
  minMatchCharLength?: number;
  ignoreDiacritics?: boolean;
}

// Shared across component instances and Astro navigations; no DOM or Astro imports.
const engines = new Map<string, Promise<Fuse<unknown>>>();

export function createSearch<T>(settings: SearchSettings & {
  normalizeQuery?: (query: string) => string;
}) {
  const { indexURL, keys, limit = 50 } = settings;
  const normalizeQuery = settings.normalizeQuery ?? ((value: string) => normalizeSearchText(value, {
    ...settings.normalization,
    locale: settings.locale,
  }));
  const options: IFuseOptions<unknown> = {
    keys,
    threshold: settings.threshold ?? 0.3,
    ignoreLocation: settings.ignoreLocation ?? true,
    minMatchCharLength: settings.minMatchCharLength ?? 2,
    ignoreDiacritics: settings.ignoreDiacritics ?? (settings.normalization?.removeDiacritics !== false),
  };
  const cacheKey = JSON.stringify([indexURL, options]);
  let requestId = 0;

  function getEngine() {
    let promise = engines.get(cacheKey);
    if (!promise) {
      promise = Promise.all([import("fuse.js"), fetch(indexURL, { cache: "force-cache" })])
        .then(async ([{ default: Fuse }, response]) => {
          if (!response.ok) throw new Error("Could not load the search index.");
          return new Fuse(await response.json() as unknown[], options);
        });
      engines.set(cacheKey, promise);
    }
    return promise as Promise<Fuse<T>>;
  }

  return {
    cancel() { requestId++; },
    async run(value: string, onStateChange: (state: SearchState<T>) => void) {
      const currentRequest = ++requestId;
      const query = value.trim();
      const emit = (status: SearchStatus, results: T[] = []) => {
        if (currentRequest === requestId) onStateChange({ query, status, results });
      };
      if (!query) { emit("idle"); return; }
      const normalized = normalizeQuery(query);
      if (!normalized) { emit("invalid"); return; }
      emit("loading");
      try {
        const engine = await getEngine();
        const results = engine.search(normalized, { limit }).map(({ item }) => item);
        emit(results.length ? "success" : "empty", results);
      } catch {
        emit("error");
      }
    },
  };
}
