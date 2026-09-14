# RGM-6 · H5 · Búsqueda híbrida en lenguaje natural con filtros

**Identificador:** `RGM-6` · [en Jira](https://ai4devs.atlassian.net/browse/RGM-6)
**Épica:** RGM-1
**Traza:** RF-18 a RF-21 del [PRD](../prd.md) · Prompt maestro §22 a §25, §32, §70, §71
**Prioridad:** must-have · **Entrega:** final · **Spec:** [`specs/search`](../specs/search/spec.md)

## Historia

> Como persona con cientos de repositorios guardados, quiero preguntar en lenguaje natural y filtrar por categoría, lenguaje, licencia, estrellas y estado, para encontrar lo que guardé aunque no recuerde sus palabras exactas.

## Criterios de aceptación

### Camino feliz

**CA-1 · Palabras que no aparecen**
DADO `pgvector/pgvector` en mi biblioteca
CUANDO busco «vectores en postgres»
ENTONCES aparece entre los tres primeros aunque esas palabras no estén en su nombre ni descripción.

**CA-2 · Cada resultado dice por qué**
DADO una búsqueda
CUANDO veo los resultados
ENTONCES cada uno trae nombre, categoría, estrellas, licencia, actividad y un «Por qué» de una línea.

**CA-3 · Filtros combinados en la URL**
DADO una consulta
CUANDO añado licencia MIT o Apache-2.0 y más de 1000 estrellas
ENTONCES solo llegan resultados que cumplen todo, y la URL se puede compartir.

**CA-4 · El buscador es protagonista**
DADO la pantalla de inicio
CUANDO entro
ENTONCES el buscador con «¿Qué tipo de herramienta necesitas?» es lo primero que veo.

### Lo que no debe ocurrir

**CA-5 · Global no filtra datos personales**
DADO `scope=global`
CUANDO busco
ENTONCES ningún resultado trae notas, estados, ratings ni tags de otra cuenta, ni quién lo guardó.

**CA-6 · Una nota ajena no se busca**
DADO una nota de otra cuenta con la palabra «Zeta»
CUANDO busco «Zeta» en global
ENTONCES ese repositorio no aparece por esa nota.

### Errores y límites

**CA-7 · Sin embedding todavía**
DADO un repositorio recién guardado sin vector
CUANDO busco
ENTONCES sigue apareciendo por coincidencia léxica.

**CA-8 · Consulta vacía**
DADO `q` de un carácter
CUANDO busco
ENTONCES recibo `422` sobre `q`.

**CA-9 · No se revectoriza sin cambios** · **[PROPUESTO]**
DADO un repositorio cuyo texto semántico no cambió
CUANDO se vuelve a procesar
ENTONCES no se pide un embedding nuevo ni se registra coste.

_Motivo: el maestro §22 dice qué se vectoriza, no cuándo; se fija con un hash del texto, que es computable y barato._

_Validado el 2026-09-14 contra `specs/search` («Texto sin cambios», que ya lo exigía) y el encargo de H5: se compara el hash del texto y también el modelo._

## Fuera de alcance

- Similares (S2), descubrimiento externo con GitHub Search (R2), Elasticsearch, vector DB externa.

## Puntos abiertos que bloquean

Ninguno. `PA-3` cerrado el 2026-09-14: `openai/text-embedding-3-small`, 1536 dimensiones, por OpenRouter.

## Tickets

Construida el 2026-09-14 en `feat/RGM-6-busqueda-hibrida`, en un solo PR y un commit por capa.

**Datos.** Migraciones `0003` (personalizada: extensión `vector`), `0004` (generada: `repository_embeddings` con `vector(1536)`, `repositories.search_vector` con índice GIN) y `0005` (personalizada: rellena `search_vector` de lo existente y encola los embeddings de los análisis completados). Sin HNSW: con cientos de repositorios basta el escaneo (§69).

**IA y búsqueda.** `EmbeddingProvider` en `packages/ai` (OpenRouter y falso, en el registro); `packages/search` con el texto semántico y su hash, el documento léxico con configuración `simple`, las listas léxica y vectorial con los mismos filtros, RRF con k = 60 y el «Por qué». Umbral de similitud medido con una llamada real.

**Worker.** `GENERATE_EMBEDDING` idempotente por hash y modelo, encolado en la transacción que completa el análisis, con `ai_usage` EMBEDDING.

**Backend y frontend.** `GET /api/v1/search` con `library` y `global`, filtros combinados y modo léxico sin embedding de la consulta; guardar escribe `search_vector`; un parámetro repetido es 422. Pantalla `/search` con el buscador primero, ámbito y filtros en la URL, resultados en una línea con «Por qué», y «+ Guardar» en lo que no está en mi biblioteca.

**Definition of Done**

- [x] CA-1, CA-2, CA-3, CA-5, CA-6, CA-7 y CA-8 con prueba de integración contra la base de pruebas y el worker real con los proveedores falsos; CA-2 y CA-3 también en el navegador
- [x] CA-9 validado contra la spec y probado en la unidad y en el worker, sin fila nueva en `ai_usage`
- [ ] CA-4 en la pantalla de inicio: el buscador es lo primero de `/search`, pero al entrar se llega a la biblioteca, como exige `specs/auth`; punto abierto en `traceability.md` §3
- [ ] «Consulta en lenguaje natural» (los de `agent-memory` antes que otros) sin prueba: el proveedor falso no sabe de sinónimos y ninguna prueba usa la clave real
- [x] Ninguna prueba llama a la red; una sola llamada manual con la clave real, contada en el PR y en `ai-architecture.md`
- [x] Mutaciones `busqueda-global-privada` y `busqueda-biblioteca-privada` en el catálogo, vistas morder en la prueba de dos cuentas
- [x] `pnpm openapi:check` en verde con la ruta nueva; tabla de `CLAUDE.md` al día
- [x] `docs/capabilities/search/README.md`; filas en `docs/traceability.md`; `data-model.md` y `ai-architecture.md` al día
- [x] Sin dependencias nuevas del registro de npm: `vector` de `drizzle-orm`, `fetch` nativo y `node:crypto`
- [x] E2E con el worker real y `AI_FAKE=1`: buscar desde la pantalla, filtro en la URL y detalle, a escritorio y en móvil
