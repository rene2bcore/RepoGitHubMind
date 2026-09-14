# Contrato de la API

`openapi.json` es el contrato de los Route Handlers bajo `/api/v1`: rutas, parámetros, tipos, respuestas y errores.

**Se genera desde los esquemas Zod y se versiona aquí** ([ADR-0001](../adr/0001-el-contrato-se-genera-se-versiona-y-se-vigila-la-deriva.md)). Hasta la Entrega 2 no hay código que lo genere, así que el fichero actual es el **contrato objetivo escrito a mano** ([H-01](../hallazgos.md)): la primera historia que implemente una ruta lo regenera y, desde ese momento, no se edita a mano.

```bash
pnpm openapi:generate   # escribe docs/api/openapi.json desde los esquemas Zod registrados
pnpm openapi:check      # sale 1 si el fichero ya no es el contrato generado. No arregla nada
```

CI ejecuta la comparación en cada push. Un rojo ahí significa que alguien cambió la API sin regenerar el contrato: se regenera en local, se revisa el diff y se commitea. Si el diff no era esperado, el cambio de código es el problema.

## Qué no está en el contrato, a propósito

- Las rutas de Auth.js (`/api/auth/*`): las gestiona la librería.
- Las Server Actions: no son HTTP público. Se documentan en `docs/capabilities/`.

## Lo que un generador no puede afirmar

Y por eso `scripts/verificar-docs.mjs` sí lo contrasta:

- Que toda ruta protegida lleve esquema de seguridad. `security: []` en OpenAPI no es «no se ha dicho nada»: es «esta ruta es pública». Solo `POST /api/v1/auth/register` lo es.
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
Cookie: authjs.session-token=...

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
