# PRD · RepoGitHubMind, vertical académica de MVP-R1

> Alcance consensuado, cerrado el 2026-09-14. Si algo no está aquí, no está acordado.
>
> La especificación completa del producto es el [prompt maestro](prompts/00-prompt-maestro.md): principios, modelo conceptual, stack, MVP-R1 entero y R2 a R5. Este PRD recorta de MVP-R1 **lo que se construye y se demuestra en el curso**, y manda el maestro en todo lo que aquí no se diga. Lo que este documento dice que se construye lo traza [`traceability.md`](traceability.md); lo que el sistema hace de verdad lo dicen [`specs/`](specs/) y las pruebas.

## 1. Problema y contexto

Frecuentemente encontramos repositorios interesantes de GitHub navegando por WhatsApp, X, Reddit, Hacker News, blogs, videos y conversaciones con asistentes. Las URLs acaban guardadas de manera informal en chats y notas, y después resulta difícil recordar qué repositorio era, para qué servía, si ya se revisó o instaló, qué licencia tenía, si sigue activo, y qué alternativas o repositorios parecidos existen.

El coste, en hechos: un chat de WhatsApp personal del autor acumula **cientos de URLs de GitHub** sin ninguna forma de buscarlas por lo que hacen. Volver a encontrar una herramienta que se guardó hace tres meses cuesta más que buscarla de nuevo en Internet, y con frecuencia se vuelve a evaluar algo que ya se había descartado.

## 2. Usuarios

**Usuario primario:** una persona que desarrolla software o dirige equipos técnicos y colecciona repositorios de GitHub como parte de su trabajo. Escribe y lee en la misma superficie: guarda lo que encuentra y consulta lo que guardó. Trabaja desde el navegador de escritorio y desde el móvil.

**Caso de estudio de referencia:** el autor, con cientos de URLs en WhatsApp y notas, y con la necesidad recurrente de responder «¿qué herramienta tengo para X y cuál sigue viva?».

> El caso de estudio es una sola persona. Ninguna decisión de este documento debe presentarse como validada por uso real de terceros.

**No-usuarios, explícitamente:** equipos que necesitan bibliotecas compartidas, comentarios o permisos (R5); quien quiera analizar el código de un repositorio y no su metadata (R3); quien necesite repositorios privados o de GitLab y Bitbucket.

## 3. Propuesta de valor

**Una biblioteca personal y buscable de software open source: pegas la URL, el sistema la entiende por ti, y la reencuentras preguntando en tu idioma.**

### Qué decisiones cambia

1. No volver a evaluar algo que ya se descartó: el estado y las notas de cada repositorio están donde se busca.
2. Elegir la herramienta adecuada para un problema entre lo que ya se conoce: la búsqueda responde a «memoria para agentes» aunque ningún repositorio diga esas palabras.
3. No apostar por un repositorio abandonado: la última actividad y la licencia se ven en la tarjeta.

Si la única respuesta fuera «tener los enlaces ordenados», un bookmark manager bastaría, y el producto no valdría lo que cuesta.

### El intercambio que lo sostiene

Guardar cuesta pegar una URL. A cambio, el sistema obtiene la metadata, resume, clasifica y vectoriza. Si guardar exigiera rellenar un formulario, la biblioteca se quedaría vacía como el chat.

### Cómo sabríamos que funciona

- **Métrica de éxito, simple y verificable:** una persona nueva completa el flujo (crear cuenta, pegar una URL, ver metadata y resumen, cambiar el estado) en menos de tres minutos, y **encuentra ese repositorio con una consulta que no contiene ninguna palabra de su nombre ni de su descripción**.
- **Lo comprobable en la entrega final, y es un proxy:** el flujo recorrido por Playwright en CI, y una consulta semántica de la demo devolviendo el repositorio esperado en la primera posición. Construir la vertical no equivale a validar que alguien la use.

### Riesgos asumidos

