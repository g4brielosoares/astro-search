# Changelog

## 0.3.0

- Configuração serializável de locale, stopwords, acentos e tokenização compartilhada entre build e cliente.
- Catálogos de interface e presets de stopwords para pt/en/es/fr/de/it; traduções próprias para outros idiomas.
- Segmentação de idiomas sem espaços com Intl.Segmenter, suporte Unicode e comparação configurável de acentos no Fuse.
- Datas e números localizados, categorias de pluralização e direção do texto configurável.
- README com rotas/índices por idioma, índice multilíngue, exemplos Astro e configuração compartilhada de srcset.

## 0.2.0

- Pacote renomeado para `astro-search`.
- API composta por `SearchBar` e `ResultsGrid`.
- Modo `unstyled`, classes do input/botão/label e slot de botão.
- Slots para todos os estados, bindings de consulta/contagem e evento `search:state`.
- Título da página passa a ser responsabilidade do projeto.

## 0.1.0

- Núcleo genérico com Fuse sob demanda, cache compartilhado e controle de concorrência.
- Componentes Astro com formulário independente, slot de item e navegação via ClientRouter.
- Templates HTML com campos, datas, atributos responsivos e repetições.
- Helpers de endpoint estático, texto compacto e imagens otimizadas no build.
- Estilos nativos dos componentes, sem dependência de Tailwind.
