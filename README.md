# astro-search

Busca estática para Astro com dois componentes independentes: `SearchBar` envia a consulta e `ResultsGrid` apresenta os resultados usando HTML definido pelo projeto. O índice e as imagens podem ser gerados no build; a pesquisa acontece no navegador com Fuse carregado sob demanda.

Versão: **0.3.0**. Compatibilidade declarada: **Astro ^7.2.0** e **Node >=22.12.0**. O pacote está disponível neste workspace e como `.tgz`; esta versão não foi publicada em um registry.

## Como ler esta documentação

| Objetivo                                        | Seção                                                       |
| ----------------------------------------------- | ----------------------------------------------------------- |
| Entender o funcionamento e as responsabilidades | [Funcionamento e escopo](#escopo)                           |
| Instalar no projeto atual ou em outro projeto   | [Instalação](#instalacao)                                   |
| Montar uma busca funcional do início ao fim     | [Primeira integração](#primeira-integracao)                 |
| Adaptar dados, campos e cards                   | [Contrato do índice](#contrato)                             |
| Usar Content Collections ou entender este blog  | [Fontes de conteúdo](#fontes)                               |
| Reutilizar um componente Astro nas listagens    | [Template reutilizável](#template)                          |
| Alterar textos, estados, CSS e componentes      | [Componentes e apresentação](#componentes)                  |
| Configurar imagens, srcset e sizes              | [Imagens](#imagens)                                         |
| Configurar idiomas e índices                    | [i18n](#i18n)                                               |
| Consultar opções e APIs disponíveis             | [Referência da API](#api)                                   |
| Avaliar limites e resolver problemas            | [Limites](#limites) e [Diagnóstico](#diagnostico)           |
| Atualizar ou desenvolver o pacote               | [Migração](#migracao) e [Desenvolvimento](#desenvolvimento) |

Os exemplos da primeira integração formam um conjunto: configuração, endpoint e template usam os mesmos campos. Os exemplos de adaptação indicam suas dependências e os arquivos que precisam mudar. O endpoint deste repositório tem uma estrutura própria, descrita em [Fontes de conteúdo](#fontes).

<a id="escopo"></a>

## 1. Funcionamento e escopo

### O que acontece no build e no navegador

| Etapa                                              | Responsável                             | Resultado                                    |
| -------------------------------------------------- | --------------------------------------- | -------------------------------------------- |
| Selecionar documentos públicos e definir suas URLs | Projeto, em `getItems`/`mapItem`        | Dados que podem entrar no índice             |
| Normalizar e compactar o corpo                     | `createSearchText`, opcional            | Termos únicos para pesquisa                  |
| Emitir o JSON estático                             | Astro + `createSearchEndpoint`          | Arquivo de índice publicado junto do site    |
| Otimizar imagens locais                            | Astro + `getSearchImage`, opcional      | Assets e atributos HTML responsivos          |
| Gerar o HTML do card                               | Componente Astro ou HTML no slot `item` | Estrutura inativa dentro de `<template>`     |
| Enviar a consulta                                  | `SearchBar`                             | Navegação GET, por exemplo `/busca/?q=astro` |
| Carregar índice e Fuse e pesquisar                 | `core`, chamado por `ResultsGrid`       | Documentos ordenados por relevância          |
| Clonar/preencher cards e exibir o estado           | `ResultsGrid` + `template`              | HTML inserido no DOM                         |

Um componente `.astro` usado no slot é executado no build. O navegador não executa seu frontmatter novamente para cada resultado: ele clona o HTML e preenche os atributos `data-search-*`. Imagens já chegam como URLs de assets; não são transformadas pelo navegador.

### Divisão de responsabilidades

| O pacote fornece                        | O projeto define                                        |
| --------------------------------------- | ------------------------------------------------------- |
| Mecanismo de pesquisa e cache           | Fonte dos dados, publicação e atualização do conteúdo   |
| Formulário e controle dos estados       | Rotas, URLs, layout, título/h1 e SEO                    |
| Clonagem e bindings de HTML             | Estrutura e estilos do card                             |
| Helpers de índice, texto e imagens      | Campos enviados no JSON e opções das imagens            |
| Normalização e textos padrão por idioma | Idiomas do site, traduções próprias e seleção do índice |

O uso normal não exige React, hidratação, Tailwind, backend de busca nem integração adicional no `astro.config`. `ClientRouter` é opcional. Os detalhes do cache, de navegação e dos recursos ausentes estão em [Limites](#limites).

<a id="instalacao"></a>

## 2. Instalação

### Neste repositório

O pacote já está conectado como workspace:

```bash
npm ci
npm run dev
```

Os hooks de `dev`, `check` e `build` compilam o pacote antes de utilizá-lo. Não adicione outra cópia da implementação ao site.

### Em outro projeto Astro

Instale o arquivo gerado na pasta `artifacts`:

```bash
npm install /caminho/astro-search-0.3.0.tgz
```

Esse comando pressupõe um projeto Astro existente na faixa compatível. O `.tgz` contém JavaScript compilado, tipos, componentes `.astro`, README e changelog. O consumidor não precisa copiar fontes, configurar aliases do pacote nem compilar seu TypeScript.

Para gerar a distribuição, execute na raiz deste workspace:

```bash
npm pack --workspace astro-search --pack-destination artifacts
```

Se o pacote for extraído para um repositório próprio, execute `npm install` e `npm pack` na pasta dele. Instalação por registry depende de publicação. Instalação direta por Git exige disponibilizar o build, porque `dist` é ignorado neste workspace. O caminho validado é a instalação do `.tgz`.

<a id="primeira-integracao"></a>

## 3. Primeira integração: um exemplo completo

Este exemplo usa dois guias em um array local. Não pressupõe Content Collections, campos de um blog ou helpers deste repositório. As páginas de destino também são criadas, para os links do índice funcionarem.

Use os caminhos abaixo em um projeto Astro existente. Se já houver arquivos nessas rotas, integre o conteúdo a eles em vez de substituir a implementação existente.

```text
src/
  config/search.ts
  data/guides.ts
  pages/
    search.json.ts
    busca.astro
    guias.astro
```

### Passo 1 — Definir os documentos

**Arquivo: `src/data/guides.ts`**

```ts
export type Guide = {
  slug: string;
  title: string;
  description: string;
  body: string;
};

export const guides: Guide[] = [
  {
    slug: "astro",
    title: "Primeiros passos com Astro",
    description: "Como construir páginas estáticas.",
    body: "Astro gera páginas estáticas durante o build.",
  },
  {
    slug: "imagens",
    title: "Imagens responsivas",
    description: "Como usar srcset e sizes.",
    body: "O navegador escolhe a imagem adequada com srcset e sizes.",
  },
];
```

### Passo 2 — Compartilhar a configuração

**Arquivo: `src/config/search.ts`**

```ts
import { defineSearchConfig } from "astro-search/config";

export const searchConfig = defineSearchConfig({
  locale: "pt-BR",
  pageURL: "/busca/",
  indexURL: "/search.json",
  queryParam: "q",
  keys: [
    { name: "title", weight: 3 },
    { name: "description", weight: 2 },
    { name: "searchText", weight: 1 },
  ],
});
```

Esses já são os valores padrão; estão explícitos para mostrar a relação entre arquivos. `pageURL` deve apontar para a página com `ResultsGrid`, `indexURL` para o endpoint JSON e `keys` para campos existentes no JSON. Configurar uma URL não cria sua rota.

### Passo 3 — Gerar o índice

**Arquivo: `src/pages/search.json.ts`**

```ts
import { createSearchEndpoint, createSearchText } from "astro-search/astro";
import { searchConfig } from "../config/search";
import { guides } from "../data/guides";

export const prerender = true;

export const GET = createSearchEndpoint({
  getItems: () => guides,
  mapItem: (guide) => ({
    url: `/guias/#${guide.slug}`,
    title: guide.title,
    description: guide.description,
    searchText: createSearchText(guide.body, searchConfig),
  }),
});
```

`mapItem` define o documento enviado ao navegador. O corpo original não é enviado: neste exemplo, só entram seus termos normalizados. O mesmo `searchConfig` determina as regras de normalização durante o build e na consulta.

O primeiro documento terá esta estrutura em `/search.json`:

```json
{
  "url": "/guias/#astro",
  "title": "Primeiros passos com Astro",
  "description": "Como construir páginas estáticas.",
  "searchText": "astro gera paginas estaticas durante build"
}
```

O endpoint retorna um **array** desses documentos. `url` é usado pelo card; não precisa fazer parte de `keys`.

### Passo 4 — Criar a página de busca

**Arquivo: `src/pages/busca.astro`**

```astro
---
import { SearchBar, ResultsGrid } from "astro-search";
import { searchConfig } from "../config/search";
---
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Busca</title>
  </head>
  <body>
    <main>
      <h1>Busca</h1>
      <SearchBar config={searchConfig} />
      <ResultsGrid config={searchConfig}>
        <article slot="item">
          <a data-search-href="url">
            <h2 data-search-text="title"></h2>
          </a>
          <p data-search-text="description"></p>
        </article>
      </ResultsGrid>
    </main>
  </body>
</html>
```

Em um site existente, use seu layout no lugar do documento HTML acima. A barra também pode ficar no header ou em outra página: não precisa estar junto do grid. O grid lê a consulta da URL ao carregar a página.

### Passo 5 — Criar o destino dos links

**Arquivo: `src/pages/guias.astro`**

```astro
---
import { guides } from "../data/guides";
---
<html lang="pt-BR">
  <head><meta charset="UTF-8" /><title>Guias</title></head>
  <body>
    <main>
      <h1>Guias</h1>
      {guides.map((guide) => (
        <article id={guide.slug}>
          <h2>{guide.title}</h2>
          <p>{guide.description}</p>
          <p>{guide.body}</p>
        </article>
      ))}
    </main>
  </body>
</html>
```

### Passo 6 — Conferir o resultado

Execute `npm run dev` e verifique:

| URL/ação                     | Resultado esperado                                           |
| ---------------------------- | ------------------------------------------------------------ |
| `/search.json`               | Array com dois documentos e as quatro chaves do adaptador    |
| `/busca/`                    | Estado inicial pedindo um termo                              |
| `/busca/?q=astro`            | Card “Primeiros passos com Astro”                            |
| `/busca/?q=srcset`           | Card “Imagens responsivas”                                   |
| `/busca/?q=de+com`           | Estado inválido, porque os termos são stopwords de português |
| `/busca/?q=zzzzzzzzzz`       | Estado sem resultados                                        |
| Clicar no primeiro resultado | Navegação para `/guias/#astro`                               |

Depois, execute `npm run build` e confirme a emissão do JSON, da página e dos assets. O teste no navegador depende de JavaScript habilitado.

<a id="contrato"></a>

## 4. Contrato do índice: dados, keys e bindings

O pacote não exige campos chamados `title`, `frontmatter` ou `image`. Exige que três partes concordem:

| Parte              | Função                        | Exemplo plano        | Exemplo deste blog                    |
| ------------------ | ----------------------------- | -------------------- | ------------------------------------- |
| `mapItem`          | Define a estrutura do JSON    | `{ title: "Astro" }` | `{ frontmatter: { title: "Astro" } }` |
| `config.keys`      | Escolhe onde pesquisar        | `"title"`            | `"frontmatter.title"`                 |
| `data-search-text` | Escolhe o que mostrar no card | `"title"`            | `"frontmatter.title"`                 |

Campos usados apenas para apresentação podem ficar fora de `keys`. Campos pesquisáveis podem ficar fora do card. A estrutura do JSON é pública: envie somente os dados necessários e autorizados para publicação.

### Trocar para um formato aninhado

Se o endpoint passar a retornar:

```ts
mapItem: (guide) => ({
  url: `/guias/#${guide.slug}`,
  metadata: {
    title: guide.title,
    description: guide.description,
  },
  searchText: createSearchText(guide.body, searchConfig),
});
```

Atualize as chaves no config:

```ts
keys: [
  { name: "metadata.title", weight: 3 },
  { name: "metadata.description", weight: 2 },
  { name: "searchText", weight: 1 },
];
```

E os bindings no item:

```html
<a data-search-href="url"><h2 data-search-text="metadata.title"></h2></a>
<p data-search-text="metadata.description"></p>
```

Os três trechos são alterações aos arquivos da primeira integração. Não combine o config aninhado com o endpoint plano. O pacote não detecta nem corrige essa incompatibilidade automaticamente.

### Escolher o tamanho do índice

`createSearchText` deduplica termos do corpo, reduzindo o JSON, mas perde frequência e parte da sequência do texto. Não faz parsing de Markdown: links e blocos de código podem contribuir com palavras. Se a frequência ou a sequência forem relevantes à sua busca, você pode enviar o corpo original em um campo pesquisável; avalie o tamanho transferido e o ranking.

Título, descrição, autor e tags podem continuar originais e receber pesos próprios em `keys`. Compactação não se aplica automaticamente a todos os campos. Imagens e tags são opcionais; remova seus bindings quando não forem usados, ou forneça um fallback no adaptador.

<a id="fontes"></a>

## 5. Fontes de conteúdo: coleções e implementação deste blog

### Adaptar a primeira integração a Content Collections

**Esta receita é para uma coleção com o schema abaixo.** Ela não reproduz o schema deste repositório. No projeto do tutorial, substitua o array local pela coleção; mantenha o contrato plano `url/title/description/searchText`, o config e o template já apresentados.

**Arquivo: `src/content.config.ts`**

```ts
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
```

Em um projeto com outras coleções, acrescente/ajuste essa definição sem substituir as existentes. Os slugs devem ser únicos e apropriados às URLs.

**Arquivo de conteúdo: `src/content/blog/astro.md`**

```md
---
slug: astro
title: Primeiros passos com Astro
description: Como construir páginas estáticas.
draft: false
---

Astro gera páginas estáticas durante o build.
```

**Substituição de `src/pages/search.json.ts`:**

```ts
import { getCollection } from "astro:content";
import { createSearchEndpoint, createSearchText } from "astro-search/astro";
import { searchConfig } from "../config/search";

export const prerender = true;

export const GET = createSearchEndpoint({
  getItems: () => getCollection("blog", ({ data }) => !data.draft),
  mapItem: (post) => ({
    url: `/posts/${post.data.slug}/`,
    title: post.data.title,
    description: post.data.description,
    searchText: createSearchText(post.body ?? "", searchConfig),
  }),
});
```

**Destino correspondente: `src/pages/posts/[slug].astro`**

```astro
---
import { getCollection, render } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: post.data.slug },
    props: { post },
  }));
}
const { post } = Astro.props;
const { Content } = await render(post);
---
<html lang="pt-BR">
  <head><meta charset="UTF-8" /><title>{post.data.title}</title></head>
  <body><main><h1>{post.data.title}</h1><Content /></main></body>
</html>
```

O filtro de publicados deve ser consistente entre índice e páginas. `draft` é uma escolha desta receita: se seu projeto usa `status`, datas ou permissões, aplique suas próprias regras. O pacote não filtra rascunhos nem cria páginas de destino.

### Endpoint real deste repositório

**Este trecho descreve a integração do blog no workspace. Não é um arquivo pronto para copiar em outro projeto.** Ele depende de aliases `@/`, dos helpers em `src/utils/blog.ts`, do tipo `SearchPost`, do asset de fallback e do schema da coleção deste site.

Aqui, a seleção usa `getPublishedPosts()` e o adaptador usa `getPostData()` para resolver dados e slug. O índice inclui imagem otimizada, URLs das tags, autor, data e `frontmatter`. Seu template é o `PostItem.astro` do projeto.

**Arquivo atual: `src/pages/search.json.ts`**

```ts
import placeholder from "@/assets/post-placeholder.png";
import { getPostData, getPublishedPosts, getTagPath } from "@/utils/blog";
import {
  createSearchEndpoint,
  createSearchText,
  getSearchImage,
} from "astro-search/astro";
import type { SearchPost } from "@/config/search";
import { searchConfig } from "@/config/search";

// This compact index is emitted as /search.json during the static build and is
// the only JSON downloaded by the search page.
export const prerender = true;

export const GET = createSearchEndpoint({
  getItems: getPublishedPosts,
  mapItem: async (post): Promise<SearchPost> => {
    const data = getPostData(post);

    return {
      url: `/blog/${data.slug}`,
      slug: data.slug,
      image: await getSearchImage(data.cover ?? placeholder),
      tags: data.tags.map((name) => ({ name, url: getTagPath(name) })),
      frontmatter: {
        title: data.title,
        description: data.description,
        author: data.author,
        tags: data.tags,
        pubDate: data.createdTime.toISOString(),
      },
      // Other frontmatter fields are indexed independently. Keeping this to the
      // Markdown body avoids counting title, description, author and tags twice.
      searchText: createSearchText(post.body ?? "", searchConfig),
    };
  },
});
```

A configuração correspondente usa as chaves abaixo:

**Trecho de `src/config/search.ts`**

```ts
import { defineSearchConfig } from "astro-search/config";

// Project preset.
export const searchConfig = defineSearchConfig({
  locale: "pt-BR",
  pageURL: "/busca/",
  queryParam: "q",
  indexURL: "/search.json",
  limit: 50,
  keys: [
    { name: "frontmatter.title", weight: 3 },
    { name: "frontmatter.description", weight: 2 },
    { name: "frontmatter.author", weight: 1.5 },
    { name: "frontmatter.tags", weight: 2 },
    { name: "searchText", weight: 1 },
  ],
});
```

| Campo enviado                         | Quem consome                               |
| ------------------------------------- | ------------------------------------------ |
| `url`                                 | Link do card, por `data-search-href="url"` |
| `slug`                                | Identificador da transição da capa         |
| `image.src/srcset/sizes/width/height` | Atributos da imagem do card                |
| `tags: [{ name, url }]`               | Repetição dos links de tags                |
| `frontmatter.title`                   | Chave de pesquisa e título do card         |
| `frontmatter.description/author/tags` | Chaves de pesquisa com pesos próprios      |
| `frontmatter.pubDate`                 | Data do card                               |
| `searchText`                          | Termos do corpo pesquisados pelo Fuse      |

O filtro atual considera `status` normalizado igual a `publicado`; não exclui automaticamente posts com data futura. O adaptador resolve ausência de capa com uma imagem padrão e usa `mapItem` assíncrono porque `getSearchImage` é assíncrono.

Trocar esse endpoint pelo exemplo plano exige trocar também as `keys` e os bindings de `PostItem`. Apenas trocar o endpoint faria a configuração continuar procurando `frontmatter.title` em documentos que possuem `title` na raiz.

No workspace, consulte o mapa [BUSCA-ASTRO.md](../../BUSCA-ASTRO.md). Esse arquivo e os caminhos `src/...` acima pertencem ao repositório; não são distribuídos com o pacote.

<a id="template"></a>

## 6. Template Astro reutilizável

Você pode usar HTML no slot ou um componente `.astro` que gere os mesmos bindings. `ResultsGrid` cria o `<template>` externo; não coloque outro `<template>` envolvendo o slot `item`.

Para compartilhar o card da primeira integração com uma listagem estática, crie **`src/components/GuideItem.astro`**:

```astro
---
import type { Guide } from "../data/guides";
interface Props { item?: Guide }
const { item } = Astro.props;
const template = !item;
---
<article id={item?.slug}>
  <a
    href={item ? `/guias/#${item.slug}` : undefined}
    data-search-href={template ? "url" : undefined}
  >
    <h2 data-search-text={template ? "title" : undefined}>{item?.title}</h2>
  </a>
  <p data-search-text={template ? "description" : undefined}>{item?.description}</p>
</article>
```

Na página de busca, importe `GuideItem` de `../components/GuideItem.astro` e substitua o HTML do slot:

```astro
<ResultsGrid config={searchConfig}>
  <GuideItem slot="item" />
</ResultsGrid>
```

Na listagem estática, use o mesmo componente com dados:

```astro
---
import GuideItem from "../components/GuideItem.astro";
import { guides } from "../data/guides";
---
{guides.map((item) => <GuideItem item={item} />)}
```

Esse último trecho pode substituir as listagens de `guias.astro`; se quiser manter o corpo completo de cada guia, componha esse conteúdo na página. Os imports são relativos a arquivos em `src/pages`.

| Modo                        | Execução                                              | Dados                                    |
| --------------------------- | ----------------------------------------------------- | ---------------------------------------- |
| `<GuideItem item={item} />` | Astro renderiza no build                              | Props disponíveis no frontmatter         |
| `<GuideItem slot="item" />` | Astro gera a estrutura no build; cliente clona depois | Campos do JSON resolvidos pelos bindings |

O componente pertence ao projeto, não ao pacote. Pode ser usado em outras listagens estáticas. Classes, layout e markup são livres, desde que os bindings correspondam aos dados do índice.

### Limites do template

- O JSON não vira props Astro no navegador. Condicionais como `{item ? ... : ...}` são decididas no build, não por resultado.
- O renderizador preenche somente os bindings documentados. Não há `data-search-html`, expressões JavaScript, interpolação de strings em caminhos ou binding genérico de qualquer atributo.
- `data-search-text` substitui o conteúdo do elemento por texto. Use-o no elemento folha, para não apagar ícones ou elementos filhos que deseja preservar.
- IDs fixos dentro do template seriam duplicados em cada clone. Use estrutura sem IDs fixos ou uma implementação cliente própria quando precisar gerá-los.
- Scripts/eventos próprios do card e ilhas hidratadas não têm inicialização por resultado garantida. Para comportamento interativo, use delegação de eventos no container ou inicialização própria após `search:state`.
- Sem uma imagem válida, remover `src` não cria um placeholder nem esconde o `<img>`. Forneça fallback no adaptador ou retire a imagem do template.

### Referência dos bindings

Os valores dos atributos indicam caminhos no objeto JSON, separados por ponto. Textos são preenchidos com `textContent`, sem executar HTML dos dados.

| Atributo                        | Exemplo        | Operação                    |
| ------------------------------- | -------------- | --------------------------- |
| `data-search-text`              | `title`        | Texto de string/número      |
| `data-search-href`              | `url`          | href                        |
| `data-search-src`               | `image.src`    | src                         |
| `data-search-srcset`            | `image.srcset` | srcset                      |
| `data-search-sizes`             | `image.sizes`  | sizes                       |
| `data-search-width`             | `image.width`  | width                       |
| `data-search-height`            | `image.height` | height                      |
| `data-search-alt`               | `title`        | alt                         |
| `data-search-date`              | `pubDate`      | datetime e texto da data    |
| `data-search-transition`        | `slug`         | viewTransitionName          |
| `data-search-transition-suffix` | `-cover`       | Sufixo literal opcional     |
| `data-search-each`              | `tags`         | Repetição de template filho |

Campos ausentes viram texto vazio; atributos sem valor são removidos. Datas inválidas produzem texto vazio. Os dados do índice devem conter URLs apropriadas: o renderizador não valida URLs nem substitui uma política de validação de fontes externas.

### Repetir arrays de objetos

Para um índice que contenha `tags: [{ name: "Astro", url: "/tags/astro/" }]`:

```html
<div data-search-each="tags">
  <template>
    <a data-search-text="name" data-search-href="url" rel="tag"></a>
  </template>
</div>
```

Dentro do template, os caminhos são relativos ao objeto repetido. O container fica oculto para arrays vazios/ausentes; seus filhos dentro do template recebem os bindings. A mesma regra funciona para características de produtos, categorias e outros arrays de objetos.

<a id="componentes"></a>

## 7. Componentes, estados e apresentação

Os exemplos desta seção são trechos de composição que reutilizam `searchConfig` e `GuideItem` das seções anteriores; importe-os no arquivo Astro em que forem utilizados. As tabelas abaixo são a referência das props públicas. As props individuais sobrescrevem os valores da configuração aplicáveis ao componente.

### SearchBar

| Prop                                      | Padrão                                                     |
| ----------------------------------------- | ---------------------------------------------------------- |
| `config`                                  | `defaultSearchConfig`                                      |
| `action`, `indexURL`, `queryParam`        | Valores do config; props individuais podem sobrescrevê-los |
| `id`                                      | `site-search`                                              |
| `locale`, `direction`                     | Valores do config; podem ser sobrescritos                  |
| `label`                                   | Texto do catálogo/config do idioma                         |
| `buttonLabel`                             | Texto do catálogo/config do idioma                         |
| `placeholder`                             | Texto do catálogo/config do idioma                         |
| `class`                                   | Classe extra do formulário                                 |
| `unstyled`                                | `false`; desativa estilos visuais do pacote                |
| `inputClass`, `buttonClass`, `labelClass` | Classes dos elementos internos                             |
| `labelHidden`                             | `true`; label visualmente oculto, mas acessível            |

O formulário envia GET. Foco ou digitação solicita um `link rel="prefetch"` para o índice, uma vez por input, sem duplicar links no head. Digitar não executa a consulta. O navegador decide se fará/reaproveitará o prefetch.

Múltiplas barras na mesma página devem receber IDs diferentes para os labels. O script sincroniza o valor de cada input com o parâmetro correspondente da URL, tanto na entrada inicial quanto em `astro:page-load`.

### ResultsGrid

| Prop                      | Padrão                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `config`                  | `defaultSearchConfig`                                                                                        |
| `queryParam`              | Valor do config                                                                                              |
| `itemLabel`, `itemsLabel` | Opcionais; personalizam os labels da contagem                                                                |
| `locale`                  | Valor do config; interface, normalização e formatação                                                        |
| `direction`               | Valor do config, ou `auto`                                                                                   |
| `gridClass`               | Vazio: grid nativo de uma coluna ou duas a partir de 768 px                                                  |
| `class`                   | Classe extra do container                                                                                    |
| `unstyled`                | `false`; desativa espaçamentos e a grade padrão                                                              |
| `messages`                | Sobrescritas dos textos `idle`, `invalid`, `loading`, `empty`, `error`, `singular`, `plural` e `countLabels` |

O slot nomeado `item` define o card. O componente não renderiza título ou h1; essa estrutura pertence à página. Com `gridClass`, o projeto assume a estilização da grade; o grid padrão deixa de ser aplicado. Isso permite usar Tailwind, CSS próprio ou outro sistema visual sem configurar scanning de classes do pacote.

Exemplo de textos personalizados:

```astro
<ResultsGrid
  config={searchConfig}
  messages={{ loading: "Procurando…", singular: "item encontrado", plural: "itens encontrados" }}
>
  <GuideItem slot="item" />
</ResultsGrid>
```

### Estados e contagens

| Estado    | Quando aparece                                                      |
| --------- | ------------------------------------------------------------------- |
| `idle`    | Consulta vazia                                                      |
| `invalid` | A normalização remove todos os termos, por exemplo apenas stopwords |
| `loading` | Carregando índice/Fuse e calculando a consulta                      |
| `success` | Há documentos retornados                                            |
| `empty`   | Consulta válida, sem documentos retornados                          |
| `error`   | Falha ao carregar/processar índice ou pesquisar                     |

`minMatchCharLength` não determina o estado `invalid`: é uma opção de correspondência do Fuse. O pacote não valida o formato inteiro da configuração; use valores e códigos de locale válidos.

### Composição atômica e estados por slots

```astro
<h1>Busca</h1>
<SearchBar config={searchConfig} />
<ResultsGrid config={searchConfig}>
  <GuideItem slot="item" />
  <p slot="idle">Digite um termo para buscar.</p>
  <p slot="invalid">Digite termos mais específicos.</p>
  <p slot="loading">Buscando...</p>
  <p slot="empty">Nenhum resultado encontrado.</p>
  <p slot="error">Não foi possível carregar a busca.</p>
  <p slot="success">
    <span data-search-count></span> <span data-search-count-label></span>
    para “<span data-search-query></span>”.
  </p>
</ResultsGrid>
```

Cada estado tem um fallback textual e pode receber HTML ou componente Astro pelo slot de mesmo nome. A estrutura dos slots é gerada no build e preservada; o cliente alterna sua visibilidade. Apenas um estado fica visível de cada vez. `item` continua sendo um template clonado para cada resultado.

`data-search-query`, `data-search-count` e `data-search-count-label` preenchem spans nos estados. São bindings de estado, distintos dos bindings de campo dentro do template `item`.

A contagem representa itens retornados, limitada pelo config. O slot `success` recebe a contagem; `empty` possui mensagem própria. Não há título de página embutido no grid.

O elemento raiz emite o evento DOM `search:state`, com bubbles e detail `{ query, status, count }`, depois de atualizar a interface. A página pode ouvi-lo para atualizar um heading externo, telemetria ou outra apresentação. O evento não altera a URL nem executa outra busca.

### Estilos totalmente controlados pelo projeto

```astro
<SearchBar
  config={searchConfig}
  unstyled
  class="flex gap-2"
  inputClass="border rounded px-3 py-2"
  buttonClass="rounded px-4 py-2"
>
  <span slot="button">Pesquisar</span>
</SearchBar>

<ResultsGrid config={searchConfig} unstyled gridClass="grid gap-6 md:grid-cols-3">
  <GuideItem slot="item" />
</ResultsGrid>
```

`unstyled` desativa as regras visuais, incluindo largura do botão, padding, bordas, cores, espaçamentos e colunas. O CSS distribuído continua existindo, mas suas regras visuais dependem de um atributo que é omitido nesse modo. Permanecem somente regras estruturais de acessibilidade: estados hidden não são exibidos e o label continua visualmente oculto quando labelHidden é true. Use labelHidden=false para controlar a apresentação do label visível.

O slot `button` troca o conteúdo interno do botão mantendo o botão de submit acessível. Classes do item, dimensões e opções das imagens são definidas pelo projeto. Os helpers de imagem continuam opcionais e configuráveis.

### Variáveis CSS e acessibilidade

Os componentes possuem CSS nativo escopado. A barra aceita variáveis CSS: `--search-color`, `--search-background`, `--search-border`, `--search-placeholder`, `--search-focus` e `--search-hover`.

```css
.minha-barra {
  --search-color: #111;
  --search-background: #fff;
  --search-border: #bbb;
  --search-placeholder: #666;
  --search-focus: #333;
}
```

Passar `class="minha-barra"` ao formulário. A aparência do item é totalmente do projeto. O resultado utiliza `aria-live="polite"` e `aria-busy`; o formulário possui label e botão acessíveis.

Sem JavaScript, o formulário navega, mas a busca não calcula resultados. SEO (`noindex`, canonical e sitemap) pertence ao layout e às rotas do projeto; o pacote não decide essas políticas.

<a id="imagens"></a>

## 8. Imagens e configuração responsiva

```ts
import { getSearchImage } from "astro-search/astro";

// Trecho de um adaptador com capa obrigatória do tipo ImageMetadata:
const image = await getSearchImage(post.data.coverImage);
// { src, srcset, sizes, width, height }
```

O helper recebe `ImageMetadata` de um asset local/coleção do Astro. Resolver a ausência da capa no adaptador, por exemplo com uma imagem padrão importada. URLs de CDN podem ser incluídas diretamente no documento, sem chamar esse helper.

Padrões: WebP, largura 670, variantes 320/480/670 e `sizes` para a grade de cards. Podem ser personalizados com `SearchImageOptions` (`width`, `widths`, `sizes`, `format`, `quality`).

Para manter iguais as imagens do card estático e da busca:

```astro
---
import { Image } from "astro:assets";
import { defaultImageOptions } from "astro-search/astro";
---
<Image src={cover} alt={title} {...defaultImageOptions} />
```

No item que será clonado:

```html
<img
  data-search-src="image.src"
  data-search-srcset="image.srcset"
  data-search-sizes="image.sizes"
  data-search-width="image.width"
  data-search-height="image.height"
  data-search-alt="title"
  loading="lazy"
  decoding="async"
/>
```

Para opções próprias, compartilhar o mesmo objeto entre `Image` e `getSearchImage`. A mesma transformação permite ao pipeline do Astro reaproveitar assets. A configuração de `sizes` deve corresponder ao layout real do projeto.

Imagens e campos responsivos são opcionais. O núcleo não conhece seu formato; o renderizador apenas atribui atributos HTML. O JSON ganha metadados de imagens, não os arquivos binários delas. As imagens dos cards são carregadas pelo navegador após sua inserção.

### Configurar os tamanhos do srcset no projeto

Crie um objeto compartilhado em `src/config/listing-images.ts`:

```ts
import type { SearchImageOptions } from "astro-search/astro";

export const listingImageOptions = {
  width: 800,
  widths: [320, 480, 640, 800],
  sizes: "(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw",
  format: "webp" as const,
  quality: 80,
} satisfies SearchImageOptions;
```

No endpoint:

```ts
import { getSearchImage } from "astro-search/astro";
import { listingImageOptions } from "../config/listing-images";
// Dentro de mapItem:
const image = await getSearchImage(cover, listingImageOptions);
```

No card estático, o trecho abaixo pressupõe `cover` como `ImageMetadata` e `title` como string definidos pelas props/frontmatter. Ajuste o import se o card não estiver diretamente em `src/components`:

```astro
---
import { Image } from "astro:assets";
import { listingImageOptions } from "../config/listing-images";
---
<Image src={cover} alt={title} {...listingImageOptions} />
```

`widths` define as variantes candidatas do `srcset`; `sizes` informa quanto espaço a imagem ocupa no layout, para o navegador escolher uma variante. `width` define a largura principal e as dimensões intrínsecas; CSS controla o tamanho visual. Astro pode descartar larguras maiores que a imagem original para evitar ampliá-la. Ajuste os valores ao tamanho real dos cards e à resolução dos assets.

Os tamanhos, qualidade, formato e estilos pertencem ao projeto. Não é preciso alterar o pacote. O helper é opcional: também é possível gerar os atributos com `getImage` diretamente ou fornecer URLs de CDN. Veja a [API de imagens do Astro](https://docs.astro.build/en/reference/modules/astro-assets/).

O Astro gera os arquivos otimizados no build. O JSON contém somente URLs e atributos. Durante a busca, o cliente clona o HTML do card e preenche um `<img>` com esses valores; não executa componentes Astro nem transforma imagens no navegador. O mesmo card Astro pode ser usado em listagens estáticas e como template, compartilhando as opções acima.

<a id="i18n"></a>

## 9. i18n: busca por idioma e busca multilíngue

O pacote não precisa de uma integração adicional: `locale` e `normalization` são configurações serializáveis usadas pelos componentes Astro. Passe o mesmo config ao endpoint e aos componentes. O roteamento continua no projeto, seja com o i18n nativo do Astro, rotas próprias ou outra biblioteca.

### Um índice por idioma

Essa opção carrega apenas o conteúdo do idioma escolhido. A receita usa a coleção da seção 5, estendida com `lang: z.enum(["pt", "en"])` e `pubDate: z.coerce.date()` no schema. Cada Markdown precisa conter esses campos; slugs podem se repetir entre idiomas, mas devem ser únicos dentro de cada idioma.

Exemplo de frontmatter para o arquivo português:

```yaml
slug: astro
lang: pt
pubDate: 2026-01-02
title: Primeiros passos com Astro
description: Como construir páginas estáticas.
draft: false
```

Crie também o conteúdo inglês com `lang: en`, título/descrição/corpo traduzidos e os demais campos obrigatórios. Centralize as diferenças em `src/config/search.ts` com o export abaixo; se mantiver a página do tutorial, preserve também seu export `searchConfig`:

```ts
import { defineSearchConfig } from "astro-search/config";

export const searchByLanguage = {
  pt: defineSearchConfig({
    locale: "pt-BR",
    pageURL: "/pt/search/",
    indexURL: "/pt/search.json",
  }),
  en: defineSearchConfig({
    locale: "en-US",
    pageURL: "/en/search/",
    indexURL: "/en/search.json",
  }),
};
```

Uma página gera ambas as versões. Em `src/pages/[lang]/search.astro`:

```astro
---
import { SearchBar, ResultsGrid } from "astro-search";
import { searchByLanguage } from "../../config/search";

export function getStaticPaths() {
  return Object.entries(searchByLanguage).map(([lang, config]) => ({
    params: { lang },
    props: { config },
  }));
}
const { config } = Astro.props;
---
<html lang={config.locale}>
  <head><title>{config.locale === "pt-BR" ? "Busca" : "Search"}</title></head>
  <body>
    <SearchBar config={config} />
    <ResultsGrid config={config}>
      <article slot="item">
        <a data-search-href="url"><h2 data-search-text="title"></h2></a>
        <p data-search-text="description"></p>
        <time data-search-date="pubDate"></time>
      </article>
    </ResultsGrid>
  </body>
</html>
```

Em `src/pages/[lang]/search.json.ts`, gere o JSON correspondente:

```ts
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { createSearchEndpoint, createSearchText } from "astro-search/astro";
import { searchByLanguage } from "../../config/search";

export const prerender = true;
export function getStaticPaths() {
  return Object.entries(searchByLanguage).map(([lang, config]) => ({
    params: { lang },
    props: { lang, config },
  }));
}
export const GET: APIRoute = (context) => {
  const { lang, config } = context.props;
  return createSearchEndpoint({
    getItems: () =>
      getCollection("blog", ({ data }) => data.lang === lang && !data.draft),
    mapItem: (post) => ({
      url: `/${lang}/posts/${post.data.slug}/`,
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate.toISOString(),
      searchText: createSearchText(post.body ?? "", config),
    }),
  })(context);
};
```

Crie o destino correspondente em **`src/pages/[lang]/posts/[slug].astro`**:

```astro
---
import { getCollection, render } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { lang: post.data.lang, slug: post.data.slug },
    props: { post },
  }));
}
const { post } = Astro.props;
const { Content } = await render(post);
const locale = post.data.lang === "pt" ? "pt-BR" : "en-US";
---
<html lang={locale}>
  <head><meta charset="UTF-8" /><title>{post.data.title}</title></head>
  <body><main><h1>{post.data.title}</h1><Content /></main></body>