| # | Riesgo | Mitigación | Señal temprana de fallo |
|---|---|---|---|
| 1 | El análisis de IA es caro y lento y bloquea guardar | La IA corre en segundo plano sobre `Repository` global, se cachea y es opcional (`AI_ANALYSIS_ENABLED`); guardar responde con la metadata antes del análisis | Guardar tarda más de 5 segundos, o el coste por repositorio supera lo previsto en `AIUsage` |
| 2 | La búsqueda semántica no encuentra lo que la persona espera | Búsqueda híbrida: léxica y semántica fusionadas con RRF; cada resultado explica por qué aparece | La consulta de la demo no devuelve el repositorio esperado entre los tres primeros |
| 3 | Datos personales de una cuenta visibles desde otra | `Repository` global y `UserRepository` privada por construcción; toda query filtra por sesión; prueba con dos cuentas por ruta | Cualquier respuesta con `personal` de otra cuenta. Es el hallazgo grave número uno del revisor |
| 4 | El rate limit de GitHub bloquea la importación | Requests autenticadas desde el servidor, cola con backoff, nunca cientos de peticiones a la vez | `429` de GitHub en los logs del worker |

## 4. Alcance (in)

**El flujo end-to-end que se demuestra, en una frase:** entro, pego la URL de un repositorio, lo veo guardado con su metadata y su resumen de IA, le cambio el estado, y lo encuentro después preguntando en lenguaje natural.

Una vertical terminada de punta a punta, no el andamiaje amplio de MVP-R1.

| # | Historia | Jira | Prioridad | Qué cubre del maestro |
|---|---|---|---|---|
| H1 | Cuentas y sesión: registro con email y contraseña, entrar, salir, sesión que sobrevive a recargar | RGM-2 | must-have | §54 Accounts, §41 |
| H2 | Guardar un repositorio público por URL con su metadata de GitHub, normalizado y sin duplicados globales | RGM-3 | must-have | §5, §10, §13, §30, §72 |
| H3 | Mi biblioteca: tarjetas compactas, estado, favorito, rating y notas privados, orden y filtros | RGM-4 | must-have | §3, §4, §12, §14, §33 |
| H4 | Análisis de IA cacheado por repositorio, con taxonomía controlada y proveedor reemplazable | RGM-5 | must-have | §15 a §21, §40, §76, §77 |
| H5 | Búsqueda híbrida en lenguaje natural con filtros, en mi biblioteca y en el corpus global | RGM-6 | must-have | §22 a §25, §70, §71 |
| S1 | Importación masiva desde texto pegado o archivo `.txt` con preview | RGM-7 | should-have | §6, §7, §42 |
| S2 | Repositorios similares de mi biblioteca y del corpus global | RGM-8 | should-have | §26, §27 |

Cinco must-have y dos should-have. Todo lo demás va en la sección 5.

## 5. Fuera de alcance

### 5.1 Lo que MVP-R1 incluye y esta vertical no

Sigue siendo objetivo del producto y está en [`roadmap.md`](roadmap.md) con su fase del §89. No entra en la entrega académica.

| Excluido | Justificación |
|---|---|
| Refresh individual y Update All con cola visible | No aporta al flujo principal; exige cola, estados y UI de progreso (§28, §74) |
| PWA instalable con shell offline, caché de repositorios y cola de acciones pendientes | Es una capa entera sobre la vertical (§8, §53); se construye cuando la vertical está demostrada |
| Explore: navegar el corpus global sin buscar | La búsqueda global de H5 ya demuestra que el corpus existe (§34) |
| Colecciones y tags personales | No cambian ninguna de las tres decisiones del §3 (§54 Personal) |
| Rol ADMIN con gestión de taxonomía y trabajos fallidos | La taxonomía entra como seed; administrarla es R1 tardío (§78) |
| Snapshots periódicos de metadata | Solo tienen sentido con refresh (§39) |
| Detección de renombrados, archivados y borrados en refresh | Idem (§73) |

### 5.2 Lo que el maestro deja fuera de MVP-R1 (§88)

