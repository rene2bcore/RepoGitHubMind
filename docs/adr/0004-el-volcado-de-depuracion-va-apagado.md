# ADR-0004 · El volcado de depuración va apagado, salvo que alguien lo encienda

## Estado

Aceptada · 2026-09-14

## Contexto

Con la depuración encendida fuera de producción, que es el valor por defecto de la mayoría de los frameworks, cualquier error devuelve en el cuerpo de la respuesta el nombre de la excepción, la traza, rutas absolutas del disco y, si el error viene de la base de datos, la sentencia SQL. Con una ruta desconocida y sin sesión: basta alcanzar el puerto.

Y apagar el volcado no basta: la rama sin depuración de muchos frameworks responde `{ message: error.message }`, y el `message` de un error de base de datos es la sentencia SQL entera con los valores insertados. En el proyecto de origen del harness se reprodujo devolviendo un `insert into users …` completo, con el hash de la contraseña, en el alta y sin sesión.

En Next.js, el overlay de errores de desarrollo y las páginas de error por defecto tienen el mismo comportamiento, y un Route Handler que deja escapar una excepción devuelve un `500` con detalle en desarrollo.

## Decisión

**Un manejador de errores único en `apps/web/src/lib/errors.ts`, que todo Route Handler usa, y ningún `5xx` devuelve su mensaje.** Un error inesperado responde siempre `{ "errors": [{ "message": "Error interno del servidor" }] }`, en todos los entornos. El detalle se registra en el log del servidor con id de petición. `DEBUG_HTTP_ERRORS`, booleano, apagado en `.env.example` y en `.env.test`, es la única forma de encenderlo, a propósito.

Los errores tipados del prompt maestro §81 (`RepositoryNotFoundError`, `InvalidGitHubUrlError`, `GitHubRateLimitError`, `AIProviderError`, `AuthorizationError`, `ValidationError`) se traducen a `404`, `422`, `429`, `502`, `401` y `422` con la forma del proyecto; cualquier otra excepción es un `500` cerrado.

## Alternativas consideradas

**Confiar en `NODE_ENV=production`.** Depende de que nadie despliegue nunca con el entorno mal puesto, y en desarrollo el puerto accesible en la red local expone la estructura del proyecto.

**Normalizar excepción por excepción.** Funciona para lo que se conoce y deja abierto lo que aparezca mañana.

## Consecuencias

Un error inesperado ya no se lee en el navegador; hay que mirar el log del servidor o encender la variable. Un 4xx es tráfico esperado y su cuerpo ya dice lo que hay que saber. Los logs siguen conteniendo trazas y SQL, que es su función: eso no es una fuga, es un permiso.

## Cómo se comprobó

Pendiente de la Entrega 2 (ticket RGM-10): una prueba que provoque un `500` real de forma determinista (violar el índice único de `users` por debajo del validador) y compruebe el cuerpo entero contra una lista de rastros: `insert into`, el nombre de la excepción, el prefijo del hash. Y una comprobación en `verificar-docs.mjs` que exija que el manejador intercepte `status >= 500` con la forma cerrada, que `DEBUG_HTTP_ERRORS` sea booleano en el esquema de entorno, y que venga en `false` en `.env.example` y `.env.test`. Vistas fallar quitando la intercepción.