</html>
```

Com a configuração acima, cada idioma terá sua própria página, JSON e posts: `/pt/search/`, `/pt/search.json`, `/pt/posts/astro/` e as rotas equivalentes em `/en/`. Execute um build e confira se os documentos portugueses e ingleses aparecem somente em seus respectivos índices.

Adapte o filtro e as URLs ao contrato do seu conteúdo; o pacote não cria nem traduz arquivos Markdown. Se o site já possui rotas de posts, use as URLs reais no adaptador e mantenha suas páginas existentes.

No header, selecione o mesmo config usado pela página atual. `Astro.currentLocale` pode ajudar quando o roteamento i18n do Astro estiver configurado; mapeie os códigos/caminhos do seu site para `searchByLanguage`. O pacote não deduz idioma pela URL ou pelo navegador. Não há mistura entre índices distintos: cada URL possui seu próprio cache. Prefixos, domínios e `base` devem estar refletidos em `pageURL`, `indexURL` e nas URLs dos documentos.

Veja o [roteamento i18n do Astro](https://docs.astro.build/en/guides/internationalization/) e a [referência de rotas estáticas](https://docs.astro.build/en/reference/routing-reference/).

### Pesquisar vários idiomas juntos

Use um índice único com todos os documentos e desative stopwords. Assim, uma palavra comum em um idioma não é descartada dos conteúdos de outro:

```ts
import { defineSearchConfig } from "astro-search/config";

