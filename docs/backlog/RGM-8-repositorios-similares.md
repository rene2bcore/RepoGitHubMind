# RGM-8 · S2 · Repositorios similares en mi biblioteca y en el corpus global

**Identificador:** `RGM-8` · [en Jira](https://ai4devs.atlassian.net/browse/RGM-8)
**Épica:** RGM-1
**Traza:** RF-17 del [PRD](../prd.md) · Prompt maestro §26, §27, §34
**Prioridad:** should-have · **Entrega:** final si cabe (`PA-5`) · **Spec:** [`specs/search`](../specs/search/spec.md), requisito «Repositorios similares»

## Historia

> Como persona que abre un repositorio, quiero ver los parecidos que ya tengo y los que otros usuarios han guardado, para descubrir alternativas sin buscar fuera.

## Criterios de aceptación

**CA-1 · Dos listas en el detalle**
DADO un repositorio con embedding
CUANDO abro su detalle
ENTONCES veo «En tu biblioteca» y «Conocidos por RepoGitHubMind», calculados por similitud de embedding, categorías y topics compartidos.

**CA-2 · Guardar desde similares**
DADO un similar del corpus global
CUANDO pulso «+ Guardar»
ENTONCES entra en mi biblioteca sin volver a pedir a GitHub.

**CA-3 · Sin identidad**
DADO un similar del corpus global
CUANDO lo veo
ENTONCES no aparece quién lo guardó, cuántas personas, ni ningún dato personal.

## Fuera de alcance

- Recomendaciones externas con GitHub Search (R2), grafo de conocimiento (R4).

## Tickets

Se descompone si entra en la Entrega final. Depende de H4 y H5.
