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

## Fuera de alcance

- Similares (S2), descubrimiento externo con GitHub Search (R2), Elasticsearch, vector DB externa.

## Puntos abiertos que bloquean

`PA-3` modelo y dimensión de embeddings.

## Tickets

Se descompone al cerrar H4. Capas previstas: datos (`repository_embeddings`, `search_vector`, índices), backend/worker (`GENERATE_EMBEDDING`, texto semántico, consulta RRF, `GET /api/v1/search`), frontend (inicio con buscador, resultados con «Por qué», filtros en URL).
