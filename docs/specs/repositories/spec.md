# repositories Specification

## Purpose

Convierte una URL de GitHub en un repositorio guardado con su metadata, una sola vez en la base global aunque lo guarden muchas cuentas. Es la capability que hace que guardar cueste pegar y nada más.

Historias: H2 · RGM-3 y S1 · RGM-7.

## Requirements

### Requirement: Una URL en cualquier variante

El sistema SHALL aceptar en `POST /api/v1/repositories` una URL de GitHub en cualquiera de sus variantes (`https://github.com/owner/repo`, `github.com/owner/repo`, con `/` final, con `.git`, con query o fragmento, con mayúsculas) y SHALL normalizarla a `owner/repo` en minúsculas. SHALL rechazar con `422` sobre el campo `url` cualquier URL que no sea de GitHub o que no contenga `owner/repo`.

#### Scenario: Variantes que terminan en el mismo repositorio

- **WHEN** se guarda `https://github.com/PGvector/pgvector.git?x=1` y después `github.com/pgvector/pgvector/`
- **THEN** las dos terminan en la misma `Repository` con `fullName` `pgvector/pgvector`

#### Scenario: URL que no es de GitHub

- **WHEN** se envía `https://gitlab.com/owner/repo` o `https://github.com/solo-owner`
- **THEN** la respuesta es `422` sobre `url` y no se crea nada

#### Scenario: Nunca se sigue una URL del usuario

- **WHEN** se envía una URL de GitHub
- **THEN** el sistema solo llama a `api.github.com` con el `owner/repo` extraído, y nunca hace una petición a la URL tal como llegó

### Requirement: Un repositorio existe una sola vez

El sistema SHALL identificar cada repositorio por su id de repositorio de GitHub y SHALL mantener una sola fila global por repositorio, con independencia de cuántas cuentas lo guarden.

#### Scenario: Segunda cuenta que guarda el mismo repositorio

- **WHEN** Ada ya guardó `pgvector/pgvector` y Grace lo guarda
- **THEN** no se vuelve a pedir a GitHub, no se crea otra `Repository`, y se crea solo la relación privada de Grace

#### Scenario: Ya está en mi biblioteca

- **WHEN** Ada vuelve a guardar `pgvector/pgvector`
- **THEN** la respuesta es `200` con su relación existente, la interfaz dice «Ya está en tu biblioteca», y no hay dos filas en `user_repositories`

### Requirement: Metadata de GitHub al guardar

El sistema SHALL obtener de la REST API de GitHub, con requests autenticadas desde el servidor y las cabeceras de versión recomendadas, al menos: repositorio, topics, lenguajes, licencia, README y releases, y SHALL guardar por separado `githubCreatedAt`, `githubUpdatedAt`, `githubPushedAt`, `latestReleaseAt` y `metadataRefreshedAt`. El token de GitHub NO SHALL llegar nunca al cliente.

#### Scenario: Metadata visible

- **WHEN** se guarda un repositorio público existente
- **THEN** la respuesta `201` trae nombre, descripción, estrellas, forks, licencia, lenguaje principal, topics, `githubPushedAt` y `metadataRefreshedAt`

#### Scenario: Última actividad

- **WHEN** se muestra un repositorio
- **THEN** «Última actividad» se basa en `githubPushedAt`, y las otras fechas están disponibles por separado

#### Scenario: Repositorio privado o inexistente

- **WHEN** GitHub responde `404` para `owner/repo`
- **THEN** la respuesta es `404` con la forma de error del proyecto y un mensaje humano, y no se crea nada

#### Scenario: Rate limit de GitHub

- **WHEN** GitHub responde `403` o `429` por límite de peticiones
- **THEN** la respuesta es `429` con la forma de error del proyecto, el sistema lee las cabeceras de límite y no reintenta hasta que pase la ventana

### Requirement: Guardar responde antes que la IA

El sistema SHALL responder a `POST /api/v1/repositories` con la metadata de GitHub ya presente y el análisis en estado `PENDING`, y SHALL encolar el análisis para el worker. Guardar NO SHALL esperar ni fallar por la IA.

#### Scenario: El repositorio aparece antes que su resumen

- **WHEN** se guarda un repositorio
- **THEN** la respuesta llega con `analysis.status` `PENDING`, y el resumen aparece más tarde sin volver a guardar

#### Scenario: La IA falla

- **WHEN** el análisis falla o está deshabilitado
- **THEN** el repositorio sigue guardado y usable, y `analysis.status` es `FAILED` o `DISABLED`

### Requirement: Las operaciones exigen sesión

El sistema SHALL exigir sesión para guardar y consultar repositorios, respondiendo `401` sin datos cuando falte.

#### Scenario: Guardar sin sesión

- **WHEN** se envía `POST /api/v1/repositories` sin sesión
- **THEN** la respuesta es `401` y nada cambia

### Requirement: Importación masiva desde texto o archivo (S1)

El sistema SHALL extraer de un texto pegado o de un archivo `.txt` todas las URLs `github.com/{owner}/{repo}`, SHALL deduplicarlas y normalizarlas, SHALL descartar las inválidas, y SHALL mostrar un preview con nuevos, ya guardados e inválidos **antes** de importar. La importación SHALL encolarse sin lanzar cientos de peticiones a GitHub a la vez. El archivo NO SHALL conservarse tras procesarlo, NO SHALL ejecutarse ni renderizarse como HTML, y SHALL rechazarse si no es `.txt`, supera el tamaño límite o su MIME no corresponde.

#### Scenario: Preview antes de importar

- **WHEN** se pega un export de WhatsApp con 137 URLs de GitHub, 21 ya guardadas y 8 inválidas
- **THEN** se muestra «Encontramos 137 repositorios · Nuevos: 108 · Ya guardados: 21 · Inválidos: 8» y no se importa nada hasta confirmar

#### Scenario: Confirmar

- **WHEN** se confirma el preview
- **THEN** se encolan 108 trabajos de importación, se ve el progreso, y cerrar la pantalla no los cancela

#### Scenario: Archivo que no es .txt

- **WHEN** se sube un `.html` renombrado a `.txt`, o un archivo mayor del límite
- **THEN** se rechaza con `422`, no se procesa y no se guarda
