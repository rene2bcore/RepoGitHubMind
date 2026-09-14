# RepoGitHubMind · atajos de desarrollo.
#
# Requisitos: Node 24, pnpm 10, Docker y GNU Make.
#   - macOS:        make viene con las Command Line Tools de Xcode.
#   - Linux / WSL:  sudo apt install make   (o el equivalente de tu distro)
#
# Windows sin WSL no está soportado: estas recetas usan sintaxis POSIX. Los
# comandos equivalentes a mano están en el README.

SHELL := /bin/bash
COMPOSE := docker compose -f docker/docker-compose.yml

.DEFAULT_GOAL := help
.PHONY: help setup start install env db migrate seed hooks verify clean

# La ayuda se genera a partir de los comentarios `## ...` de cada target, para
# que no haya un segundo listado que mantener a mano y que pueda divergir.
help: ## Muestra esta ayuda
	@echo "RepoGitHubMind · targets disponibles:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN { FS = ":.*## " }; { printf "  make %-8s %s\n", $$1, $$2 }'
	@echo ""

setup: install env db migrate seed hooks ## Deja el proyecto listo para arrancar
	@echo ""
	@echo "Setup completado. Arranca todo con: make start"

install:
	@command -v pnpm >/dev/null 2>&1 || { echo "pnpm no está instalado: corepack enable && corepack prepare pnpm@10 --activate"; exit 1; }
	@pnpm install --frozen-lockfile

env:
	@if [ ! -f .env ]; then \
		echo "Creando .env desde .env.example..."; cp .env.example .env; \
	else \
		echo ".env ya existe, no se toca."; \
	fi

db: ## Levanta PostgreSQL con pgvector en Docker
	@$(COMPOSE) up -d postgres

migrate:
	@pnpm db:migrate

seed:
	@pnpm db:seed

hooks: ## Activa los hooks de .githooks/
	@git config core.hooksPath .githooks
	@echo "Hooks activados: core.hooksPath = .githooks"

verify: ## Lo que corre CI, en local: lint, tipos, formato, pruebas, docs, hooks
	@set -e; \
	pnpm lint; pnpm typecheck; pnpm format:check; pnpm test; \
	node scripts/verificar-docs.mjs; \
	node scripts/probar-hook-rama.mjs; \
	node scripts/probar-hook-mensaje.mjs; \
	node scripts/probar-fix-con-prueba.mjs; \
	echo ""; echo "Todo en verde."

start: ## Levanta web y worker a la vez
	@if [ ! -f .env ]; then echo "Falta .env. Ejecuta primero: make setup"; exit 1; fi
	@$(COMPOSE) up -d postgres
	@pnpm dev

clean: ## Borra dependencias y los contenedores con sus datos
	@rm -rf node_modules apps/*/node_modules packages/*/node_modules
	@$(COMPOSE) down -v
	@echo "Listo. Vuelve a ejecutar: make setup"
