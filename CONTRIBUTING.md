# Contribuir a RepoGitHubMind

Gracias por leer esto antes de abrir un PR. Las reglas de abajo no son estilo: cada una cierra un modo de fallo que ya costó algo, y casi todas las ejecuta una máquina. Las completas, con su modo de fallo, en [`CLAUDE.md`](CLAUDE.md).

## Antes de empezar

1. Lee [`README.md`](README.md), [`CLAUDE.md`](CLAUDE.md) y el PRD en [`docs/prd.md`](docs/prd.md). El producto está especificado en [`docs/prompts/00-prompt-maestro.md`](docs/prompts/00-prompt-maestro.md); lo que no está ahí ni en el PRD no está acordado.
2. `pnpm install` activa los hooks de `.githooks/`. Si clonaste sin instalar: `git config core.hooksPath .githooks`.
3. Toda historia tiene un ticket `RGM-n` en Jira y un fichero en `docs/backlog/`. Si lo que quieres hacer no tiene ticket, abre primero un issue en GitHub y se decide si entra.

## El ciclo

1. **Una rama por unidad de trabajo**, desde `main`: `git switch -c feat/RGM-n-<slug>`. El hook rechaza commits directos en `main`.
2. **Si cambia el comportamiento, primero la spec** en `docs/specs/<capability>/spec.md`, en comportamiento observable, con escenarios WHEN/THEN. Se revisa antes de escribir código.
3. **Pruebas por capa** según [`docs/estrategia-de-pruebas.md`](docs/estrategia-de-pruebas.md): unitaria para reglas de dominio, integración por escenario HTTP contra la base de pruebas, Playwright solo para lo que ninguna otra capa ve.
4. **Un bug se reproduce antes de arreglarlo, y deja una prueba.** CI rechaza un `fix:` que no toque una prueba, salvo `Sin-prueba: <motivo>` en el mensaje.
5. **Contrato y documentación en el mismo commit**: `pnpm openapi:generate` si tocaste Route Handlers o esquemas Zod; fila en `docs/traceability.md`; número de pruebas en `CLAUDE.md`.
6. **Commits convencionales** (`tipo(ámbito): qué`), al índice por nombre, nunca `--no-verify`, nunca `force push`.
7. **Un PR por unidad**, con la plantilla entera, incluida «Lo que este PR NO arregla». Las comprobaciones deterministas bloquean; el revisor adversarial informa.

## Dependencias

Ninguna dependencia nueva sin decirla en el PR con su motivo, y sin comprobarla antes en el registro de npm: nombre exacto, autor, descargas, última publicación. Hay paquetes maliciosos con nombres parecidos a los reales que ciertos asistentes sugieren de forma recurrente.

## Seguridad

Un fallo de seguridad no se abre como issue público. Ver [`SECURITY.md`](SECURITY.md).

## Licencia

Al contribuir aceptas que tu contribución se publique bajo [Apache-2.0](LICENSE), con el copyright de 2BCORE en [`NOTICE`](NOTICE). Los nombres y logos de RepoGitHubMind y 2BCORE no se transfieren por la licencia del código.