export const multilingualConfig = defineSearchConfig({
  locale: "pt-BR", // interface, datas, números e regras de caixa
  pageURL: "/search/",
  indexURL: "/search-all.json",
  normalization: { stopwords: false, tokenizer: "segmenter" },
});
// No adaptador de TODOS os documentos:
// searchText: createSearchText(post.body ?? "", multilingualConfig)
```

Inclua o idioma e a URL de cada documento no JSON para apresentar essa informação no card, se necessário. Para mostrar a interface em inglês usando o mesmo índice, crie outra configuração com `locale: "en-US"` e traduções apropriadas. Mantenha as opções de normalização iguais; idiomas com regras diferentes de caixa/segmentação, como turco, exigem uma política comum explícita ou índices separados. O pacote busca o texto disponível: pesquisar “house” não traduz a consulta para “casa”. Não há stemming, tradução automática ou detecção de idioma por documento.

### Normalização configurável

Trecho de configuração: importe `defineSearchConfig` de `astro-search/config` e `createSearchText` de `astro-search/astro`; `body` é o texto do documento no adaptador.

```ts
const config = defineSearchConfig({
  locale: "es-ES",
  normalization: {
    stopwords: ["el", "la", "de"], // substitui o preset; false desativa
    tokenizer: "auto", // auto | unicode | segmenter
    removeDiacritics: true,
  },
});
const searchText = createSearchText(body, config);
```

- Presets básicos de stopwords e textos de interface: português, inglês, espanhol, francês, alemão e italiano. Variantes regionais usam o catálogo do idioma (`pt-PT`, `en-GB` etc.). As listas são ajustáveis; não representam todos os usos de cada idioma.
- Outros locales válidos também funcionam: sem stopwords automáticas e com textos padrão em inglês. Defina traduções próprias em `labels`/`messages`.
- Caixa é normalizada com o locale. Por padrão, NFD remove acentos combinantes no intervalo U+0300–U+036F. `removeDiacritics: false` preserva acentos com NFC. Letras, números e marcas Unicode são aceitos; alfabetos não latinos são preservados.
- `auto` usa `Intl.Segmenter` para chinês, japonês, tailandês, lao, khmer e birmanês; nos demais idiomas usa tokens Unicode. `segmenter` solicita segmentação para qualquer idioma; `unicode` separa grupos de letras/números por pontuação/espaços.
- Sem `Intl.Segmenter`, há fallback Unicode. Segmentação pode variar entre versões de ICU do build e do navegador. Para um contrato determinístico nesses ambientes, escolha `unicode` e valide a qualidade no seu conteúdo.
- `minMatchCharLength` continua 2. Use `1` se quiser aceitar correspondências de um caractere, comuns em alguns idiomas.
- Campos originais como `title` não são reescritos. O Fuse ignora acentos por padrão, acompanhando `removeDiacritics`; `ignoreDiacritics` permite sobrescrever essa comparação. Chaves, pesos, limite e tolerância continuam configuráveis.

`getSearchTerms` e `normalizeSearchText`, em `astro-search/core`, aceitam `{ locale, stopwords, tokenizer, removeDiacritics }`. Na API JavaScript direta, `stopwords` também aceita `Set` e `createSearch` continua aceitando `normalizeQuery`. Para props Astro, prefira arrays/config serializável: funções e Sets não são preservados pelo JSON.

### Traduções próprias, pluralização e RTL

Exemplo de configuração com textos próprios; importe `defineSearchConfig` de `astro-search/config` e forneça `arabicConfig` à barra, ao grid e à normalização do endpoint correspondente.

```ts
const arabicConfig = defineSearchConfig({
  locale: "ar-EG",
  direction: "rtl",
  labels: {
    label: "بحث",
    placeholder: "عنوان، كلمة مفتاحية...",
    button: "بحث",
  },
  messages: {
    idle: "أدخل كلمة للبحث.",
    invalid: "أدخل كلمات أكثر تحديدًا.",
    loading: "جارٍ البحث...",
    empty: "لم يتم العثور على نتائج.",
    error: "تعذر البحث. حاول مرة أخرى.",
    singular: "نتيجة",
    plural: "نتائج",
    countLabels: {
      zero: "نتائج",
      one: "نتيجة",
      two: "نتيجتان",
      few: "نتائج",
      many: "نتيجة",
      other: "نتيجة",
    },
  },
});
```

Datas usam `Intl.DateTimeFormat`, contagens usam `Intl.NumberFormat` e `countLabels` usa as categorias de `Intl.PluralRules`. Para categorias sem tradução, o fallback é `singular` quando há um item ou `plural` nos demais casos. A contagem representa resultados retornados, respeitando o limite configurado.

Os componentes recebem `lang` e `dir`; `direction` aceita `auto`, `ltr` e `rtl`. O layout e o card do projeto devem ter CSS apropriado à direção desejada. `labels.button` define o nome acessível do botão; conteúdo customizado pelo slot `button` deve ser traduzido pelo projeto.

Precedência: catálogo do idioma → config `labels`/`messages` → props individuais dos componentes. Slots de estados substituem o HTML/texto padrão e precisam receber traduções do projeto. `itemLabel`/`itemsLabel` personalizam as frases de contagem; para gramática específica, prefira `messages`/`countLabels`. A prop `locale` de `ResultsGrid` sobrescreve idioma da interface, datas, números, pluralização e normalização da consulta; use `config.locale` compartilhado para alinhar com o endpoint.

`getSearchTranslations(locale)`, em `astro-search/i18n`, expõe os labels/mensagens padrão. `createTemplateRenderer({ locale, formatDate })`, em `astro-search/template`, permite reutilizar o preenchimento de HTML em outras listagens, com formatador de data próprio.

<a id="api"></a>

## 10. Referência da API

| Import                  | Conteúdo                                                    | Ambiente                 |
| ----------------------- | ----------------------------------------------------------- | ------------------------ |
| `astro-search`          | `SearchBar`, `ResultsGrid`, configuração e tipos            | Arquivos Astro           |
| `astro-search/config`   | `defineSearchConfig`, `defaultSearchConfig`, `SearchConfig` | Build, Node ou cliente   |
| `astro-search/core`     | `createSearch`, normalização, estados e tipos               | JavaScript sem Astro/DOM |
| `astro-search/i18n`     | `getSearchTranslations`, tipos de textos                    | Build, Node ou cliente   |
| `astro-search/template` | `createTemplateRenderer`, `TemplateOptions`                 | DOM do navegador         |
| `astro-search/astro`    | Endpoint, texto compacto e imagens                          | Build Astro              |

O ponto de entrada principal também exporta `getSearchTranslations` e tipos públicos como `SearchConfig`, `SearchSettings`, `SearchState`, `SearchBarProps`, `ResultsGridProps`, `SearchLabels` e `SearchMessages`. Ele importa componentes `.astro`. Em scripts Node e testes sem compilador Astro, usar os subpaths `core`, `config` ou `template`. O subpath `astro` importa `astro:assets` e deve ser usado no contexto do build do Astro.

Também existem imports diretos `astro-search/components/SearchBar.astro` e `astro-search/components/ResultsGrid.astro`.

### Configuração: defineSearchConfig

Aceita parcialmente os campos abaixo e aplica os padrões definidos pelo pacote. O merge é superficial: objetos como `normalization`, `labels` e `messages` não são mesclados recursivamente por este helper. Catálogos de mensagens são resolvidos pelos componentes.

| Campo                | Padrão                                  | Uso                                                    |
| -------------------- | --------------------------------------- | ------------------------------------------------------ |
| `locale`             | `pt-BR`                                 | Interface, normalização, datas, números e pluralização |
| `normalization`      | `{}`                                    | Stopwords, tokenização e acentos                       |
| `labels`, `messages` | Catálogo do idioma                      | Traduções próprias compartilhadas                      |
| `direction`          | `auto` nos componentes                  | Direção do texto: `ltr`, `rtl` ou `auto`               |
| `ignoreDiacritics`   | `true`, salvo `removeDiacritics: false` | Comparação dos campos originais no Fuse                |
| `pageURL`            | `/busca/`                               | Action do formulário                                   |
| `indexURL`           | `/search.json`                          | JSON a carregar/prefetch                               |
| `queryParam`         | `q`                                     | Parâmetro da consulta                                  |
| `keys`               | título 3, descrição 2, corpo 1          | Campos e pesos do Fuse                                 |
| `limit`              | `50`                                    | Máximo de resultados/cards                             |
| `threshold`          | `0.3` no núcleo                         | Tolerância de correspondência                          |
| `ignoreLocation`     | `true` no núcleo                        | Ignorar posição esperada do termo                      |
| `minMatchCharLength` | `2` no núcleo                           | Comprimento mínimo da correspondência                  |

Campos e opções são serializáveis. O nome da rota de índice e a página precisam existir no projeto: alterar a configuração não cria essas rotas. Para publicação sob `base` ou subdiretório, passar URLs consistentes com esse prefixo, inclusive nos documentos do índice.

### Opções de normalização

| Campo              | Padrão                                      | Valores                                                      |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------ |
| `stopwords`        | Preset do idioma, ou lista vazia sem preset | Array de strings ou `false`; array próprio substitui a lista |
| `tokenizer`        | `auto`                                      | `auto`, `unicode` ou `segmenter`                             |
| `removeDiacritics` | `true`                                      | Booleano; veja a relação com `ignoreDiacritics`              |

`normalization` fica dentro de `SearchConfig`. Nas funções diretas `getSearchTerms` e `normalizeSearchText`, passe essas opções no mesmo objeto que `locale`. `createSearchText(body, config)` aceita o config compartilhado; também aceita opções diretas de normalização.

### Helpers de endpoint e texto

`createSearchEndpoint({ getItems, mapItem })` retorna um handler `GET` compatível com Astro. Ambas as funções podem ser assíncronas. O mapeamento mantém a ordem original e o retorno usa `application/json; charset=utf-8`.

O projeto define seleção de publicados, campos, URLs e contrato. O helper não remove dados automaticamente; enviar apenas o necessário para buscar e renderizar.

`createSearchText(body, options?)` normaliza o texto, remove stopwords e deduplica termos. É apropriado para reduzir o corpo enviado no índice. A deduplicação remove frequência e parte da sequência do texto. A tokenização não faz parsing de Markdown: código e links podem contribuir com palavras.

O endpoint deve declarar `export const prerender = true`. Em build estático, o índice é um snapshot. Em um projeto com renderização sob demanda, `prerender = true` mantém esse endpoint como snapshot do build; o pacote não exige que todas as páginas do site sejam estáticas. Atualizar conteúdo exige novo build e publicação coerente do JSON, HTML e assets.

### Núcleo: createSearch

Este exemplo usa o índice da primeira integração, mas deixa a apresentação a cargo do consumidor. Use-o em JavaScript no navegador ou dentro de um `<script>` Astro; imports relativos de TypeScript do projeto devem passar pelo bundler.

```ts
import { createSearch } from "astro-search/core";

