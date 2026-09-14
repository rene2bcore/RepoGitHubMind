# Backlog · vertical académica de MVP-R1

> **Origen:** [PRD](../prd.md) y [prompt maestro](../prompts/00-prompt-maestro.md). Los **criterios de aceptación viven en las historias**, una por fichero en esta carpeta. Este archivo solo recoge lo que cruza historias: la matriz de impacto, el orden y los bloqueos.

## Dónde vive cada cosa

|                                                   | Dónde                                            | ¿En el repositorio? |
| ------------------------------------------------- | ------------------------------------------------ | ------------------- |
| PRD y alcance                                     | `docs/prd.md`                                    | Sí                  |
| Historias con criterios                           | `docs/backlog/RGM-*.md`                          | Sí                  |
| Tickets con su Definition of Done                 | dentro de la historia descompuesta (hoy solo H1) | Sí                  |
| Épica, historias, subtareas y estados del tablero | Jira, proyecto `RGM` en `ai4devs.atlassian.net`  | No: es seguimiento  |

El artefacto que dirige la implementación es el de este repositorio: los criterios de aceptación. El tablero es **seguimiento del trabajo**, no la fuente de verdad. Si los dos se contradicen, **manda el repositorio** y se corrige el tablero.

## Las historias

Épica **RGM-1** · Guardar y reencontrar repositorios de GitHub.

| Historia                                                                                               | Jira  | Qué resuelve                                                     | Prioridad   | Tickets                                              |
| ------------------------------------------------------------------------------------------------------ | ----- | ---------------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| [**H1** · Cuentas y sesión](RGM-2-cuentas-y-sesion.md)                                                 | RGM-2 | Que la biblioteca sea mía y nadie más la vea                     | must-have   | **3** · RGM-9 datos, RGM-10 backend, RGM-11 frontend |
| [**H2** · Guardar un repositorio por URL con metadata de GitHub](RGM-3-guardar-repositorio-por-url.md) | RGM-3 | Guardar cuesta pegar, y el repositorio existe una vez para todos | must-have   | -                                                    |
| [**H3** · Mi biblioteca: estado, favorito, rating y notas](RGM-4-mi-biblioteca.md)                     | RGM-4 | Saber qué revisé, qué uso y qué descarté                         | must-have   | -                                                    |
| [**H4** · Análisis de IA cacheado con proveedor reemplazable](RGM-5-analisis-ia.md)                    | RGM-5 | Entender para qué sirve sin abrir el README                      | must-have   | -                                                    |
| [**H5** · Búsqueda híbrida en lenguaje natural](RGM-6-busqueda-hibrida.md)                             | RGM-6 | Encontrar lo guardado aunque no recuerde las palabras            | must-have   | -                                                    |
| [**S1** · Importación masiva desde texto o `.txt`](RGM-7-importacion-masiva.md)                        | RGM-7 | Importar cientos de URLs de golpe                                | should-have | -                                                    |
| [**S2** · Repositorios similares](RGM-8-repositorios-similares.md)                                     | RGM-8 | Descubrir alternativas sin buscar fuera                          | should-have | -                                                    |

**Las tres principales** para la sección 5 del readme de LIDR: H2, H3 y H5. Son las que sostienen el flujo que se demuestra; H1 es el andamiaje y H4 es lo que da valor a H5.

### Qué es una historia y qué no

Una historia entrega valor desplegable por sí sola. «Validar la URL» no es una historia: es un criterio de H2. «La pantalla de detalle» tampoco: es superficie de H3. Se reconocen porque inflan el recuento y reparten los criterios de una historia entre varios ficheros.

### Qué es un ticket

Una unidad de trabajo que una persona termina en una sesión, con media jornada como techo. **Hereda** los criterios de su historia; su Definition of Done es una checklist de _cómo entregamos_, no criterios nuevos ni estimación en horas. Nombra la capa que toca; **no diseña**: tipo de columna, índices, rutas y códigos se deciden al implementar. Se descompone solo la historia próxima: un ticket escrito con cinco historias de antelación caduca antes de abrirse.

