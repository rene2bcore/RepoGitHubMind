# ADR-0013 · Sesión propia con token opaco en PostgreSQL, en vez de Auth.js, mientras solo haya credenciales

## Estado

Aceptada · 2026-09-14

Reemplaza en parte la elección de Auth.js del prompt maestro §9 y de [`architecture.md`](../architecture.md) para R1. Mantiene las tablas `accounts` y `verification_tokens` que Auth.js necesitará en R2.

## Contexto

H1 pide registro con email y contraseña, sesión que sobreviva a recargar y que termine al salir, y `401` sin datos en toda ruta privada ([`specs/auth`](../specs/auth/spec.md)). El prompt maestro nombra Auth.js como pieza del stack, pensando en GitHub OAuth y Google, que el [`roadmap.md`](../roadmap.md) deja para R2.

Al implementar RGM-10 se comprobó lo que Auth.js con solo el proveedor de credenciales exige en la App Router de Next.js 16: un JWT en cookie (la estrategia `database` no está disponible con credenciales), un `authorize` que no puede devolver la forma de error del proyecto (`422` por campo, `429` por intentos), y las rutas `/api/auth/*` fuera del contrato OpenAPI. Los escenarios de la spec que más importan («Un fallo no revela si la cuenta existe», «Demasiados intentos», «Salir» invalida la sesión al momento) se implementan **rodeando** la librería, no con ella. Y cerrar sesión con JWT no revoca nada: el token sigue valiendo hasta caducar.

## Decisión

**La sesión es propia: un token opaco de 32 bytes aleatorios, guardado en la tabla `sessions` con caducidad, entregado en la cookie `rgm_session` (`HttpOnly`, `SameSite=Lax`, `Secure` fuera de desarrollo, `Path=/`). Cerrar sesión borra la fila. `getSessionUser(req)` en `apps/web/src/lib/session.ts` es la única fuente de identidad de los Route Handlers, y `currentUser()` la de los Server Components.**

```ts
// apps/web/src/lib/session.ts
export async function getSessionUser(req: Request): Promise<User> {
  const token = readSessionToken(req)
  if (!token) throw new AuthorizationError()
  const row = await getDb()
    .select(...)
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
  if (!row) throw new AuthorizationError()
  return row
}
```

Las contraseñas se guardan con `bcryptjs` (coste 10). El acceso compara siempre contra un hash, exista o no la cuenta, y responde el mismo `401` en los dos casos. Registro y acceso pasan por un rate limit en memoria por dirección (`apps/web/src/lib/rate-limit.ts`), suficiente para un proceso; con más de una réplica se mueve a PostgreSQL.

CSRF: la cookie es `SameSite=Lax` y toda mutación va por `POST`/`PATCH` con cuerpo JSON, que un formulario HTML de otro origen no puede enviar. No hay token CSRF adicional en R1.

## Alternativas consideradas

**Auth.js con credenciales, como decía el maestro.** Es lo que se venía diciendo. Descartado para R1 por lo de arriba: obligaba a rodear la librería para cumplir la spec y dejaba el cierre de sesión sin revocación. Vuelve en R2, cuando entren GitHub OAuth y Google: la tabla `accounts` ya tiene la forma que su adaptador de Drizzle espera, y la sesión propia puede convivir o cederle el paso con una migración de datos trivial (las filas de `sessions` caducan solas).

**JWT firmado propio.** Sin estado y sin revocación: el mismo problema de Auth.js sin su ecosistema.

**Lucia u otra librería de sesiones.** Lucia se retiró como librería en 2025 y quedó como guía; lo que recomienda es exactamente esto.

## Consecuencias

Se gana: el contrato documenta las cuatro rutas de auth como cualquier otra, con la forma de error del proyecto; salir revoca al momento; las pruebas de integración ejercitan el código real sin simular una librería.

Cuesta: OAuth en R2 exige integrar Auth.js o escribir el flujo a mano, y la decisión hay que revisitarla entonces con un ADR nuevo. El rate limit en memoria no comparte estado entre réplicas. `purgeExpiredSessions` existe pero nadie lo llama todavía de forma periódica: las filas caducadas se acumulan hasta que el worker (H2) tenga un trabajo de mantenimiento.

Lo que lo ata: `apps/web/tests/auth.test.ts` (recargar conserva la sesión, salir la invalida, cookie inventada responde `401`, mismo cuerpo con email desconocido y con contraseña equivocada, `429` por intentos) y `apps/web/e2e/flujo.e2e.ts` desde la pantalla.

## Cómo se comprobó

Suite en verde (43 pruebas, `pnpm test; echo $?` da 0) y Playwright en verde a escritorio y a 375 px. Mutación a mano el 2026-09-14: quitando la condición `gt(sessions.expiresAt, new Date())` la prueba «una sesión caducada responde 401» se pone en rojo por ese motivo; restaurada, verde. La carrera de altas entró en el catálogo de mutaciones como `ADR-0005`: sin la traducción del error de índice único, la prueba «la carrera de altas la para el índice único y responde 422, no 500» se pone en rojo.
