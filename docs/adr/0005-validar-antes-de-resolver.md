# ADR-0005 · La petición se valida antes de resolver el identificador

## Estado

Aceptada · 2026-09-14

## Contexto

Las rutas que resuelven un identificador de la URL hacen dos cosas: validar el cuerpo o los parámetros, y buscar el recurso. Cuando **las dos fallan a la vez**, una petición mal formada sobre un identificador que no existe, el orden decide la respuesta: `422` si se valida primero, `404` si se resuelve primero. En el proyecto de origen del harness una ruta hacía lo uno y dos hacían lo otro, y ninguna incumplía la spec porque la spec no decía nada.

Aquí hay una ruta más delicada: `GET` y `PATCH` sobre `/api/v1/repositories/{id}`, donde el `404` también tapa el caso «pertenece a otra cuenta».

## Decisión

**Se valida la petición, y solo después se resuelve el identificador.** Una petición mal formada sobre un recurso inexistente responde `422`, no `404`. Cuando la petición sí se entiende y el recurso no existe **o es de otra cuenta**, el `404` es la respuesta, y las dos cosas responden igual.

Un `404` dice «te entendí, y ese recurso no está». Es una afirmación sobre el mundo, y no se puede hacer honestamente sobre una petición que el sistema no ha conseguido entender. Hay **una sola forma de escribir un Route Handler**: `parse` de Zod en la primera línea, `getSessionUser()` en la segunda, y la resolución después. Eso es lo que hace la regla comprobable.

## Alternativas consideradas

**Resolver primero, y que gane el 404.** Defendible. Aquí, además, el argumento de que evita filtrar si un recurso existe pesa a favor del `404` unificado para «no existe» y «es de otra cuenta», y eso se conserva; lo que cambia es que la validación va antes.

**Dejar cada ruta como salga.** Convierte una incoherencia en contrato.

## Consecuencias

Se valida el cuerpo de una petición dirigida a un recurso que quizá no existe. Es trabajo desperdiciado en ese caso, y despreciable: la validación no toca la base de datos. Las specs de `library` lo recogen como escenarios («Rating fuera de rango» sobre un id inexistente responde `422`).

## Cómo se comprobó

Pendiente de la Entrega 2: una prueba que mande `{"rating": 6}` sobre un id inexistente y exija `422`, y `{"rating": 4}` sobre el mismo id y exija `404`. Y una comprobación en `verificar-docs.mjs` que recorra **cada Route Handler** y compare la posición del `parse` con la de la primera consulta a la base. Vista fallar invirtiendo el orden en una sola ruta.
