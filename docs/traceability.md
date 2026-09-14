# Matriz de trazabilidad

> Qué criterio tiene prueba y cuál no. Al día a 2026-09-14, Entrega 1: **no hay código ni pruebas todavía** ([H-01](hallazgos.md)), así que las columnas de prueba y código van en blanco. En blanco es información; inventado es un defecto.
>
> La cadena que se traza es **ticket → historia → criterio de aceptación → escenario de la spec → prueba → código**. El ancla es la spec de [`specs/`](specs/): mientras esté al día, lo que cuelga de ella también. `scripts/verificar-docs.mjs` exige que la tabla tenga filas y que cada fila lleve sus seis columnas.

## Resumen

| Capability | Requisitos | Escenarios | Historias | Criterios | Pruebas | Cobertura de criterios |
|---|---:|---:|---:|---:|---:|---:|
| `auth` | 6 | 17 | 1 | 9 | 0 | 0 de 9 |
| `repositories` | 6 | 17 | 2 | 12 | 0 | 0 de 12 |
| `library` | 6 | 18 | 1 | 9 | 0 | 0 de 9 |
| `ai` | 8 | 16 | 1 | 9 | 0 | 0 de 9 |
| `search` | 6 | 15 | 2 | 12 | 0 | 0 de 12 |
| transversal | - | - | - | - | 0 | seguridad y aislamiento, ver §2 |

## Del ticket al código

El tablero es `RGM` en Jira. **Manda el repositorio**: el tablero sigue el trabajo, no lo define ([`backlog/README.md`](backlog/README.md)). Leído del tablero el 2026-09-14.

| Ticket | Historia | Criterio | Spec | Prueba | Código |
|---|---|---|---|---|---|
| `RGM-2` · `RGM-9` `RGM-10` `RGM-11` | [H1 · Cuentas y sesión](backlog/RGM-2-cuentas-y-sesion.md) | CA-1 a CA-7 · RF-1, RF-2, RF-3 | [`specs/auth`](specs/auth/spec.md): registro, un email una cuenta, inicio de sesión, la sesión sobrevive, protección, pantallas | ninguna | no construido |
| `RGM-2` | H1 | CA-8 `[PROPUESTO]` demasiados intentos · CA-9 `[PROPUESTO]` servidor caído al arrancar | `specs/auth`: «Demasiados intentos», «El servidor no está disponible al arrancar» | ninguna | no construido |
| `RGM-3` | [H2 · Guardar por URL](backlog/RGM-3-guardar-repositorio-por-url.md) | CA-1 a CA-7 · RF-4 a RF-7 | [`specs/repositories`](specs/repositories/spec.md): una URL en cualquier variante, un repositorio una sola vez, metadata, guardar responde antes que la IA, sesión | ninguna | no construido |
| `RGM-3` | H2 | CA-8 `[PROPUESTO]` fechas separadas · RF-8 | `specs/repositories`: «Última actividad» | ninguna | no construido |
| `RGM-4` | [H3 · Mi biblioteca](backlog/RGM-4-mi-biblioteca.md) | CA-1 a CA-8 · RF-10, RF-11, RF-12 | [`specs/library`](specs/library/spec.md): lo mío no lo ve nadie, nueve estados, rating y notas, lista con orden y filtros, pantalla, detalle | ninguna | no construido |
| `RGM-4` | H3 | CA-9 `[PROPUESTO]` README hostil | `specs/library`: «README hostil» | ninguna | no construido |
| `RGM-5` | [H4 · Análisis de IA](backlog/RGM-5-analisis-ia.md) | CA-1 a CA-8 · RF-13 a RF-16 | [`specs/ai`](specs/ai/spec.md): un análisis por repositorio, salida acotada, contexto económico, categorías del catálogo, proveedor reemplazable, nunca impide guardar, uso registrado, riesgo como valoración | ninguna | no construido |
| `RGM-5` | H4 | CA-9 `[PROPUESTO]` re-análisis solo si cambió | `specs/ai`: «Repositorio que cambió» | ninguna | no construido |
| `RGM-6` | [H5 · Búsqueda híbrida](backlog/RGM-6-busqueda-hibrida.md) | CA-1 a CA-8 · RF-18 a RF-21 | [`specs/search`](specs/search/spec.md): búsqueda híbrida, qué se vectoriza, ámbitos y privacidad, filtros en URL, resultado legible | ninguna | no construido |
| `RGM-6` | H5 | CA-9 `[PROPUESTO]` no revectorizar sin cambios | `specs/search`: «Texto sin cambios» | ninguna | no construido |
| `RGM-7` | [S1 · Importación masiva](backlog/RGM-7-importacion-masiva.md) | CA-1 a CA-4 · RF-9 | `specs/repositories`: «Importación masiva» | ninguna | no construido |
| `RGM-8` | [S2 · Similares](backlog/RGM-8-repositorios-similares.md) | CA-1 a CA-3 · RF-17 | `specs/search`: «Repositorios similares» | ninguna | no construido |