type Result = { url: string; title: string; searchText: string };
const search = createSearch<Result>({
  locale: "pt-BR",
  indexURL: "/search.json",
  keys: ["title", "searchText"],
});
await search.run("astro", (state) => {
  console.log(state.status, state.results);
});
search.cancel();
```

Estados: `idle`, `invalid`, `loading`, `success`, `empty`, `error`. Consultas vazias/inválidas não carregam o mecanismo. Cada controlador impede resultados antigos de publicar após consultas novas; `cancel` invalida emissões, sem abortar a transferência HTTP.

Fuse e JSON carregam em paralelo, sob demanda. O cache compartilha uma Promise/engine por URL e opções entre instâncias/navegações. Limites diferentes podem compartilhar o mesmo engine. A consulta completa é enviada ao Fuse; não há AND explícito entre todas as palavras.

O fetch usa `force-cache`. Não são configurados headers de cache na hospedagem. Uma Promise rejeitada permanece em cache até recarregar o contexto JavaScript, preservando o comportamento original; não há retry automático. A contagem mostra o retorno limitado, sem total separado ou paginação.

### Renderizador independente: createTemplateRenderer

Use o mesmo formato do índice da primeira integração em outra listagem cliente, sem criar um mecanismo de busca:

```ts
import { createTemplateRenderer } from "astro-search/template";

