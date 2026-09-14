#!/usr/bin/env bash
# RepoGitHubMind · desplegar en el VPS (RGM-14).
#
# Como el usuario `rgm`, en /opt/repogithubmind:
#   deploy/desplegar.sh            # despliega origin/main
#   deploy/desplegar.sh <commit>   # despliega un commit concreto (vuelta atrás)
#
# Orden: backup de la base si ya existe -> código -> imágenes -> migrate y seed
# -> web y worker sanos -> /api/health/ready en 200. Si algo falla, sale
# distinto de cero y deja el despliegue anterior corriendo cuando es posible.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/repogithubmind}"
REF="${1:-origin/main}"
COMPOSE=(docker compose -f "$APP_DIR/docker/docker-compose.prod.yml" --env-file "$APP_DIR/docker/.env")

cd "$APP_DIR"
[ -f docker/.env ] || { echo "desplegar: falta docker/.env (copia de docker/.env.example)" >&2; exit 1; }
[ "$(stat -c %a docker/.env)" = "600" ] || { echo "desplegar: docker/.env debe tener permisos 600" >&2; exit 1; }

# Una migración que borra datos no se deshace: backup antes de tocar nada.
if "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx postgres; then
  "$APP_DIR/deploy/backup.sh" predespliegue
fi

git fetch --quiet origin
git checkout --quiet --detach "$REF"
echo "desplegar: $(git log --oneline -1)"

PERFILES=()
if grep -qE '^CLOUDFLARE_TUNNEL_TOKEN=.+' docker/.env; then PERFILES=(--profile tunnel); fi

"${COMPOSE[@]}" "${PERFILES[@]}" build
"${COMPOSE[@]}" "${PERFILES[@]}" up -d --wait --wait-timeout 300

PUERTO="$(grep -E '^WEB_PORT=' docker/.env | cut -d= -f2)"
curl -fsS "http://127.0.0.1:${PUERTO:-3000}/api/health/ready"
echo
docker image prune -f >/dev/null
echo "desplegar: listo en $(git rev-parse --short HEAD)"
