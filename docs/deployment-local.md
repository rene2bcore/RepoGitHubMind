# Despliegue local y demo por Cloudflare Tunnel

> Desarrollo verificado a 2026-09-14 (Entrega 2). La demo por túnel desde esta máquina no se ha ejecutado: la Entrega final se publica desde el VPS ([`deployment-hostinger.md`](deployment-hostinger.md)). Lo que sigue sobre el túnel es lo que el diseño exige ([prompt maestro](prompts/00-prompt-maestro.md) §46, §47, §49).

## Desarrollo

Contenedores mínimos: `postgres` (con pgvector), `web`, `worker`. En desarrollo, `web` y `worker` pueden correr fuera de Docker si mejora la experiencia; `postgres` siempre dentro.

```bash
pnpm install --frozen-lockfile
cp .env.example .env                                   # rellena AUTH_SECRET y AI_API_KEY
docker compose -f docker/docker-compose.yml up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev                                               # web en http://localhost:3000 y worker (pnpm dev:web / dev:worker por separado)
```

Todo en contenedores, como en producción: [`deployment-hostinger.md`](deployment-hostinger.md) § «Probar el stack de producción en local».

`docker/docker-compose.yml` (desarrollo) solo levanta `postgres` y crea dos bases: `repogithubmind` y `repogithubmind_test`. La suite usa la segunda por construcción ([ADR-0003](adr/0003-aislamiento-de-la-base-de-datos-en-pruebas.md)).

## Demo R1: localhost expuesto por Cloudflare Tunnel

Sin abrir puertos en el router ni en el firewall. Cloudflare Tunnel crea una conexión saliente desde la máquina hasta Cloudflare, y Cloudflare enruta un subdominio hacia ella con HTTPS.

Requisitos: un dominio gestionado en Cloudflare (`PA-4` decide si se usa uno o se entrega video) y `cloudflared` instalado.

```bash
cloudflared tunnel login
cloudflared tunnel create repogithubmind
cloudflared tunnel route dns repogithubmind demo.TU-DOMINIO
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: <id del túnel>
credentials-file: /ruta/al/<id>.json
ingress:
  - hostname: demo.TU-DOMINIO
    service: http://localhost:3000
  - service: http_status:404
```

```bash
cloudflared tunnel run repogithubmind
```

Antes de exponerlo:

- `AUTH_URL=https://demo.TU-DOMINIO` en `.env`, y reiniciar `web`: la app la lee al arrancar y con `https://` marca la cookie de sesión como `Secure`.
- `NODE_ENV=production` y `pnpm build` para servir la build, no el servidor de desarrollo.
- `DEBUG_HTTP_ERRORS` sin definir o `false`. Encendido devuelve traza en el cuerpo de los errores ([ADR-0004](adr/0004-el-volcado-de-depuracion-va-apagado.md)).
- Un usuario de demo distinto del de desarrollo, con contraseña que no esté en ningún fichero.
- Rate limiting activo: el túnel expone el registro a Internet.

Cloudflare Workers no es requisito para nada (§49).

## Comprobar que funciona

1. Desde otro dispositivo (móvil con datos, no la wifi de casa), abrir `https://demo.TU-DOMINIO/register`.
2. Recorrer el flujo del PRD sección 4 entero.
3. Anotar aquí la fecha y qué falló la primera vez. Un despliegue que solo se ha visto pasar en la máquina donde se escribió está en la misma categoría que una comprobación que no se ha visto fallar.
