# ADR-0001 · El contrato se genera desde Zod, se versiona, y lo que se vigila es la deriva

## Estado

Aceptada · 2026-09-14

## Contexto

Un contrato OpenAPI puede escribirse a mano o generarse desde el código, y las dos aproximaciones resuelven cosas distintas. Escrito a mano puede afirmar lo que el código debería hacer, y se desactualiza por olvido. Generado no se queda atrás, y documenta fielmente lo que el código hace, incluido lo que hace mal.

Este producto usa Next.js con Route Handlers y Server Actions, que no generan OpenAPI por sí solos. Pero toda entrada y toda salida se valida con Zod (prompt maestro §52), y de un esquema Zod se puede derivar un contrato con `@asteasolutions/zod-to-openapi`. Las Server Actions no son HTTP público y no van al contrato.

Y una tercera cosa que ninguna de las dos aproximaciones da sola: **generar no basta y contrastar a mano tampoco**. Lo que convierte cualquiera de las dos en garantía es que exista una comprobación determinista que se haya visto fallar.

## Decisión

**El contrato se genera desde los esquemas Zod de los Route Handlers, se versiona como fichero en `docs/api/openapi.json`, y lo que corre en CI es la comprobación de que los dos coinciden.**

1. `pnpm openapi:generate` construye el documento desde los esquemas registrados y escribe `docs/api/openapi.json`. Es manual, a propósito.
2. `pnpm openapi:check` compara el fichero contra el documento generado y **sale con código distinto de cero** si difieren, nombrando las rutas JSON. **No arregla nada.**
3. `scripts/verificar-docs.mjs` contrasta lo que un generador no puede afirmar: que toda ruta protegida lleve esquema de seguridad, que no haya parámetros repetidos, que la tabla de `CLAUDE.md` coincida.

Hasta la Entrega 2 no hay código y el fichero versionado es el contrato objetivo escrito a mano ([H-01](../hallazgos.md)). La primera historia que implemente una ruta lo regenera, y desde ese momento no se edita a mano.

El fichero versionado existe porque la URL solo existe mientras el servidor corre: sin fichero no hay nada que revisar en un cambio propuesto ni que comparar entre dos versiones. El job no regenera ni commitea porque **informa, no arregla**: si lo hiciera, desaparecería la única señal de que alguien cambió la API sin mirar el contrato.

## Alternativas consideradas

**Dejar el contrato solo a mano.** Trabajo recurrente y sin garantía de coincidir con lo que el código valida.

**Generar en CI y commitear desde el job.** Quita el humano del bucle y con él la señal, y hace que la rama del PR cambie sola.

**No tener contrato porque las Server Actions no lo necesitan.** Los Route Handlers son HTTP público, la sección 4 del readme de LIDR lo exige, y el revisor adversarial contrasta contra él.

## Consecuencias

Al tocar Route Handlers, esquemas Zod o serializadores hay que acordarse de `pnpm openapi:generate`, y el job lo recuerda con un rojo si no. Los esquemas Zod pasan a ser la única definición de entrada y salida: se comparten con el frontend desde `packages/shared`.

## Cómo se comprobó

Sin código todavía, lo que ya muerde son las dos comprobaciones del verificador sobre el contrato, en el catálogo de mutaciones desde el primer push: `rutas-documentadas` (quitar una ruta de la tabla de `CLAUDE.md`) y `ruta-protegida-publica` (declarar `security: []` en `/api/v1/search`). La comparación generado contra versionado se verá fallar en la Entrega 2 renombrando un endpoint, y su entrada `ADR-0001` del catálogo se descomenta ese día.