const template = document.querySelector<HTMLTemplateElement>("#guide-template");
const container = document.querySelector<HTMLElement>("#guide-list");
if (template && container) {
  const response = await fetch("/search.json");
  if (!response.ok) throw new Error("Não foi possível carregar os guias.");
  const items: { title: string; description: string; url: string }[] =
    await response.json();
  const renderItem = createTemplateRenderer({ locale: "pt-BR" });
  container.replaceChildren(...items.map((item) => renderItem(template, item)));
}
```

A página precisa conter o container e o template, independentemente de `ResultsGrid`:

```html
<div id="guide-list"></div>
<template id="guide-template">
  <article>
    <a data-search-href="url"><h2 data-search-text="title"></h2></a>
    <p data-search-text="description"></p>
  </article>
</template>
```

`TemplateOptions` aceita `locale?: string` e `formatDate?: (value: string) => string`. Um formatador próprio pode controlar formato e fuso horário; callbacks não são props serializáveis de `ResultsGrid`. A API retorna `(template, item) => DocumentFragment`; os dados precisam corresponder aos bindings, e o consumidor decide quando inserir o fragmento.

<a id="limites"></a>

## 11. Limites e decisões de integração

### O que a versão 0.3.0 faz e o que exige implementação própria

| Necessidade                                                   | Situação                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Blog, produtos, documentação ou dados de várias coleções      | Suportado: adapte as fontes para um array de documentos com campos coerentes                |
| Campos aninhados, pesos, tolerância e limite                  | Suportado pelas opções expostas em `SearchConfig`                                           |
| HTML ou componente Astro para o card                          | Suportado como estrutura de build com bindings documentados                                 |
| Reusar o card em uma listagem estática                        | Suportado pelo projeto, fornecendo props na renderização estática                           |
| Imagens locais otimizadas e srcset customizado                | Suportado por helper opcional de build; dimensões/layout pertencem ao projeto               |
| URLs de imagem de CDN                                         | Podem entrar diretamente no JSON; o helper atual recebe `ImageMetadata`, não uma URL remota |
| Um índice por idioma ou um índice multilíngue                 | Suportado com configuração e rotas definidas pelo projeto                                   |
| Consulta ao pressionar Enter ou enviar formulário             | Comportamento de `SearchBar`                                                                |
| Busca a cada tecla, debounce ou autocomplete                  | Não implementado pelos componentes; use `core` com controle de UI próprio                   |
| Paginação, “carregar mais” ou total antes do limite           | Não implementado; a contagem é somente dos documentos retornados                            |
| Filtros/facetas, ordenação selecionável e destaque de trechos | Não implementados pelos componentes; exigem camada própria                                  |
| Operador AND explícito entre palavras                         | Não implementado: a consulta normalizada inteira é enviada ao Fuse                          |
| Pesquisa semântica, tradução de consulta e stemming           | Não implementados                                                                           |
| Buscar documentos privados sem expô-los ao navegador          | Fora desta arquitetura: o índice é público e baixado pelo cliente                           |
| Atualizar conteúdo sem novo build                             | O snapshot estático não muda sozinho; exige nova publicação ou outra arquitetura de índice  |
| Resultado pronto sem JavaScript                               | Não implementado: o formulário navega, mas o grid depende de JavaScript                     |
| Renderizar `.astro` a cada resultado no navegador             | Não acontece: o runtime só clona e preenche HTML                                            |
| Passar todas as opções do Fuse pelo config                    | Apenas opções expostas são usadas; outras exigem adaptação do núcleo ou uso direto do Fuse  |

O núcleo permite customizar consulta e apresentação, mas não torna esses recursos ausentes automáticos. Não há um tamanho máximo de índice validado/documentado. Para índices grandes, meça bytes transferidos, tempo para criar o Fuse, memória e quantidade de cards. `limit` reduz resultados e DOM; não reduz o índice baixado.

### Cache, falhas e concorrência

O Fuse e o JSON são carregados em paralelo somente após uma consulta válida. O cache de engine usa URL do índice e opções efetivas do Fuse; instâncias com limites diferentes podem compartilhá-lo. Índices com URLs diferentes ficam separados. O cache dura enquanto o contexto JavaScript permanecer ativo.

O fetch usa `cache: "force-cache"`. Os helpers não configuram `Cache-Control` na hospedagem. Publique HTML, JSON e imagens da mesma versão e defina sua estratégia de invalidação/versionamento na infraestrutura. Recarregar o contexto recria o engine, mas não garante invalidar o cache HTTP da hospedagem/navegador.

Uma Promise de carregamento rejeitada permanece no cache de engine. Reenviar a consulta no mesmo contexto não refaz o download: não há retry automático. Um novo contexto permite tentar carregar novamente. Mensagens customizadas não devem prometer uma nova transferência ao apenas reenviar o formulário com `ClientRouter`.

Cada controlador invalida emissões de consultas antigas quando outra consulta começa. `cancel()` impede a emissão pendente de resultado; não aborta o fetch compartilhado.

### Navegação e ClientRouter

Os componentes funcionam com navegação normal. Com `ClientRouter` do Astro, seus scripts também respondem a `astro:page-load`: a barra sincroniza o input e o grid lê a nova consulta. O pacote não instala o router nem configura transições globais.

Digitar na barra não pesquisa. O formulário navega via GET; alterar a URL somente com `history.pushState()` não dispara uma nova consulta automaticamente. Integrações customizadas devem chamar seu controlador de `core` ou coordenar o ciclo de navegação.

O prefetch do índice feito pela barra é separado do prefetch de páginas do Astro. `prefetchAll: false` não é uma configuração exigida por este pacote; sua escolha pertence ao site. O navegador pode ignorar o prefetch e a consulta ainda carregará o índice normalmente.

### Conteúdo, segurança e acessibilidade

Textos dos bindings são inseridos com `textContent`, sem executar HTML contido nos dados. Isso não valida URLs: o projeto deve fornecer links e fontes de imagens adequados. Evite enviar segredos, campos internos ou documentos privados ao JSON público.

O formulário possui label e botão acessíveis; o grid usa `aria-live="polite"`, `aria-busy` e estados alternados. O projeto continua responsável por hierarquia de headings, contraste, foco, textos alternativos e componentes próprios. SEO, canonical, `noindex` e sitemap também pertencem ao layout/rotas do projeto.

<a id="diagnostico"></a>

## 12. Diagnóstico e perguntas frequentes

| Sintoma                                     | O que conferir                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Índice retorna 404                          | Existe um endpoint na URL de `indexURL`? O prefixo `base`/idioma/domínio está correto?                                            |
| Estado de erro                              | Resposta HTTP, JSON válido como array, publicação do índice e erros de rede/CORS                                                  |
| Reenviar não recupera um erro de rede       | Promise rejeitada em cache; veja a política de falhas acima                                                                       |
| Card aparece com texto vazio                | Nome exato do campo no JSON e caminho do binding; `title` e `frontmatter.title` são diferentes                                    |
| Há texto no índice, mas não é encontrado    | O campo está em `keys`? Normalização do build/consulta coincide? Termos viraram stopwords? Confira threshold e minMatchCharLength |
| A contagem parece baixa                     | É a quantidade retornada, limitada por `limit`, não um total antes do limite                                                      |
| Imagem não aparece                          | Há `image.src`? O asset foi publicado? O binding corresponde ao formato retornado?                                                |
| Variante da imagem não tem a largura pedida | Confira dimensões do asset original e opções de transformação do Astro                                                            |
| Busca mudou de idioma, mas o endpoint não   | Compartilhe o config da rota com header/grid/endpoint; locale sozinho não troca `indexURL`                                        |
| CSS do pacote aparece diferente do desejado | Use `unstyled`, classes, `gridClass` e CSS do projeto; confira regras estruturais que permanecem                                  |
| Import de `astro-search` falha em Node puro | Use os subpaths sem componentes `.astro`, conforme a referência de imports                                                        |
| Edição do pacote não aparece no dev server  | Recompile o pacote; o workspace usa sua saída `dist`                                                                              |

**Por que meu endpoint é diferente do tutorial?** O tutorial usa dados planos para permitir uma primeira integração independente. Este blog tem contrato aninhado, publicados, tags e imagens. Ambos usam a mesma API. Consulte a comparação em [Fontes de conteúdo](#fontes).

**Posso usar a barra em qualquer página?** Sim. Ela só precisa apontar para a página de resultados e o índice corretos. Se houver várias barras na mesma página, dê um `id` diferente a cada uma.

**Preciso usar o helper de endpoint?** Não. Você pode gerar um arquivo JSON por outro meio, desde que ele seja um array público no contrato esperado por `keys` e pelos bindings. Também pode usar uma fonte existente, respeitando acesso/CORS e consistência de publicação.

**Posso enviar dados de várias coleções?** Sim. Faça `getItems` agregar as fontes e `mapItem` produzir um contrato comum. O pacote não decide URLs, tipos de documento ou filtros por coleção.

**Posso mudar o tamanho das imagens sem alterar o pacote?** Sim. Compartilhe suas opções entre `Image` e `getSearchImage`; CSS controla a apresentação. Veja [Imagens](#imagens).

**Posso pesquisar português e inglês ao mesmo tempo?** Sim, com documentos de ambos em um índice e uma política de normalização comum. Isso não traduz termos entre os idiomas. Veja [i18n](#i18n).

**Posso passar qualquer objeto ou função ao config?** Os componentes serializam a configuração. Use os campos suportados, valores JSON e arrays para stopwords. Callbacks só estão disponíveis nas APIs JavaScript documentadas.

<a id="migracao"></a>

## 13. Migração

### De 0.1 para 0.2

- O pacote passou de `@astro-dev/search` para `astro-search`.
- `SearchForm` foi substituído por `SearchBar`; `SearchResults`, por `ResultsGrid`.
- Os tipos agora são `SearchBarProps` e `ResultsGridProps`.
- Os imports diretos são `astro-search/components/SearchBar.astro` e `astro-search/components/ResultsGrid.astro`.
- Remover a prop `title` e colocar o heading no projeto. `messages.title` também foi removido.
- O grid de itens agora é um elemento estático preenchido diretamente com os cards, sem um wrapper criado pelo cliente.
- O nome atual do tarball é `astro-search-0.3.0.tgz`.

### De 0.2 para 0.3

- Passe `locale` e `normalization` na configuração compartilhada e use essa configuração em `createSearchText(body, config)`.
- A prop `locale` de `ResultsGrid` agora também controla a normalização da consulta e a interface. Prefira definir o idioma no config para manter build e cliente alinhados.
- Textos padrão dos estados ficaram genéricos; `itemLabel`/`itemsLabel` personalizam a contagem. Para frases específicas de produtos/posts, use `messages` ou slots.
- A comparação do Fuse ignora acentos por padrão. Use `normalization: { removeDiacritics: false }` para preservá-los na normalização e na comparação.

<a id="desenvolvimento"></a>

## 14. Desenvolvimento e distribuição

```text
src/
  index.js + index.d.ts   exports para Astro e tipos públicos
  config.ts              defaults/configuração
  core.ts                mecanismo e cache
  normalization.ts       tokenização e stopwords por idioma
  i18n.ts                catálogos e tipos de traduções
  template.ts            preenchimento do HTML
  component-props.ts     contrato das props
  endpoint.ts            JSON e texto compacto
  astro.ts               helpers de imagens e exports de build
  components/            SearchBar.astro e ResultsGrid.astro
