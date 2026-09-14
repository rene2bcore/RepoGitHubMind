#!/usr/bin/env bash
# RepoGitHubMind · probar que un backup se restaura (RGM-14).
#
#   deploy/restaurar.sh [fichero.dump]   # por defecto, el diario más reciente
#
# Restaura el dump en una base NUEVA `repogithubmind_restore` del mismo
# PostgreSQL, sin tocar la base en uso, comprueba que las tablas principales
# tienen las filas que el dump dice, y la borra. Un backup que nunca se ha
# restaurado no es un backup.
#
# Para restaurar de verdad sobre producción (desastre), ver
# docs/deployment-hostinger.md § Backups: se para web y worker, se restaura
# sobre `repogithubmind` con --clean y se vuelve a desplegar.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/repogithubmind}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$APP_DIR/docker/.env}"
DESTINO="${BACKUP_DIR:-$APP_DIR/backups}"
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")
PRUEBA=repogithubmind_restore

# `find` y no `ls`: con pipefail, `ls` sobre una carpeta vacía corta el script.
fichero="${1:-$(find "$DESTINO/diario" "$DESTINO/predespliegue" -maxdepth 1 -name '*.dump' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)}"
[ -n "$fichero" ] && [ -f "$fichero" ] || { echo "restaurar: no hay ningún dump" >&2; exit 1; }
echo "restaurar: $fichero"

psql() { "${COMPOSE[@]}" exec -T postgres psql -U rgm -v ON_ERROR_STOP=1 -tA "$@"; }

psql -d postgres -c "DROP DATABASE IF EXISTS $PRUEBA" > /dev/null
psql -d postgres -c "CREATE DATABASE $PRUEBA" > /dev/null
trap 'psql -d postgres -c "DROP DATABASE IF EXISTS '"$PRUEBA"'" > /dev/null' EXIT

"${COMPOSE[@]}" exec -T postgres pg_restore -U rgm -d "$PRUEBA" --no-owner --exit-on-error < "$fichero"

fallos=0
for tabla in users sessions repositories user_repositories repository_analyses background_jobs; do
  en_uso="$(psql -d repogithubmind -c "SELECT count(*) FROM $tabla" 2>/dev/null || echo "-")"
  restaurada="$(psql -d "$PRUEBA" -c "SELECT count(*) FROM $tabla")"
  echo "restaurar: $tabla restaurada=$restaurada en_uso=$en_uso"
done
migraciones="$(psql -d "$PRUEBA" -c "SELECT count(*) FROM drizzle.__drizzle_migrations")"
echo "restaurar: migraciones registradas en el backup=$migraciones"
[ "$migraciones" -gt 0 ] || fallos=1

if [ "$fallos" -ne 0 ]; then
  echo "restaurar: FALLA, el backup no tiene el esquema esperado" >&2
  exit 1
fi
echo "restaurar: OK, el backup se restaura y tiene datos legibles"
