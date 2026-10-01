import type { APIRoute } from "astro";
import { getSearchTerms, type NormalizationOptions } from "./core.js";
import type { SearchSettings } from "./core.js";

export function createSearchText(
  body: string,
  options: NormalizationOptions | Pick<SearchSettings, "locale" | "normalization"> = {},
): string {
  const normalization = "normalization" in options
    ? { ...options.normalization, locale: options.locale } : options as NormalizationOptions;
  return [...new Set(getSearchTerms(body, normalization))].join(" ");
}

export function createSearchEndpoint<T, Document>(options: {
  getItems: () => readonly T[] | Promise<readonly T[]>;
  mapItem: (item: T) => Document | Promise<Document>;
}): APIRoute {
  return async () => {
    const items = await options.getItems();
    const index = await Promise.all(items.map(options.mapItem));
    return new Response(JSON.stringify(index), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  };
}
