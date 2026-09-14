# Contrato de la API

`openapi.json` es el contrato de los Route Handlers bajo `/api/v1`: rutas, parámetros, tipos, respuestas y errores.

**Se genera desde los esquemas Zod y se versiona aquí** ([ADR-0001](../adr/0001-el-contrato-se-genera-se-versiona-y-se-vigila-la-deriva.md)). Desde H1 lo genera `apps/web/scripts/openapi.ts` a partir del registro de `apps/web/src/openapi/document.ts`, y no se edita a mano. Hoy contiene las cuatro rutas de `auth`; las de repositorios, biblioteca y búsqueda entran con H2, H3 y H5 en el mismo commit que su código.

```bash
pnpm openapi:generate   # escribe docs/api/openapi.json desde los esquemas Zod registrados
pnpm openapi:check      # sale 1 si el fichero ya no es el contrato generado. No arregla nada
```

CI ejecuta la comparación en cada push. Un rojo ahí significa que alguien cambió la API sin regenerar el contrato: se regenera en local, se revisa el diff y se commitea. Si el diff no era esperado, el cambio de código es el problema.

## Qué no está en el contrato, a propósito

- Las Server Actions: no son HTTP público. Se documentan en `docs/capabilities/`.
- Las páginas: `/login`, `/register`, `/library`, `/search` son HTML, no API.
- `GET /api/health` y `GET /api/health/ready`: son de la infraestructura (healthcheck del contenedor, Cloudflare y el script de despliegue), no del producto. Públicas, sin datos. Ver [`deployment-hostinger.md`](../deployment-hostinger.md).

## Lo que un generador no puede afirmar

Y por eso `scripts/verificar-docs.mjs` sí lo contrasta:

- Que toda ruta protegida lleve esquema de seguridad. `security: []` en OpenAPI no es «no se ha dicho nada»: es «esta ruta es pública». Solo `POST /api/v1/auth/register` y `POST /api/v1/auth/login` lo son.
- Que ninguna operación repita un parámetro (`name` + `in` únicos).
- Que la tabla de rutas de `CLAUDE.md` coincida con el contrato.

Las dos primeras están en el catálogo de mutaciones desde el primer push.

## Los tres endpoints principales

Para la sección 4 del readme de LIDR, los que sostienen el flujo que se demuestra:

1. `POST /api/v1/repositories`: guardar por URL. Responde `201` con la metadata ya presente y el análisis de IA pendiente; `200` si ya estaba en mi biblioteca.
2. `PATCH /api/v1/repositories/{id}/personal`: estado, favorito, rating y notas. `404` también cuando el id es de otra cuenta.
3. `GET /api/v1/search?q=...`: búsqueda híbrida. Con `scope=global` nunca incluye datos personales de nadie.

Ejemplo:

```http
POST /api/v1/repositories
Content-Type: application/json
Cookie: rgm_session=...

{ "url": "https://github.com/pgvector/pgvector", "source": "whatsapp" }
```

```json
HTTP/1.1 201 Created
{
  "data": {
    "id": "6f1c…",
    "repository": {
      "fullName": "pgvector/pgvector", "stars": 19400, "license": "PostgreSQL",
      "primaryLanguage": "C", "githubPushedAt": "2026-09-12T10:04:00Z",
      "analysis": { "status": "PENDING", "aiAnalyzedAt": null }, "categories": []
    },
    "personal": { "status": "NEW", "favorite": false, "rating": null, "notes": null, "savedAt": "2026-09-14T07:00:00Z" }
  }
}
```

## La forma del error también es contrato

Todos los errores que el proyecto controla salen con la misma forma:

```json
{ "errors": [{ "message": "...", "field": "...", "rule": "..." }] }
```

`field` y `rule` solo cuando vienen de validar un campo. Un `404` no los lleva: no viene de un campo, y ponerlos sería inventar una causa. Un `5xx` responde `{ "errors": [{ "message": "Error interno del servidor" }] }` y nada más ([ADR-0004](../adr/0004-el-volcado-de-depuracion-va-apagado.md)).
