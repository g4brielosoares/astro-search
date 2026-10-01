import type { SearchSettings } from "./core.js";
import type { SearchLabels, SearchMessages } from "./i18n.js";

export interface SearchConfig extends SearchSettings {
  pageURL: string;
  queryParam: string;
  labels?: Partial<SearchLabels>;
  messages?: Partial<SearchMessages>;
  direction?: "auto" | "ltr" | "rtl";
}

export const defaultSearchConfig: SearchConfig = {
  locale: "pt-BR",
  normalization: {},
  pageURL: "/busca/",
  indexURL: "/search.json",
  queryParam: "q",
  keys: [
    { name: "title", weight: 3 },
    { name: "description", weight: 2 },
    { name: "searchText", weight: 1 },
  ],
  limit: 50,
};

export function defineSearchConfig(config: Partial<SearchConfig> = {}): SearchConfig {
  return { ...defaultSearchConfig, ...config };
}
