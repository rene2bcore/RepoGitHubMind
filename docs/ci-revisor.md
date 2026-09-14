# El revisor adversarial en CI

> Qué hace el job, qué hace falta para que funcione, y por qué usa `claude -p` y no la acción oficial.

## Qué hay montado

`.github/workflows/revision-adversarial.yml` lanza a Claude sobre cada cambio propuesto y publica el informe en el PR.

| | |
|---|---|
| **Instrucciones** | `.claude/agents/adversarial-reviewer.md`, sin su frontmatter |
| **Calibración** | [`REVIEW.md`](../REVIEW.md), en la raíz. Una pantalla |
| **El porqué de cada decisión** | [`.github/calibracion-revision.md`](../.github/calibracion-revision.md). **No se inyecta** |
| **Herramientas** | `Read`, `Grep`, `Glob`. Todo lo que escribe o sale a la red va negado explícitamente |
| **Modelo** | `--model sonnet --effort medium`. Las dos palancas de coste |
| **CLI** | `@anthropic-ai/claude-code@2.1.252`, fijado porque corre donde vive la credencial |
| **Topes** | `--max-turns 40` turnos del modelo y `timeout-minutes: 10` de reloj del runner. Son dos cosas distintas |
| **Bloquea** | **No.** Lo determinista bloquea; el revisor informa |

El diff se calcula en el runner y se le entrega **ya escrito en un fichero**, así que el revisor no necesita shell para verlo. Es la defensa que sigue en pie aunque falle cualquier otra. Se excluyen del diff la prosa `.md`, `pnpm-lock.yaml` y `components/ui/`: ninguna de las siete categorías graves de `REVIEW.md` puede darse ahí. `docs/api/openapi.json` **sí va**: es el contrato.

## Las dos credenciales, y no se mezclan

| Secreto | De dónde sale | Contrapartida |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token` en local, contra la suscripción | No hay factura por token, pero **gasta la misma cuota que usas para trabajar** |
| `ANTHROPIC_API_KEY` | `console.anthropic.com` | Se factura aparte |

Cruzarlas falla en la primera llamada, sin gastar nada y sin decir por qué. OpenRouter, Cline o cualquier otro proveedor **no sirven** aquí; y no confundir con los proveedores de IA del producto, que son otra cosa (maestro §19).

**El secreto está puesto**: `CLAUDE_CODE_OAUTH_TOKEN` en `rene2bcore/RepoGitHubMind`, fechado el 2026-09-14 (`gh secret list`). Sin él, el job se omitiría en verde y lo diría; con él y roto, sale rojo.

## Por qué no la acción oficial

`anthropics/claude-code-action` publica comentarios en línea firmados por la GitHub App de Claude. Aquí el producto vive en un repositorio propio donde sí se podría instalar, y el día que se quiera es la opción correcta. Se mantiene `claude -p` por dos motivos: el mismo texto de revisor sirve en local y en CI sin duplicar prompt, y el job no depende de una app instalada, así que funciona igual en un fork.

**La trampa del OIDC, por si algún día se usa la acción oficial**: valida que el fichero del workflow exista en la rama por defecto. Si el workflow es nuevo y no está en `main` y no se pasa `github_token`, **el job se salta a sí mismo y sale verde sin revisar nada**. El fix es una línea: `github_token: ${{ secrets.GITHUB_TOKEN }}`.

## Cuándo corre

En `pull_request` abierto, reabierto o listo para revisión sobre este repositorio; y en `push` a cualquier rama que tenga un PR abierto, buscándolo primero en `LIDR-academy/AI4Devs-finalproject` (por si la rama fuera de entrega) y después aquí. Sin PR, la puerta sale verde sin gastar nada. `concurrency` cancela la revisión anterior cuando llega un push nuevo. Si la rama de otro PR abierto es ancestro, la base pasa a ser esa rama: se revisa una sola unidad de trabajo.

## Visto funcionar

Por R-14, en dos pasos, y ninguna revisión cuenta hasta el segundo:

1. **Credencial puesta**: 2026-09-14, antes del primer push. Pendiente de ver la primera ejecución con informe, en el PR `chore/bootstrap`.
2. **Visto morder**: pendiente de la Entrega 2. Rama `test/ver-morder-al-revisor` con un defecto plantado que contradiga un escenario de `docs/specs/` (por ejemplo, devolver `personal` de otra cuenta en `GET /api/v1/search?scope=global`), abierta como PR y cerrada sin fusionar. El informe tiene que nombrarlo con `fichero:línea`, citar el escenario y dar el caso concreto.

## En qué se va el dinero

Minutos de máquina y consumo del modelo. Escala con el tamaño del diff y con cuántas veces corre. Con la suscripción, el presupuesto es **atención propia**: cada revisión inútil se paga en cuota que ibas a usar tú. Por eso los `.md` van fuera del diff y el tope de tres menores importa.

## Lo que queda como propuesta

**Tres revisores en cascada**: el adversarial encuentra, un segundo descarta falsos positivos, un tercero prioriza. Se implementa el día que aparezcan graves falsos, que es la señal que lo haría rentable.
