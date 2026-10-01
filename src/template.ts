export interface TemplateOptions {
  locale?: string;
  formatDate?: (value: string) => string;
}

function readField(item: unknown, path: string): unknown {
  let value = item;
  for (const key of path.split(".")) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, key)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

// Standard HTML attributes only. No dependency on Astro, blog fields or assets.
export function createTemplateRenderer(options: TemplateOptions = {}) {
  const dateFormatter = new Intl.DateTimeFormat(options.locale ?? "pt-BR", {
    year: "numeric", month: "long", day: "numeric",
  });
  const formatDate = options.formatDate ?? ((value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
  });

  function fill(fragment: DocumentFragment, item: unknown) {
    for (const container of fragment.querySelectorAll<HTMLElement>("[data-search-each]")) {
      const template = container.querySelector<HTMLTemplateElement>("template");
      const values = readField(item, container.dataset.searchEach!);
      if (!template) continue;
      const children = document.createDocumentFragment();
      if (Array.isArray(values)) {
        for (const value of values) children.append(render(template, value));
      }
      container.replaceChildren(children);
      container.hidden = !Array.isArray(values) || values.length === 0;
    }
    // Repeated children have already been bound to their own item, not the parent.
    const elements = [...fragment.querySelectorAll<HTMLElement>("*")]
      .filter((element) => !element.closest("[data-search-each]"));
    for (const element of elements) {
      if (element.dataset.searchText !== undefined) {
        element.textContent = text(readField(item, element.dataset.searchText));
      }
      // Set srcset/sizes before src so inserted images have their full selection data.
      for (const attribute of ["href", "srcset", "sizes", "width", "height", "alt", "src"] as const) {
        const field = element.getAttribute(`data-search-${attribute}`);
        if (field === null) continue;
        const value = text(readField(item, field));
        if (value) element.setAttribute(attribute, value);
        else element.removeAttribute(attribute);
      }
      if (element.dataset.searchDate !== undefined) {
        const value = text(readField(item, element.dataset.searchDate));
        if (value) element.setAttribute("datetime", value);
        else element.removeAttribute("datetime");
        element.textContent = value ? formatDate(value) : "";
      }
      if (element.dataset.searchTransition !== undefined) {
        const value = text(readField(item, element.dataset.searchTransition));
        element.style.viewTransitionName = value
          ? value + (element.dataset.searchTransitionSuffix ?? "") : "none";
      }
    }
    return fragment;
  }

  function render(template: HTMLTemplateElement, item: unknown): DocumentFragment {
    return fill(template.content.cloneNode(true) as DocumentFragment, item);
  }
  return render;
}
