# ADR-0008 · `Repository` global y `UserRepository` privada

## Estado

Aceptada · 2026-09-14

## Contexto

Un repositorio público de GitHub es un hecho del mundo: `pgvector/pgvector` es el mismo para todos. Lo que cada persona piensa de él, si lo revisó, cómo lo puntúa y qué anotó, es suyo. Modelar las dos cosas juntas, una fila por usuario con toda la metadata, duplica los datos públicos, duplica el análisis de IA, que es lo caro, y hace fácil filtrar datos privados al mostrar «quién más guardó esto».

## Decisión

**`repositories` es global: una sola fila por repositorio de GitHub, identificado por su id de GitHub, con solo información pública y los resultados de IA, que se comparten. `user_repositories` es privada: una fila por cuenta y repositorio, con estado, favorito, rating, notas, fuente y fechas personales.** La inteligencia colectiva (análisis, embeddings, similares) opera a nivel `Repository`; nunca a nivel `UserRepository` (§4).

Reglas que se derivan y se comprueban:

- Toda query sobre `user_repositories` filtra por el `user_id` de la sesión, obtenido en el servidor. Nunca por un `userId` del cliente (§41).
- `GET` y `PATCH` por id responden `404` cuando la relación es de otra cuenta, indistinguible de cuando no existe.
- La búsqueda global y los similares nunca incluyen datos personales ni la identidad de quién guardó qué (§71, §26). Como mucho, agregados anónimos, y no en esta vertical.
- Los serializadores son dos objetos distintos: `Repository` (público) y `PersonalData` (privado), y el segundo solo se adjunta al dueño.

## Alternativas consideradas

**Una fila por usuario con la metadata copiada.** Es lo que hace un bookmark manager, y el maestro dice que este producto no debe serlo (§1). Multiplica el coste de IA por usuario.

**Datos personales como columnas nullable en `repositories`.** Imposible: un repositorio tiene muchos dueños.

## Consecuencias

Guardar un repositorio que otro ya guardó es barato: solo se crea la relación. El análisis se paga una vez. A cambio, la frontera privado/público es **la** invariante de seguridad del producto, y cada ruta nueva tiene que probarse con dos cuentas. Es el primer grave de `REVIEW.md` para este proyecto.

## Cómo se comprobó

Pendiente de la Entrega 2 (RGM-4): una prueba de integración por ruta privada con dos cuentas que guardan el mismo repositorio, y una comprobación en `verificar-docs.mjs` que exija, leyendo sin comentarios, que cada query de `user_repositories` en `apps/web/src/modules` lleve el filtro por sesión. La mutación `flujo-principal` del catálogo quita ese filtro y exige que la prueba y Playwright caigan.
