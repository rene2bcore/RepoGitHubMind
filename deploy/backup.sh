#!/usr/bin/env bash
# RepoGitHubMind · backup de PostgreSQL (RGM-14, maestro §85).
#
#   deploy/backup.sh              # backup programado (cron diario)
#   deploy/backup.sh predespliegue  # el que hace desplegar.sh antes de migrar
#
# `pg_dump` en formato custom desde el contenedor `postgres`, a
# backups/<tipo>/. Retención local: 7 diarios, 4 semanales (domingo),
# 3 mensuales (día 1), 3 predespliegue. Si existe deploy/backup.env con las
# credenciales de Cloudflare R2, cada fichero se sube también fuera del VPS:
# un backup que vive solo en el servidor se pierde con el servidor.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/repogithubmind}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$APP_DIR/docker/.env}"
DESTINO="${BACKUP_DIR:-$APP_DIR/backups}"
TIPO="${1:-diario}"
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

sello="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$DESTINO/diario" "$DESTINO/semanal" "$DESTINO/mensual" "$DESTINO/predespliegue"
chmod 700 "$DESTINO"

fichero="$DESTINO/$TIPO/repogithubmind-$sello.dump"
"${COMPOSE[@]}" exec -T postgres pg_dump -U rgm -d repogithubmind --format=custom --no-owner > "$fichero.part"
# Un dump vacío o truncado no cuenta: pg_restore tiene que poder leer su índice.
"${COMPOSE[@]}" exec -T postgres pg_restore --list < "$fichero.part" > /dev/null
mv "$fichero.part" "$fichero"
chmod 600 "$fichero"
echo "backup: $fichero ($(du -h "$fichero" | cut -f1))"

copias=("$fichero")
if [ "$TIPO" = "diario" ]; then
  if [ "$(date -u +%u)" = "7" ]; then cp "$fichero" "$DESTINO/semanal/" && copias+=("$DESTINO/semanal/$(basename "$fichero")"); fi
  if [ "$(date -u +%d)" = "01" ]; then cp "$fichero" "$DESTINO/mensual/" && copias+=("$DESTINO/mensual/$(basename "$fichero")"); fi
fi

# `find` y no `ls`: con pipefail, `ls` sobre una carpeta vacía sale con 2 y
# el script se cortaría después de escribir el backup y antes de subirlo.
recientes() { find "$@" -maxdepth 1 -name '*.dump' -printf '%T@ %p\n' 2>/dev/null | sort -rn | cut -d' ' -f2-; }
retener() { recientes "$DESTINO/$1" | tail -n +"$(($2 + 1))" | xargs -r rm -f; }
retener diario 7
retener semanal 4
retener mensual 3
retener predespliegue 3

R2_ENV="$APP_DIR/deploy/backup.env"
if [ -f "$R2_ENV" ]; then
  endpoint="$(grep -E '^R2_ENDPOINT=' "$R2_ENV" | cut -d= -f2-)"
  bucket="$(grep -E '^R2_BUCKET=' "$R2_ENV" | cut -d= -f2-)"
  for c in "${copias[@]}"; do
    rel="${c#"$DESTINO"/}"
    docker run --rm --env-file "$R2_ENV" -v "$DESTINO:/backups:ro" amazon/aws-cli:2.27.49 \
      s3 cp "/backups/$rel" "s3://${bucket:-rgm-backups}/$rel" \
      --endpoint-url "$endpoint" --only-show-errors
    echo "backup: subido a R2 $rel"
  done
else
  echo "backup: sin deploy/backup.env, solo copia local (falta la copia fuera del VPS)" >&2
fi
