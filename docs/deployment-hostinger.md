# Despliegue en un VPS (Hostinger)

> **No ejecutado nunca** a 2026-09-14. Es el objetivo de producción del [prompt maestro](prompts/00-prompt-maestro.md) §48, §49 y §85, escrito desde lo que la configuración exige. Fuera del alcance de la entrega académica ([`roadmap.md`](roadmap.md)). Quien lo ejecute por primera vez lo convierte en procedimiento y lo fecha aquí.

## Objetivo

Un VPS Ubuntu con Docker y Docker Compose, Cloudflare delante para DNS, HTTPS y controles básicos, PostgreSQL con pgvector en el mismo VPS, y backups diarios. Coste: un VPS económico más el uso de APIs (§92). Nada depende de Vercel. Dokploy es opcional más adelante.

## Lo que el código exige

|               |                                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Imágenes      | `docker/Dockerfile.web` y `docker/Dockerfile.worker`, build multi-stage con `pnpm` y `NODE_ENV=production`                                                                                                                            |
| Variables     | Las de `.env.example` con valores reales en un `.env` del servidor, nunca en el repositorio. `AUTH_URL` con el dominio real, `AUTH_SECRET` propio, `AI_API_KEY`, `GITHUB_TOKEN` opcional, `DEBUG_HTTP_ERRORS=false`, `LOG_LEVEL=info` |
| Base de datos | `pnpm db:migrate` antes de arrancar `web` y `worker`, en el mismo despliegue. Una migración que borra datos no se deshace: backup antes                                                                                               |
| Arranque      | `docker compose -f docker/docker-compose.yml --profile prod up -d`                                                                                                                                                                    |
| Vuelta atrás  | Desplegar la imagen anterior y restaurar el backup si la migración lo exige                                                                                                                                                           |
| Salud         | `GET /api/health` (roadmap: no toca la base) para Cloudflare y para el propio compose                                                                                                                                                 |

## Cloudflare

DNS del dominio en Cloudflare; proxy activado; HTTPS con certificado de origen o túnel; reglas básicas de rate control en `/api/v1/auth/*`. En la primera etapa puede seguir siendo Cloudflare Tunnel desde el VPS, sin abrir el puerto 3000.

## Backups

Obligatorios antes de considerar producción real (§85).

- `pg_dump` diario del contenedor `postgres` a un directorio del VPS y a un almacenamiento externo (S3 compatible o el propio Cloudflare R2).
- Retención: 7 diarios, 4 semanales, 3 mensuales.
- Procedimiento de restauración escrito y **probado** antes del primer despliegue: restaurar en una base vacía, arrancar `web` contra ella, entrar con un usuario. Un backup que no se ha restaurado nunca no es un backup.

## Observabilidad mínima

Logs estructurados con id de petición, logs de trabajos del worker, `ai_usage` y errores de GitHub (§50). Sin infraestructura pesada; OpenTelemetry se evalúa después.

## Checklist del primer despliegue

- [ ] VPS con Ubuntu, Docker y Compose, usuario sin root para el despliegue
- [ ] `.env` del servidor con valores reales y permisos `600`
- [ ] Dominio en Cloudflare apuntando al VPS o túnel
- [ ] `docker compose up -d postgres`, `pnpm db:migrate`, `pnpm db:seed` solo la taxonomía (sin usuario de desarrollo)
- [ ] `web` y `worker` arriba, `/api/health` respondiendo por el dominio
- [ ] Backup diario programado y **una restauración probada**
- [ ] Fecha y quién lo hizo, aquí