scripts/build.mjs        compila TS e copia componentes/entrypoint
tests/                   núcleo, templates e endpoint
dist/                    saída distribuída, gerada pelo build
```

Na raiz do workspace:

```bash
npm run build --workspace astro-search
npm test --workspace astro-search
npm run check
npm run build
```

Depois de editar o pacote com o servidor já aberto, executar novamente seu build; a distribuição local usada pelo site é `dist`. Os componentes não precisam de compilação prévia para HTML, pois o Astro consumidor processa os `.astro` distribuídos.

A pasta `dist` não é versionada neste workspace; o tarball inclui o build. A compatibilidade declarada nesta versão está restrita ao Astro 7.2+, dentro da major 7, e deve ser validada antes de ampliar essa faixa.

### Validação dos exemplos desta documentação

Os arquivos do tutorial, do card reutilizável, da receita de Content Collections e das rotas i18n foram extraídos deste README e compilados em um projeto Astro separado com o pacote instalado pelo tarball. A verificação incluiu TypeScript, JSON emitido, destinos dos links, exclusão de rascunhos, separação dos índices PT/EN e os estados das consultas descritas no tutorial.

### Validação da implementação

- Quatorze testes automatizados de normalização, configuração, domínio genérico, limite, cache, concorrência, falha de rede, templates, endpoint e componentes com slots.
- TypeScript e build estático do site que usa o workspace.
- Instalação do tarball em um projeto Astro independente, sem aliases, seguida de TypeScript e build; componentes estilizados e unstyled, label visível, botão personalizado, slots de estados e dois grids compartilhando o engine.
- Comparação de todas as imagens do índice do blog com os atributos otimizados das listagens estáticas.
- Execução dos scripts distribuídos em DOM de teste para renderização, prefetch único, navegação `astro:page-load` e reutilização do cache.