Repositorios privados, GitLab y Bitbucket, clonado de repositorios, análisis AST, GraphRAG y grafo de conocimiento, LLM y embeddings locales, API directa de WhatsApp, extensión de navegador, apps nativas, Kubernetes, microservicios, Kafka, Elasticsearch, vector DB externa, SSO empresarial, colaboración en equipo.

### 5.3 Supuestos declarados, no construidos

1. **Una cuenta por persona, sin organizaciones.** Las bibliotecas son individuales.
2. **Solo repositorios públicos de GitHub**, leídos por la REST API con un token de solo lectura del servidor.
3. **Un proveedor de IA configurado a la vez.** La abstracción admite varios y un fallback; en la entrega hay uno.
4. **La taxonomía es un seed fijo.** La IA sugiere categorías y el sistema las mapea; nadie las edita desde la interfaz.
5. **Sin producción real.** La demo corre en localhost expuesto por Cloudflare Tunnel, o se entrega en video.

## 6. Requisitos funcionales

### E1 · Cuentas y acceso (H1)

- **RF-1** · Registro con email, contraseña y confirmación. El email es único ignorando mayúsculas.
- **RF-2** · Inicio y cierre de sesión. Un fallo de acceso no revela si el email existe.
- **RF-3** · La sesión sobrevive a recargar. Toda ruta privada sin sesión responde `401` sin datos.

### E2 · Guardar repositorios (H2, S1)

- **RF-4** · Una URL de GitHub en cualquier variante se normaliza a `owner/repo`; el identificador estable es el id de repositorio de GitHub.
- **RF-5** · Un repositorio existe una sola vez en la base global aunque lo guarden muchas cuentas.
- **RF-6** · Guardar obtiene metadata, README, licencia, topics, lenguajes y releases de GitHub, y responde antes de que termine el análisis de IA.
- **RF-7** · Guardar un repositorio que ya está en mi biblioteca no lo duplica y lo dice.
- **RF-8** · Las fechas `githubCreatedAt`, `githubUpdatedAt`, `githubPushedAt`, `latestReleaseAt`, `metadataRefreshedAt` y `aiAnalyzedAt` se guardan por separado; «última actividad» se basa en `pushedAt`.
- **RF-9** *(S1)* · De un texto pegado o un `.txt` se extraen las URLs de GitHub, se deduplican y se muestra un preview con nuevos, ya guardados e inválidos antes de importar.

### E3 · Mi biblioteca (H3)

- **RF-10** · Cada repositorio de mi biblioteca tiene estado (uno de nueve fijos), favorito, rating de 1 a 5 y notas, privados.
- **RF-11** · Ningún dato personal de una cuenta es visible desde otra, ni en la biblioteca, ni en el detalle, ni en la búsqueda.
- **RF-12** · La biblioteca se ordena por guardado, actualización, estrellas, nombre o rating, y se filtra por estado, favorito, lenguaje, licencia y categoría.

### E4 · Inteligencia (H4, S2)

- **RF-13** · Cada repositorio tiene, cuando la IA está disponible, resumen, propósito, casos de uso, categorías de la taxonomía controlada, tags, resumen de instalación, ventajas, limitaciones, madurez y riesgo de abandono, con la salida validada.
- **RF-14** · El análisis se hace una vez por repositorio global y se reutiliza, salvo cambio significativo, caducidad o forzado.
- **RF-15** · Si la IA falla o está deshabilitada, el repositorio sigue siendo usable y se ofrece reintentar.
- **RF-16** · Todo uso de IA se registra con proveedor, modelo, tokens, coste estimado y resultado.
- **RF-17** *(S2)* · El detalle muestra repositorios similares de mi biblioteca y del corpus global sin revelar quién los guardó.

### E5 · Búsqueda (H5)

- **RF-18** · La búsqueda combina texto completo de PostgreSQL y similitud de coseno con pgvector, fusionadas con Reciprocal Rank Fusion.
- **RF-19** · Cada resultado explica en una frase por qué aparece.
- **RF-20** · Los filtros de categoría, lenguaje, licencia, estrellas, estado y favorito se combinan y viajan en la URL.
- **RF-21** · La búsqueda global nunca incluye datos personales de ninguna cuenta.

