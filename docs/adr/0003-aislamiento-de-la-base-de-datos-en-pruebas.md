# ADR-0003 · Aislamiento de la base de datos en las pruebas

## Estado

Aceptada · 2026-09-14

## Contexto

Una configuración de base de datos sin distinción por entorno hace que la suite escriba sobre la misma base que el servidor de desarrollo. El proyecto de origen del harness lo sorteaba con una transacción por caso declarada en cada fichero de prueba: funciona mientras todos los ficheros la declaren. El aislamiento no está en la configuración: está en que nadie se olvide. Se comprobó que el riesgo no era teórico: un fichero de prueba sin el hook escribió una fila en la base de desarrollo con la suite entera en verde. El modo en que falla es el peor, porque no falla.

Aquí la base es PostgreSQL en Docker, y `docker/docker-compose.yml` puede crear dos bases en el mismo contenedor.

## Decisión

**Dos bases en el mismo PostgreSQL, `repogithubmind` y `repogithubmind_test`; el cliente de `packages/db` elige `DATABASE_URL_TEST` cuando `NODE_ENV` es `test`; y el runner de Vitest fuerza `NODE_ENV=test` de forma incondicional al arrancar.**

```ts
// packages/db/src/client.ts (forma decidida)
const url = process.env.NODE_ENV === 'test' ? env.DATABASE_URL_TEST : env.DATABASE_URL
```

Las pruebas de integración migran la base de pruebas desde cero al arrancar y la vacían al terminar. Las pruebas de navegador levantan `web` y `worker` con `NODE_ENV=test`, contra la misma base de pruebas, y no corren a la vez que la suite de integración: comparten base a propósito para que el choque sea ruidoso.

## Alternativas consideradas

**Una sola base con transacción por caso.** Es lo que tenía el origen y falló en silencio con un descuido de una línea.

**Un contenedor distinto para pruebas.** Más piezas móviles para el mismo resultado; en CI ya es un servicio aparte.

**Testcontainers.** Correcto y más pesado; se revisa si el compose de pruebas se vuelve incómodo.

## Consecuencias

Apuntar la suite a la base de desarrollo deja de ser posible desde la shell: el runner fuerza el entorno. El `.env.test` fija `DATABASE_URL_TEST` y no hereda el `.env` de quien ejecuta.

Queda un límite: el aislamiento **entre casos** sigue dependiendo de que cada fichero limpie lo suyo. Lo que cambia es el radio del daño: una base de usar y tirar.

## Cómo se comprobó

Pendiente de la Entrega 2 (ticket RGM-9): una prueba de integración que pregunta a la conexión viva por `current_database()` y asserta `repogithubmind_test`; una comprobación en `verificar-docs.mjs` que lea `client.ts` sin comentarios y exija que la elección dependa de `NODE_ENV` y que la conexión use esa variable; y la entrada `ADR-0003` del catálogo de mutaciones, vista fallar intercambiando las dos ramas del ternario.