## 2 · Transversal: seguridad y aislamiento

No cuelgan de una historia y por eso van aparte. Las de [`SECURITY.md`](../SECURITY.md) y los no funcionales del PRD §7.

| Requisito | Dónde se comprobará | Prueba | Código |
|---|---|---|---|
| Ningún error revela traza, SQL ni rutas ([ADR-0004](adr/0004-el-volcado-de-depuracion-va-apagado.md)) | Prueba que provoca un `500` real; comprobación del verificador | ninguna | no construido |
| Las pruebas no escriben en la base de desarrollo ([ADR-0003](adr/0003-aislamiento-de-la-base-de-datos-en-pruebas.md)) | Prueba contra la conexión viva; comprobación del verificador; mutación `ADR-0003` | ninguna | no construido |
| La identidad sale de la sesión, nunca del cliente ([ADR-0008](adr/0008-repository-global-y-userrepository-privada.md)) | Prueba con dos cuentas por ruta privada; comprobación del verificador; mutación `flujo-principal` | ninguna | no construido |
| Validar antes de resolver ([ADR-0005](adr/0005-validar-antes-de-resolver.md)) | Prueba `422` antes que `404`; comprobación del verificador | ninguna | no construido |
| Contrato al día ([ADR-0001](adr/0001-el-contrato-se-genera-se-versiona-y-se-vigila-la-deriva.md)) | `pnpm openapi:check` en CI; mutaciones `rutas-documentadas` y `ruta-protegida-publica` | **en CI desde la Entrega 1** (las dos mutaciones) | `docs/api/openapi.json` |
| Mobile first a 375 px | Playwright con preset móvil sobre `flujo.e2e.ts` | ninguna | no construido |
| Rate limit de GitHub con backoff | Prueba unitaria del cliente con `429` simulado | ninguna | no construido |
| Sin SSRF: solo `api.github.com` y el proveedor configurado | Prueba unitaria del normalizador | ninguna | no construido |

## 3 · Lo que sigue sin prueba, y por qué

Todo. Es un hueco declarado, no una omisión: la Entrega 1 es documentación. Lo que sí está en CI desde hoy son las comprobaciones del harness sobre la propia documentación y el contrato (§2, fila «Contrato al día»), y las cuatro mutaciones que las demuestran.

| Requisito | Por qué no la tiene | Cuándo la tendrá |
|---|---|---|
| Todos los criterios de H1 a H5 | No hay código | Con cada historia, en el mismo PR, según [`estrategia-de-pruebas.md`](estrategia-de-pruebas.md) |
| Requisitos de pantalla (`La interfaz SHALL`) | Cuestan segundos por caso | Solo el flujo principal y lo que ninguna otra capa vea; el resto se declara aquí |
| S1 y S2 | Dependen de `PA-5` | Si entran en la Entrega final |

## 4 · Criterios marcados `[PROPUESTO]`

Seis, uno por historia salvo S1 y S2, más CA-8 de H1. No derivan del PRD: cubren huecos detectados al redactar las historias. **Una prueba escrita contra un criterio propuesto fija como contrato algo que nadie ha aprobado**: primero se validan contra la spec y el maestro, después se prueban.

| Historia | Propuestos | Estado |
|---|---:|---|
| H1 | CA-8, CA-9 | Pendientes de validar al arrancar RGM-2 |
| H2 | CA-8 | Pendiente |
| H3 | CA-9 | Pendiente |
| H4 | CA-9 | Pendiente |
| H5 | CA-9 | Pendiente |

## 5 · Qué hacer con esto

Por orden de lo que más protege:

1. La frontera privado/público (H3 CA-5 y CA-6, transversal «identidad de la sesión»): es el primer grave de `REVIEW.md` para este producto, y se prueba con dos cuentas desde RGM-10.
2. El aislamiento de la base de pruebas: se paga una vez en RGM-9 y sin él no se cierra ningún ticket.
3. El flujo principal entero por Playwright, desde RGM-11, creciendo con cada historia y en el catálogo de mutaciones.
4. Validar los seis criterios `[PROPUESTO]` antes de escribir pruebas contra ellos.

Lo que **no** se propone: perseguir un porcentaje de cobertura. La métrica de esta matriz es qué escenario de la spec está cubierto, no qué línea se ejecuta.
