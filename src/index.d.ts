import type { SearchBarProps, ResultsGridProps } from "./component-props.js";

export declare const SearchBar: (props: SearchBarProps) => any;
export declare const ResultsGrid: (props: ResultsGridProps) => any;
export { defineSearchConfig, defaultSearchConfig } from "./config.js";
export type { SearchConfig } from "./config.js";
export type { SearchSettings, SearchState, SearchStatus } from "./core.js";
export type { SearchBarProps, ResultsGridProps, SearchMessages } from "./component-props.js";
export { getSearchTranslations } from "./i18n.js";
export type { SearchLabels } from "./i18n.js";
export type { NormalizationOptions, SerializableNormalizationOptions } from "./normalization.js";
