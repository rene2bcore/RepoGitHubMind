# Estrategia de pruebas

> Qué capa cubre qué, cuándo merece una prueba su coste, y qué **no** se mide. Una página. El número de pruebas no está aquí a propósito: lo da `CLAUDE.md` y lo contrasta CI.
>
> Escrita el 2026-09-14 antes de la primera prueba y contrastada con H1 el mismo día: las capas de abajo existen en el código. Qué escenario cubre cada prueba, en [`traceability.md`](traceability.md). Herramientas: las del prompt maestro §51, Vitest y Playwright, con las pruebas que ahí se piden como prioritarias: normalización de URL, parser de importación, autorización, deduplicación, búsqueda, validación de la salida de IA.

## Las capas, y qué decide cada una

| Capa                          | Runner               | Dónde                                          | Qué fija                                                                                                                                                                                                                                                                                    | Qué no ve                                                                   |
| ----------------------------- | -------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Unitaria**                  | Vitest               | `packages/*/tests/`, `apps/*/src/**/*.test.ts` | Reglas puras: normalizar URL, extraer URLs de un texto, texto semántico y su hash, caché del análisis, heurística de abandono, mapeo de taxonomía, validación Zod de la salida de IA, cliente de la API del frontend. Sin base ni red, en milisegundos, y el fallo dice qué regla se rompió | Que la regla llegue por el cable                                            |
| **Integración**               | Vitest               | `apps/web/tests/`, `apps/worker/tests/`        | Los Route Handlers contra la base de pruebas en Docker: cada escenario de la spec que se observa en una respuesta HTTP, la forma de los errores, el aislamiento de la base, **la frontera privado/público con dos cuentas**, los trabajos del worker con GitHub y la IA simulados           | La pantalla                                                                 |
| **Navegador**                 | Playwright           | `apps/web/e2e/`                                | El flujo principal entero desde la pantalla de registro (`flujo.e2e.ts`), a escritorio y a 375 px, y lo que solo se ve en pantalla y ninguna otra capa veía. Sin reintentos                                                                                                                 | Cuesta segundos por caso; por eso son pocas                                 |
| **Contrato**                  | `pnpm openapi:check` | CI                                             | Que `docs/api/openapi.json` sea lo que los esquemas Zod generan                                                                                                                                                                                                                             | Que el contrato sea correcto: eso lo revisa una persona, y el revisor de CI |
| **Documentación**             | `verificar-docs.mjs` | CI                                             | Que lo que los documentos afirman del código sea cierto                                                                                                                                                                                                                                     | Si un documento sigue siendo útil                                           |
| **Las comprobaciones mismas** | `mutaciones.mjs`     | CI                                             | Que cada comprobación se ponga en rojo con el defecto que dice cubrir                                                                                                                                                                                                                       | Defectos que nunca existieron                                               |

## Dónde va una prueba nueva

1. **Una regla de dominio** (una normalización, un cálculo, una condición): unitaria en el paquete donde vive, y **además** el escenario por la API si la spec lo describe como respuesta. La unitaria dice qué se rompió; la de integración, que sigue saliendo por el cable.
2. **Un escenario de la spec que se observa en una respuesta HTTP**: integración, un caso por escenario, citando el requisito en la cabecera del fichero. Toda ruta privada se prueba además **con dos cuentas**.
3. **Un escenario que solo se observa en pantalla**: Playwright, solo si nada más lo ve. Preparar el estado por la API, comprobar en pantalla.
4. **Un bug**: primero la prueba que lo reproduce en rojo, en la capa más baja que lo vea; luego el arreglo. CI rechaza el `fix:` sin prueba (R-08).
5. **Una comprobación nueva** (verificador, CI, hook): su entrada en el catálogo de mutaciones, vista morder por su motivo.

## GitHub y la IA en las pruebas

Ninguna prueba llama a `api.github.com` ni a un proveedor de IA. `GitHubProvider` y `AIProvider` son interfaces, y las pruebas usan implementaciones falsas con respuestas grabadas: un repositorio real, un `404`, un `429` con cabeceras de límite, una salida de IA válida y una que se pasa de largo. Las grabaciones viven en `tests/fixtures/` y **no cuentan como prueba** para R-08.

## Lo que no se mide, y por qué

- **Porcentaje de cobertura de líneas.** La métrica es qué escenario de la spec tiene prueba, no qué línea se ejecuta.
- **Rendimiento.** Sin usuarios reales no hay número que defender. Lo que sí se mide una vez a mano y se anota con fecha: el tiempo de guardar un repositorio, que el PRD acota a 5 segundos.
- **Requisitos de pantalla, la mayoría.** Declarados sin prueba en `traceability.md`. Se cubren cuando algo se rompe una vez, no antes.
- **Calidad del resumen de IA.** No hay verdad contra la que medirla; se mide que valide, que esté acotado y que cueste lo previsto.

## Reglas que no se negocian

- La suite **nunca** escribe en la base de desarrollo: el runner fuerza `NODE_ENV=test` y el cliente de `packages/db` elige `DATABASE_URL_TEST` ([ADR-0003](adr/0003-aislamiento-de-la-base-de-datos-en-pruebas.md)).
- La suite de integración y Playwright no corren a la vez: comparten base de pruebas a propósito para que el choque sea ruidoso.
- El número de pruebas vive en `CLAUDE.md` y en ningún otro sitio; `scripts/recuento-pruebas.mjs` lo contrasta con lo que ejecuta Vitest.
- Sin reintentos en Playwright: una prueba que solo pasa a la segunda es flaky, y un reintento la esconde.
- Ninguna prueba depende de una clave real de GitHub ni de IA: CI no las tiene.
