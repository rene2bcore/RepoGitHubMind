# Seguridad

## Reportar una vulnerabilidad

No abras un issue público. Escribe a **renelo.mx@gmail.com** con el asunto `RepoGitHubMind security`, describiendo cómo reproducirla. Se responde en un plazo de 7 días y se coordina la publicación del arreglo antes de hacerla pública.

## Qué se protege y cómo

RepoGitHubMind guarda bibliotecas personales privadas sobre repositorios públicos. Lo que más importa proteger son los datos personales de cada cuenta: notas, estado, rating, tags y colecciones. **Nunca salen a otro usuario.**

| Práctica | Dónde | Cómo se comprueba |
|---|---|---|
| Autorización en el servidor desde la sesión; nunca un `userId` del cliente | Toda query sobre `UserRepository` | Prueba de integración por ruta privada con dos cuentas; comprobación del verificador cuando exista el código |
| Cookies seguras y CSRF | Auth.js | Configuración por defecto de Auth.js, revisada en el PR de H1 |
| Validación de entrada con Zod | Formularios, Route Handlers, salidas de IA, variables de entorno | Pruebas por escenario `422` |
| Ningún error revela traza, SQL ni rutas del disco | Manejador único de errores, `DEBUG_HTTP_ERRORS=false` en todos los entornos ([ADR-0004](docs/adr/0004-el-volcado-de-depuracion-va-apagado.md)) | Prueba que provoca un `500` real y mira el cuerpo entero |
| Rate limiting | Registro, login, guardar repositorio, análisis de IA | Prueba de integración |
| README de GitHub saneado | Render Markdown sin `script`, `iframe` ni HTML crudo | Prueba unitaria con un README hostil |
| Uploads `.txt` validados por tamaño y MIME, no ejecutados, no conservados | Importación masiva | Prueba de integración |
| Sin SSRF | Solo se llama a `api.github.com` y al proveedor de IA configurado; nunca a una URL que venga del usuario | Prueba unitaria del normalizador de URL |
| Secretos solo en el servidor | `GITHUB_TOKEN`, `AI_API_KEY`, `AUTH_SECRET` | `scripts/verificar-docs.mjs` revisa los `.env.example`; los tokens nunca llegan al cliente |
| Cabeceras de seguridad | `next.config` | Revisadas en el PR de H1 |
| Dependencias | `pnpm audit --audit-level=high` en CI y Dependabot semanal | CI en rojo con una alta o crítica |

Lo que todavía no tiene prueba está declarado como hueco en [`docs/traceability.md`](docs/traceability.md).
