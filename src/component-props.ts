import type { SearchConfig } from "./config.js";
import type { SearchMessages } from "./i18n.js";
export type { SearchMessages } from "./i18n.js";

export interface SearchBarProps {
  config?: SearchConfig;
  class?: string;
  action?: string;
  id?: string;
  indexURL?: string;
  queryParam?: string;
  locale?: string;
  direction?: "auto" | "ltr" | "rtl";
  label?: string;
  placeholder?: string;
  buttonLabel?: string;
  unstyled?: boolean;
  inputClass?: string;
  buttonClass?: string;
  labelClass?: string;
  labelHidden?: boolean;
}

export interface ResultsGridProps {
  direction?: "auto" | "ltr" | "rtl";
  config?: SearchConfig;
  class?: string;
  queryParam?: string;
  gridClass?: string;
  itemLabel?: string;
  itemsLabel?: string;
  locale?: string;
  messages?: Partial<SearchMessages>;
  unstyled?: boolean;
}
