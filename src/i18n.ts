export interface SearchLabels {
  label: string;
  placeholder: string;
  button: string;
}

export interface SearchMessages {
  idle: string;
  invalid: string;
  loading: string;
  empty: string;
  error: string;
  singular: string;
  plural: string;
  /** Optional labels for languages with additional plural categories. */
  countLabels?: Partial<Record<Intl.LDMLPluralRule, string>>;
}

type Translation = { labels: SearchLabels; messages: SearchMessages; found: [string, string] };
const translations: Record<string, Translation> = {
  pt: {
    labels: { label: "Buscar", placeholder: "Título, palavra-chave...", button: "Buscar" },
    messages: { idle: "Digite um termo para buscar.", invalid: "Digite termos mais específicos.", loading: "Buscando...", empty: "Nenhum resultado encontrado.", error: "Não foi possível realizar a busca. Tente novamente.", singular: "resultado encontrado", plural: "resultados encontrados" },
    found: ["{item} encontrado", "{item} encontrados"],
  },
  en: {
    labels: { label: "Search", placeholder: "Title, keyword...", button: "Search" },
    messages: { idle: "Enter a search term.", invalid: "Enter more specific terms.", loading: "Searching...", empty: "No results found.", error: "Search failed. Please try again.", singular: "result found", plural: "results found" },
    found: ["{item} found", "{item} found"],
  },
  es: {
    labels: { label: "Buscar", placeholder: "Título, palabra clave...", button: "Buscar" },
    messages: { idle: "Introduce un término de búsqueda.", invalid: "Introduce términos más específicos.", loading: "Buscando...", empty: "No se encontraron resultados.", error: "No se pudo realizar la búsqueda. Inténtalo de nuevo.", singular: "resultado encontrado", plural: "resultados encontrados" },
    found: ["{item} encontrado", "{item} encontrados"],
  },
  fr: {
    labels: { label: "Rechercher", placeholder: "Titre, mot-clé...", button: "Rechercher" },
    messages: { idle: "Saisissez un terme de recherche.", invalid: "Saisissez des termes plus précis.", loading: "Recherche en cours...", empty: "Aucun résultat trouvé.", error: "La recherche a échoué. Réessayez.", singular: "résultat trouvé", plural: "résultats trouvés" },
    found: ["{item} trouvé", "{item} trouvés"],
  },
  de: {
    labels: { label: "Suchen", placeholder: "Titel, Stichwort...", button: "Suchen" },
    messages: { idle: "Geben Sie einen Suchbegriff ein.", invalid: "Geben Sie genauere Suchbegriffe ein.", loading: "Suche läuft...", empty: "Keine Ergebnisse gefunden.", error: "Die Suche ist fehlgeschlagen. Bitte versuchen Sie es erneut.", singular: "Ergebnis gefunden", plural: "Ergebnisse gefunden" },
    found: ["{item} gefunden", "{item} gefunden"],
  },
  it: {
    labels: { label: "Cerca", placeholder: "Titolo, parola chiave...", button: "Cerca" },
    messages: { idle: "Inserisci un termine di ricerca.", invalid: "Inserisci termini più specifici.", loading: "Ricerca in corso...", empty: "Nessun risultato trovato.", error: "Ricerca non riuscita. Riprova.", singular: "risultato trovato", plural: "risultati trovati" },
    found: ["{item} trovato", "{item} trovati"],
  },
};

export function getSearchTranslations(locale = "pt-BR") {
  const translation = translations[new Intl.Locale(locale).language] ?? translations.en;
  return {
    labels: { ...translation.labels },
    messages: { ...translation.messages },
    formatFound(item: string, plural = false) {
      return translation.found[plural ? 1 : 0].replace("{item}", item);
    },
  };
}