## Matriz impacto / complejidad

**Impacto** = cuánto sirve a la promesa central: _pegas la URL, el sistema la entiende por ti, y la reencuentras preguntando en tu idioma_. **Complejidad** = esfuerzo relativo de construcción, no riesgo.

| Historia                  | Impacto | Complejidad        | Notas                                                                            |
| ------------------------- | ------- | ------------------ | -------------------------------------------------------------------------------- |
| **H1** Cuentas y sesión   | Medio   | Media              | Sin ella nada es privado; impacto propio bajo, habilitadora de todo              |
| **H2** Guardar por URL    | Alto    | Alta               | Arranca el dominio entero: normalización, GitHub, dedupe global, cola            |
| **H3** Mi biblioteca      | Alto    | Media              | Donde se cobra el intercambio: guardar cuesta pegar, y la biblioteca es mía      |
| **H4** Análisis de IA     | Alto    | Alta               | Lo que convierte una lista de URLs en una biblioteca; proveedor, caché, coste    |
| **H5** Búsqueda híbrida   | Alto    | Alta               | La promesa central; depende de H4 para lo semántico                              |
| **S1** Importación masiva | Medio   | Media              | Sirve al caso fundacional (WhatsApp), pero no cambia ninguna decisión del PRD §3 |
| **S2** Similares          | Medio   | Baja sobre H4 y H5 | Casi gratis una vez hay embeddings                                               |

**Lectura por cuadrantes**

- **Alto impacto / complejidad media:** H3. Lo más rentable del backlog una vez existe H2.
- **Alto impacto / complejidad alta:** H2, H4, H5. El núcleo del trabajo, en ese orden.
- **Impacto medio:** H1 (obligatoria, primero), S1 y S2 (si caben, `PA-5`).

## Orden de backlog priorizado

Respeta a la vez prioridad de producto, dependencias y las fases del prompt maestro §89. **La dependencia manda sobre el impacto**: H1 va primera aunque su impacto sea medio, porque es el sustrato.

| #   | Historia                  | Entrega       | Motivo                                                                            |
| --- | ------------------------- | ------------- | --------------------------------------------------------------------------------- |
| 1   | **H1** Cuentas y sesión   | 2             | Phase 1 del maestro. Sin sesión no hay biblioteca privada                         |
| 2   | **H2** Guardar por URL    | 2             | Phases 2 y 3. Prerrequisito del resto                                             |
| 3   | **H3** Mi biblioteca      | 2             | Phase 4. Cierra el flujo mínimo demostrable: entrar, guardar, ver, cambiar estado |
| 4   | **H4** Análisis de IA     | final         | Phases 5 y 6. Da el resumen y las categorías                                      |
| 5   | **H5** Búsqueda híbrida   | final         | Phase 7. Cierra la promesa central                                                |
| 6   | **S2** Similares          | final si cabe | Phase 8. Barata sobre H4 y H5                                                     |
| 7   | **S1** Importación masiva | final si cabe | Phase 9. Exige cola visible y validación de uploads                               |

## Bloqueos transversales

Condicionan cuándo se puede cerrar el trabajo, y ninguno se resuelve dentro de la historia que lo sufre.

| Bloqueo                                                                                                    | Efecto                                                                                                         |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **PA-2** proveedor y modelo de IA, y su coste medido                                                       | Bloquea cerrar H4: sin coste medido no se decide el TTL ni el truncado                                         |
| **PA-3** modelo y dimensión de embeddings                                                                  | Bloquea la migración de `repository_embeddings`, y por tanto H5                                                |
| **PA-1** fechas de las entregas                                                                            | Bloquea decidir `PA-5` (si S1 y S2 entran)                                                                     |
| **Base de pruebas**                                                                                        | No impide escribir código; impide **cerrar** cualquier ticket cuyo DoD pida pruebas. Se paga una vez, en RGM-9 |
| **Cola de trabajos** (`pg-boss` o tabla propia, [ADR-0010](../adr/0010-cola-de-trabajos-en-postgresql.md)) | Se decide en H2 y la heredan H4, S1                                                                            |