## 7. Requisitos no funcionales

| Requisito | Cómo se comprueba |
|---|---|
| Ninguna respuesta de error revela traza, SQL ni rutas del disco ([ADR-0004](adr/0004-el-volcado-de-depuracion-va-apagado.md)) | Prueba que provoca un `500` real y mira el cuerpo entero |
| Las pruebas no escriben en la base de desarrollo ([ADR-0003](adr/0003-aislamiento-de-la-base-de-datos-en-pruebas.md)) | Por construcción, y una prueba que pregunta a la conexión viva |
| La identidad sale siempre de la sesión en el servidor | Prueba por ruta privada con dos cuentas; comprobación del verificador |
| Guardar responde en menos de 5 s con la metadata; el análisis llega después | Prueba de integración con el worker; medición manual anotada con fecha |
| Mobile first: el flujo entero funciona a 375 px de ancho | Playwright con el preset móvil sobre `flujo.e2e.ts` |
| Dark, light y system | Revisión manual con capturas en `docs/evidencia/` |
| README de GitHub saneado | Prueba unitaria con un README hostil |
| Rate limit de GitHub respetado con backoff | Prueba unitaria del cliente con `429` simulado |
| Coste de IA acotado: README truncado, tokens máximos, TTL | `AIUsage` con coste estimado por análisis |
| Se levanta desde cero con el README en una máquina limpia | Recorrido manual antes de cada entrega |

## 8. Restricciones

- **Stack** (maestro §9): Next.js App Router, React, TypeScript strict, Tailwind, shadcn/ui, PostgreSQL 16 + pgvector, Drizzle, Auth.js, Zod, Vitest, Playwright, pnpm workspaces, Docker Compose. Sin microservicios, sin Redis, sin Elasticsearch, sin vector DB externa, sin IA local.
- **Tiempo**: Entrega 1 el 2026-09-15 (documentación); Entrega 2 y final con fechas pendientes del TA (`PA-1`).
- **Coste**: desarrollo a coste cero más las APIs consumidas; producción inicial en un VPS económico (maestro §92).
- **Seguridad y privacidad**: las del §41 y §43, con lo comprobable en [`SECURITY.md`](../SECURITY.md).
- **Licencia**: Apache-2.0, copyright 2BCORE, marca separada del código ([ADR-0011](adr/0011-licencia-apache-2.md)).

## 9. Métricas de éxito

- **Primaria, no medible en este MVP:** que una persona con dos mil repositorios guardados encuentre en segundos «una herramienta para memoria compartida entre agentes que se integre con Claude Code» y sepa cuáles siguen activas y con licencia apropiada (maestro §94).
- **Proxy comprobable ahora:** el flujo de la sección 3 completado en menos de tres minutos, y la consulta semántica de la demo devolviendo el repositorio esperado en primera posición.
- **Indicadores de salud:** coste medio de IA por repositorio en `AIUsage`; porcentaje de repositorios con análisis completado; `429` de GitHub por día.
- **Anti-métricas:** número de repositorios guardados por sí solo (una biblioteca grande sin estados ni notas es el chat de WhatsApp otra vez); cobertura de líneas.

## 10. Puntos abiertos

| # | Qué | Bloquea | Quién decide |
|---|---|---|---|
| PA-1 | Fechas de la Entrega 2, la Entrega final y la prórroga | La planificación de H2 a H5 | El TA |
| PA-2 | Proveedor y modelo de IA concretos para la demo, y su coste por análisis | H4 | El autor, al arrancar H4, con una medición de coste sobre 20 repositorios |
| PA-3 | Modelo de embeddings y dimensión del vector (afecta al esquema de `repository_embeddings`) | H4, H5 | El autor, con PA-2 |
| PA-4 | Si la demo se publica por Cloudflare Tunnel o se entrega en video | Entrega final | El autor |
| PA-5 | Si S1 y S2 entran en la Entrega final o quedan en roadmap | Entrega final | El autor, según el avance de H1 a H5 |
