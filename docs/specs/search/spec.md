# search Specification

## Purpose

Reencuentra lo guardado preguntando en el idioma de la persona, aunque las palabras no coincidan, y con filtros que acotan por lo que importa: categoría, lenguaje, licencia, estrellas, estado. Es la capability que da sentido a haber guardado.

Historias: H5 · RGM-6 y S2 · RGM-8.

## Requirements

### Requirement: Búsqueda híbrida

El sistema SHALL responder a `GET /api/v1/search?q=...` combinando búsqueda de texto completo de PostgreSQL y similitud de coseno con pgvector sobre el embedding del repositorio, fusionadas con Reciprocal Rank Fusion, y SHALL devolver cada resultado con una explicación corta de por qué aparece. NO SHALL usar Elasticsearch, OpenSearch ni una base de vectores externa.

#### Scenario: Palabras que no aparecen

- **WHEN** una biblioteca contiene `pgvector/pgvector` y se busca «vectores en postgres»
- **THEN** aparece entre los tres primeros aunque «vectores» no esté en su nombre ni en su descripción

#### Scenario: Consulta en lenguaje natural

- **WHEN** se busca «herramienta para memoria de agentes»
- **THEN** los repositorios en `artificial-intelligence/agents/agent-memory` aparecen antes que otros, cada uno con su «Por qué»

#### Scenario: Sin embedding todavía

- **WHEN** un repositorio recién guardado no tiene embedding
- **THEN** sigue apareciendo por coincidencia léxica

#### Scenario: Consulta vacía

- **WHEN** se envía `q` con menos de 2 caracteres
- **THEN** la respuesta es `422` sobre `q`

### Requirement: Qué se vectoriza

El sistema SHALL construir una sola representación semántica por repositorio con nombre, descripción, resumen, propósito, casos de uso, categorías, tags y topics, y SHALL revectorizar solo cuando ese texto cambie.

#### Scenario: Texto sin cambios

- **WHEN** se vuelve a guardar un repositorio cuyo texto semántico no cambió
- **THEN** no se pide un embedding nuevo ni se registra coste

### Requirement: Ámbitos y privacidad

El sistema SHALL admitir `scope=library`, que busca en mi biblioteca (repositorio más mis datos personales), y `scope=global`, que busca en el corpus de repositorios conocidos. En `global` NO SHALL incluirse nunca notas, estados, ratings ni tags personales de ninguna cuenta, ni quién guardó cada repositorio.

#### Scenario: Buscar en mi biblioteca

- **WHEN** se busca con `scope=library`
- **THEN** los resultados traen `personal` con mis datos, y ninguno de otra cuenta

#### Scenario: Buscar en el corpus global

- **WHEN** se busca con `scope=global`
- **THEN** los resultados traen el repositorio y `personal` solo si está en mi biblioteca; nunca aparece ningún dato personal ajeno ni ningún indicio de quién lo guardó

#### Scenario: Una nota ajena no se busca

- **WHEN** Ada escribió «probar para el proyecto Zeta» en una nota y Grace busca «Zeta» en global
- **THEN** ese repositorio no aparece por esa nota

### Requirement: Filtros combinables en la URL

El sistema SHALL combinar los filtros de categoría, lenguaje, licencia, estrellas mínimas, estado y favorito con la consulta, y la interfaz SHALL llevarlos en la URL para que una búsqueda se pueda compartir y el botón «atrás» la deshaga. La licencia SHALL admitir varias a la vez, y cualquiera de ellas vale. Un filtro fuera del dominio, un parámetro repetido, o `status` o `favorite` con `scope=global`, donde no filtrarían nada, SHALL rechazarse con `422`.

#### Scenario: Combinación

- **WHEN** se busca «memoria de agentes» con licencia MIT o Apache-2.0 y más de 1000 estrellas
- **THEN** solo llegan resultados que cumplen las tres cosas

#### Scenario: Compartir

- **WHEN** se copia la URL de una búsqueda con filtros y se abre en otra sesión
- **THEN** se ve la misma búsqueda con los mismos filtros

### Requirement: Resultado legible

La interfaz SHALL mostrar cada resultado con nombre, categoría, estrellas, licencia, actividad y el «Por qué» en una línea, y el buscador SHALL ser protagonista de la pantalla de inicio con el placeholder «¿Qué tipo de herramienta necesitas?».

#### Scenario: Lista de resultados

- **WHEN** se busca «memoria para agentes»
- **THEN** cada resultado se lee como «Mem0 · Agent Memory · ⭐ … · Apache-2.0 · Activo · Por qué: memoria de largo plazo para agentes…»

### Requirement: Repositorios similares (S2)

El sistema SHALL calcular para un repositorio los similares de mi biblioteca y los del corpus global por similitud de embedding, categorías compartidas y topics compartidos, y NO SHALL revelar la identidad de quién guardó cada uno.

#### Scenario: Similares en el detalle

- **WHEN** se abre el detalle de un repositorio con embedding
- **THEN** se ven dos listas, «En tu biblioteca» y «Conocidos por RepoGitHubMind», con «+ Guardar» en los segundos

#### Scenario: Sin identidad

- **WHEN** se mira un similar del corpus global
- **THEN** no aparece ningún usuario, ni cuántos lo guardaron, ni ningún dato personal
