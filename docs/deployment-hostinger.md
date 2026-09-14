# Despliegue en un VPS (Hostinger)

> **Preparado en el código, no ejecutado todavía en el VPS** a 2026-09-14. Las imágenes y `docker/docker-compose.prod.yml` se construyen y levantan en CI en cada push (job «Imágenes de producción y stack arriba») y se probaron en local con GitHub real (RGM-12). El primer despliegue en el VPS es RGM-14: quien lo ejecute fecha aquí qué falló la primera vez.

## Objetivo

Un VPS Ubuntu con Docker Compose, PostgreSQL con pgvector en el mismo VPS sin puerto publicado, la web escuchando solo en `127.0.0.1`, Cloudflare Tunnel como única entrada desde Internet (el VPS no abre más puerto que el 22), y backups diarios con restauración probada. Coste: el VPS más el uso de APIs (maestro §92). Nada depende de Vercel.

## Lo que hay en el repositorio

| Pieza                            | Qué hace                                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker/Dockerfile.web`          | Next.js con `output: standalone` en una imagen `node:24-slim` que corre como `node`, sin pnpm ni código fuente. Healthcheck sobre `/api/health`           |
| `docker/Dockerfile.worker`       | Una imagen para el worker (comando por defecto) y para las migraciones. Ejecuta el TypeScript del workspace con `tsx`, igual que en desarrollo            |
| `docker/docker-compose.prod.yml` | `postgres` sin puerto publicado → `migrate` (termina bien o no arranca nada) → `web` en `127.0.0.1:3000` y `worker`. `cloudflared` con `--profile tunnel` |
| `docker/.env.example`            | Las variables de producción, sin valores. En el servidor se copia a `docker/.env` con permisos `600`                                                      |
| `GET /api/health`                | El proceso responde; no toca la base. Lo miran el healthcheck y Cloudflare                                                                                |
| `GET /api/health/ready`          | La web llega a la base; `503` sin detalle si no. Lo mira el script de despliegue antes de dar un despliegue por bueno                                     |
| Seed                             | Con `NODE_ENV=production` no crea el usuario de desarrollo                                                                                                |
| Worker                           | Borra las sesiones caducadas cada hora                                                                                                                    |

## Desplegar

```bash
cd /opt/repogithubmind
git pull --ff-only
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env --profile tunnel up -d --build --wait
curl -fsS http://127.0.0.1:3000/api/health/ready
```

`migrate` corre antes de `web` y `worker` en cada despliegue y es idempotente. **Una migración que borra datos no se deshace: backup antes.**

Vuelta atrás: `git checkout <commit anterior>` y el mismo `up -d --build`. Si la migración nueva ya cambió datos, restaurar el backup de antes del despliegue (sección Backups).

## Probar el stack de producción en local

```bash
cp docker/.env.example docker/.env      # rellena POSTGRES_PASSWORD y AUTH_SECRET; AUTH_URL=http://localhost:3000; TRUST_PROXY=false
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env up -d --build --wait postgres web worker
curl -fsS http://localhost:3000/api/health/ready
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env down -v
```

Con el puerto 3000 ocupado por `pnpm dev`, `WEB_PORT=3005` en `docker/.env`. `GITHUB_FAKE` está fijado a `0`: el stack de producción llama a GitHub de verdad.

## Cloudflare

Dominio gestionado en Cloudflare. Un túnel con nombre `repogithubmind` cuyo ingress lleva `app.<dominio>` a `http://web:3000`, y su token en `CLOUDFLARE_TUNNEL_TOKEN`. HTTPS lo pone Cloudflare; `AUTH_URL=https://app.<dominio>` hace que la cookie de sesión salga con `Secure`. `TRUST_PROXY=true` porque Cloudflare escribe `cf-connecting-ip` ([H-07](hallazgos.md)). Regla de rate limiting de Cloudflare en `/api/v1/auth/*` además de la de la aplicación.

## Backups

Obligatorios antes de considerar producción real (maestro §85). Llegan con RGM-14.

- `pg_dump` diario del contenedor `postgres` a un directorio del VPS y a un almacenamiento externo (Cloudflare R2).
- Retención: 7 diarios, 4 semanales, 3 mensuales.
- Restauración **probada** antes de dar el despliegue por bueno: restaurar en una base vacía, arrancar `web` contra ella, entrar con un usuario. Un backup que no se ha restaurado nunca no es un backup.

## Observabilidad mínima

Logs de `web` y `worker` con `docker compose logs`, errores 5xx con id de petición en el log de `web` (ADR-0004), trabajos del worker con su resultado, `ai_usage` con H4. Sin infraestructura pesada.

## Checklist del primer despliegue (RGM-14)

- [ ] VPS Ubuntu 24.04 con clave SSH, usuario de despliegue sin root, SSH sin contraseña, firewall con solo el 22, actualizaciones automáticas
- [ ] Docker Engine y Compose plugin
- [ ] `/opt/repogithubmind` clonado y `docker/.env` con valores reales y permisos `600`
- [ ] Túnel de Cloudflare creado y `app.<dominio>` enrutado
- [ ] `up -d --build --wait` y `/api/health/ready` en 200 por el dominio
- [ ] Backup diario programado y **una restauración probada**
- [ ] Flujo entero desde un móvil con datos
- [ ] Fecha, quién lo hizo y qué falló la primera vez, aquí
