# Registro de IA · RepoGitHubMind

> Este registro muestra **el flujo de IA y el criterio humano**, no una colección de prompts sueltos. Cada entrada dice qué se pidió, con qué herramienta y modelo, qué salió, y qué validó, corrigió o descartó una persona. Una entrada sin ajuste humano es sospechosa: o el prompt era trivial o nadie lo revisó.
>
> El `prompts.md` del fork académico (`LIDR-academy/AI4Devs-finalproject`) tiene otra estructura, por secciones del readme de LIDR y con máximo 3 prompts por sección. Se rellena desde este registro y enlaza aquí para el detalle.

## Herramientas y modelos

| Herramienta | Modelo | Para qué | Desde |
|---|---|---|---|
| Claude Code (app de escritorio) | claude-fable-5-1 | Sesión interactiva: setup, plan, documentación; después implementación y pruebas | 2026-09-13 |
| `claude -p` en CI | sonnet, effort medium | Revisor adversarial read-only sobre cada PR (`.github/workflows/revision-adversarial.yml`) | 2026-09-14 |
| MCP de Atlassian | - | Crear y mover tickets de Jira `RGM` desde la sesión (`/priority-ticket`) | 2026-09-14 |

## Configuración del agente

| Pieza | Dónde | Qué hace |
|---|---|---|
| Instrucciones | `CLAUDE.md` (`AGENTS.md` apunta a él) | Comandos, arquitectura, modelo conceptual, reglas de proceso con su modo de fallo |
| Calibración del revisor | `REVIEW.md` | Siete categorías graves, tres menores como máximo, formato del informe |
| Subagente | `.claude/agents/adversarial-reviewer.md` | Revisor read-only. El mismo texto en local y en CI |
| Skills | `.claude/skills/commit`, `.claude/skills/priority-ticket` | Commit convencional; ticket de mayor prioridad en Jira |
| Hook | `.claude/settings.json` | Formatea con Prettier cada fichero que Claude edita, cuando hay `node_modules` |
| MCP | `.mcp.json` | Atlassian (Jira `RGM` en `ai4devs.atlassian.net`) |

## Prompts clave

### P-00 · Prompt maestro del producto

- **Fecha:** 2026-09-13
- **Herramienta y modelo:** escrito por el autor, con ayuda de Claude en chat, como especificación para Claude Code
- **Objetivo:** fijar qué es RepoGitHubMind, sus principios, el modelo conceptual Repository/UserRepository, el stack, el alcance exacto de MVP-R1, lo que queda fuera, las fases y la estrategia de dos repositorios.
- **Prompt:** íntegro en [`docs/prompts/00-prompt-maestro.md`](docs/prompts/00-prompt-maestro.md) (96 secciones).
- **Resultado:** es la fuente de la que salen `docs/prd.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/taxonomy.md`, `docs/ai-architecture.md`, `docs/roadmap.md` y los ADR 0006 a 0011.
- **Ajuste humano:** el maestro pide implementar Phase 0 y 1 de inmediato y trabajar sin gates; se subordinó a las obligaciones de LIDR (Entrega 1 solo documentación) y al harness (gates por fase). Los nombres de documentos en mayúsculas del maestro cedieron a los que el verificador exige. La organización `2BCORE` no existe en GitHub, así que el propietario es `rene2bcore`.

### P-01 · Prompt de setup con el Harness-LDIR

- **Fecha:** 2026-09-14
- **Herramienta y modelo:** Claude Code, claude-fable-5-1
- **Objetivo:** auditar el entorno, montar los dos repositorios con el harness, producir la documentación de la Entrega 1 y el plan verificable de la primera historia, sin escribir código.
- **Prompt:** `core-harness/Harness-LDIR/INPUT/PROMPT SETUP.md` (herramienta local, fuera del repositorio), derivado de la guía paso a paso de LIDR y del prompt maestro, con una tabla de tensiones resueltas entre los tres.
- **Resultado:** este repositorio tal como está en el PR de la Entrega 1: harness adaptado al monorepo pnpm, PRD, arquitectura C4, modelo de datos, 5 specs, 12 ADR, backlog con 7 historias y 3 tickets en Jira, trazabilidad, runbooks, y el fork académico con el producto bajo `producto/`.
- **Ajuste humano:** el autor decidió el repositorio público desde el primer commit, Jira con clave `RGM`, la fecha de la Entrega 1 y creó el proyecto de Jira a mano. El agente propuso una carpeta `AI4Devs-finalproject-RLL` y el autor la corrigió al nombre que da `git clone` en la guía. La sincronización por merge de historias se descartó al comprobar que `README.md` pisa a `readme.md` en Windows: se pasó a `git subtree`.

### P-02 · Pendiente: implementación de H1 (RGM-2)

- Se registrará al arrancar la Entrega 2 con `/priority-ticket`: ticket, spec, criterios, pruebas esperadas y ficheros. No se delega una tarea sin criterio de aceptación y sin un modo de verificarla.

## Workflows

| Workflow | Cuándo | Qué hace |
|---|---|---|
| Plan antes de código | Cada historia | El agente propone spec, pruebas y ficheros a tocar; una persona aprueba antes de implementar |
| `/priority-ticket` | Al empezar una tarea | Trae el ticket `RGM-n` de mayor prioridad en «Por hacer», lo mueve a «En curso» al aprobar el plan y a «En revisión» al abrir el PR |
| `/commit` | Al cerrar cada petición | Commit convencional desde el diff staged, sin `--no-verify` |
| Revisión adversarial | En cada push de una rama con PR abierto | Claude lee el diff contra la spec y publica graves y menores. No bloquea |
| Catálogo de mutaciones | En cada push | Reintroduce defectos ya arreglados y exige que la comprobación que los cubre se ponga en rojo |
| Subtree al fork | En cada entrega | `git subtree pull --prefix=producto producto main` en la rama de entrega del fork |

## Reglas que el agente sigue y cómo se comprueban

| Regla | Dónde vive | Quién la ejecuta |
|---|---|---|
| Rama por unidad de trabajo, nunca en `main` | `CLAUDE.md` R-01 | `.githooks/pre-commit` |
| Commit convencional | `CLAUDE.md` R-02 | `.githooks/commit-msg` |
| Todo `fix:` deja prueba | `CLAUDE.md` R-08 | `scripts/fix-con-prueba.mjs` en CI |
| Contrato al día | `CLAUDE.md` R-05 | `pnpm openapi:check` en CI |
| Documentación contrastada | `CLAUDE.md` R-13 | `scripts/verificar-docs.mjs` en CI |
| Una comprobación cuenta cuando se la ha visto fallar | `CLAUDE.md` R-14 | `scripts/mutaciones.mjs` en CI |
| Cada historia empieza y termina en Jira | `CLAUDE.md` R-15 | `/priority-ticket`; el estado se contrasta en la auditoría |

## Ajustes humanos transversales

- Ninguna dependencia se instala sin comprobarla en el registro de npm: hay paquetes maliciosos que ciertos modelos sugieren de forma recurrente.
- El revisor reporta contra la spec, no contra el gusto. Sus menores de estilo se ignoran según `REVIEW.md`, y se anota cuántos se descartan.
- Lo que la IA no puede saber del negocio está escrito en `.github/calibracion-revision.md`: una fuga de datos personales de otra cuenta va antes que una caída.
