# Capabilities

Un README por capability, escrito **desde el código** cuando exista: qué rutas hay, qué acepta cada una, qué Server Actions expone, cómo se arranca y se prueba en local. Las reglas no se repiten aquí: viven en [`../specs/`](../specs/) y este README enlaza a cada una y dice dónde está implementada.

| Capability     | Spec                                                  | README                                                          | Estado             |
| -------------- | ----------------------------------------------------- | --------------------------------------------------------------- | ------------------ |
| `auth`         | [`specs/auth`](../specs/auth/spec.md)                 | [`capabilities/auth/README.md`](auth/README.md)                 | Escrito con RGM-10 |
| `repositories` | [`specs/repositories`](../specs/repositories/spec.md) | [`capabilities/repositories/README.md`](repositories/README.md) | Escrito con RGM-3  |
| `library`      | [`specs/library`](../specs/library/spec.md)           | [`capabilities/library/README.md`](library/README.md)           | Escrito con RGM-4  |
| `ai`           | [`specs/ai`](../specs/ai/spec.md)                     | [`capabilities/ai/README.md`](ai/README.md)                     | Escrito con RGM-5  |
| `search`       | [`specs/search`](../specs/search/spec.md)             | [`capabilities/search/README.md`](search/README.md)             | Escrito con RGM-6  |

## Plantilla

```markdown
# Capability: `nombre`

Qué hace, en dos frases y en lenguaje de producto.

> **Dónde está la verdad.** Las reglas viven en `docs/specs/nombre/spec.md` y este README no las repite: enlaza a cada una y dice dónde está implementada. Si algo de aquí y la spec no concuerdan, manda la spec.

## Route Handlers

| Método y ruta | Entrada | Handler | Devuelve | Sesión |
| ------------- | ------- | ------- | -------- | ------ |

## Server Actions

| Acción | Entrada | Dónde | Qué hace |
| ------ | ------- | ----- | -------- |

## Formas de respuesta

## Reglas que no se ven en el contrato

| Regla | Requisito de la spec | Dónde vive | Prueba |
| ----- | -------------------- | ---------- | ------ |

## Ejecutar y probar

pnpm vitest run <filtro>
```
