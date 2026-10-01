const portugueseStopwords = new Set([
  "a", "ainda", "ao", "aos", "aquela", "aquelas", "aquele", "aqueles", "aquilo",
  "as", "ate", "com", "como", "contra", "da", "das", "de", "dela", "delas",
  "dele", "deles", "depois", "do", "dos", "e", "ela", "elas", "ele", "eles",
  "em", "entre", "era", "eram", "essa", "essas", "esse", "esses", "esta", "estas",
  "este", "estes", "eu", "foi", "for", "foram", "ha", "isso", "isto", "ja", "la",
  "lhe", "lhes", "mais", "mas", "me", "mesmo", "meu", "meus", "minha", "minhas",
  "muito", "na", "nao", "nas", "nem", "no", "nos", "nossa", "nossas", "nosso",
  "nossos", "o", "onde", "os", "ou", "outra", "outras", "outro", "outros", "para",
  "pela", "pelas", "pelo", "pelos", "por", "porque", "qual", "quais", "quando", "que",
  "quem", "se", "sem", "sera", "seu", "seus", "sua", "suas", "tambem", "te", "tem",
  "tendo", "tenha", "ter", "teu", "teus", "tinha", "todo", "todos", "tua", "tuas",
  "um", "uma", "umas", "uns", "voce", "voces", "vos", "vossa", "vossas", "vosso", "vossos",
]);

export interface SerializableNormalizationOptions {
  stopwords?: readonly string[] | false;
  tokenizer?: "auto" | "unicode" | "segmenter";
  removeDiacritics?: boolean;
}

export interface NormalizationOptions extends Omit<SerializableNormalizationOptions, "stopwords"> {
  locale?: string;
  stopwords?: ReadonlySet<string> | readonly string[] | false;
}

// Basic presets; applications can replace or disable the lists for any locale.
const stopwordPresets: Record<string, readonly string[]> = {
  pt: [...portugueseStopwords],
  en: "a an the and or but of to in on at by for from with without is are was were be been being it its this that these those i you he she we they my your his her our their as".split(" "),
  es: "a al el la los las un una unos unas de del en y o que con sin por para es son ser su sus este esta estos estas".split(" "),
  fr: "a au aux le la les un une des de du et ou en dans avec sans pour par est sont etre ce cette ces son sa ses".split(" "),
  de: "der die das ein eine einer eines und oder von zu in an auf mit ohne fur ist sind sein den dem des".split(" "),
  it: "il lo la i gli le un uno una di del della e o in con senza per da che e sono essere".split(" "),
};

const normalizers = new Map<string, (value: string) => string[]>();

export function getSearchTerms(value: string, options: NormalizationOptions = {}): string[] {
  const locale = options.locale ?? "pt-BR";
  const language = new Intl.Locale(locale).language;
  const words = options.stopwords === false ? []
    : options.stopwords ? [...options.stopwords] : stopwordPresets[language] ?? [];
  const mode = options.tokenizer ?? "auto";
  const removeDiacritics = options.removeDiacritics ?? true;
  const key = JSON.stringify([locale, words, mode, removeDiacritics]);
  let normalize = normalizers.get(key);
  if (!normalize) {
    const clean = (text: string) => {
      const lower = text.toLocaleLowerCase(locale);
      return removeDiacritics
        ? lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        : lower.normalize("NFC");
    };
    const stopwords = new Set(words.map(clean));
    const useSegmenter = mode === "segmenter"
      || (mode === "auto" && ["zh", "ja", "th", "lo", "km", "my"].includes(language));
    const segmenter = useSegmenter && typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter(locale, { granularity: "word" }) : undefined;
    normalize = (text) => {
      const cleaned = clean(text);
      const terms = segmenter
        ? [...segmenter.segment(cleaned)].filter((part) => part.isWordLike).map((part) => part.segment)
        : cleaned.match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
      return terms.filter((term) => !stopwords.has(term));
    };
    normalizers.set(key, normalize);
  }
  return normalize(value);
}

export function normalizeSearchText(value: string, options: NormalizationOptions = {}): string {
  return getSearchTerms(value, options).join(" ");
}
