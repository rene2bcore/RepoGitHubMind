# Auditoría de las reglas de proceso

> Qué reglas declara este repositorio, cuáles se cumplen, cuáles no, y cuáles **no se pueden comprobar**.
>
> El modo de fallo de cada regla es una propiedad de la regla y se declara en `CLAUDE.md`. Aquí va el **estado**, que es empírico: solo sale contrastando la regla contra el repositorio, contando casos. «Casi siempre» sin número es exactamente la respuesta que este documento existe para desmontar.
>
> Preparado el 2026-09-14, en la Entrega 1, con **cero commits de producto**: la columna de estado se rellena con evidencia al cerrar la Entrega 2 y otra vez al cerrar la final, con `git log`, `git rev-list` y `gh run list --limit N`. Donde no hay rastro comprobable, se dice.

## Por qué existe este documento

**Una regla escrita en un fichero es una petición, no una garantía.** Se cumple lo bastante como para que dejes de comprobarla, y entonces deja de cumplirse sin que nadie se entere.

Dos cosas distintas que conviene no mezclar:

- **El modo de fallo**: ruidoso (se nota solo), silencioso (hay que bajarlo a algo que lo ejecute) o no comprobable (se dice, en vez de fingir). Se razona sin mirar nada. Decide en qué capa tiene que vivir la regla.
- **El estado**: se cumple, no se cumple, no se puede comprobar. Solo sale mirando.

## 1 · La intuición, antes de mirar

Se anota **antes** de comprobar nada, y se anota de quién es. Si al comprobar coincide, no sabrás si acertó la intuición o el modelo, salvo que lo hayas escrito antes.

| Regla | Modo de fallo | Intuición (Claude, 2026-09-14, aceptada por el autor sin mirar) |
|---|---|---|
| Un bug deja una prueba detrás | Silencioso | `casi siempre`, porque CI lo rechaza desde el primer push; lo que no se sabrá es si se reprodujo antes |
| Al índice se va por nombre | Silencioso, auditable | `siempre` |
| Los hooks no se saltan | Ruidoso | `siempre` |
| Cada historia empieza y termina en Jira | Silencioso | `a veces`: mover el ticket al abrir el PR es lo que más se olvida |

## 1 bis · La distancia entre la intuición y la evidencia

Se rellena al cerrar la Entrega 2. Es lo que el ejercicio existe para producir.

| Regla | Intuición | Evidencia, con número | Distancia |
|---|---|---|---|
| Un bug deja una prueba detrás | casi siempre | **N de M** commits `fix:` traen prueba (contado con `scripts/fix-con-prueba.mjs` sobre todo el historial) | |
| Al índice se va por nombre | siempre | **N de M** commits sin ficheros que no debían entrar | |
| Los hooks no se saltan | siempre | No medible: `--no-verify` no deja rastro | |
| Cada historia empieza y termina en Jira | a veces | **N de M** PR con su ticket en «En revisión» al abrirse | |

## 2 · Todas las reglas del repositorio

| # | Regla | Modo de fallo | Qué la ejecuta | Estado, con evidencia |
|---|---|---|---|---|
| R-01 | Rama por unidad de trabajo; nunca commit directo en `main` | Silencioso | `.githooks/pre-commit`, probado en CI por `probar-hook-rama.mjs` | Entrega 1: el primer commit fue directo a `main` porque crea la historia; todo lo demás por PR. Contar desde la Entrega 2 |
| R-02 | Commit convencional por petición; un PR por unidad | Ruidoso | `.githooks/commit-msg`. El PR se nota si falta | Entrega 1: N commits, todos convencionales (el hook estaba activo); 2 PR |
| R-03 | Revisor adversarial sobre cada PR | Silencioso | `revision-adversarial.yml`. No bloquea | Entrega 1: pendiente de ver el primer informe |
| R-05 | Contrato al día en el mismo commit | Silencioso | `pnpm openapi:check` en CI; sin código, las mutaciones `rutas-documentadas` y `ruta-protegida-publica` | Vistas morder en local el 2026-09-14 |
| R-06 | Verificar por código de salida | Silencioso | `verificar-docs.mjs` exige `pipefail` en los workflows; mutación `R-06` | Vista morder en local el 2026-09-14 |
| R-07 | Los hallazgos cruzan al cambiar de rama base | Silencioso | `mutaciones.mjs` al saltar; el resto a mano | No aplica todavía: una sola rama base |
| R-08 | Un bug deja una prueba | Silencioso | `fix-con-prueba.mjs` en CI, con `Sin-prueba:` como salida explícita | Entrega 1: 0 commits `fix:` |
| R-09 | Al índice por nombre | Silencioso, auditable | El historial; falta quien lo lea | Entrega 1: todos los `git add` por nombre; sin ficheros indebidos en el índice |
| R-10 | Los hooks no se saltan | Ruidoso | El propio hook | `--no-verify` no deja rastro: si se cumple no se puede medir |
| R-11 | Todo atajo se escribe como deuda | Silencioso, y el que más decae | Nada, salvo la clase que cubre `Sin-prueba:` | Entrega 1: H-01 es el atajo declarado |
| R-12 | Lint, test fallando o flaky se arreglan aunque no los hayas causado | Silencioso | CI para lo que corre en CI | Sin código |
| R-13 | La documentación desactualizada es peor que no tenerla | **No comprobable** | Nada puede. Ver sección 3 | No se puede comprobar |
| R-14 | Una comprobación cuenta cuando se la ha visto fallar | Peor que silencioso: garantía falsa | `mutaciones.mjs` en CI | Se cumple para lo que está en el catálogo, y solo para eso: 6 entradas el 2026-09-14 |
| R-15 | Cada historia empieza y termina en Jira | Silencioso | `/priority-ticket`; nada lo comprueba | Entrega 1: épica y 7 historias creadas; ninguna movida todavía |

## 2 bis · Qué se hace con cada una

Dos preguntas: **¿puede pasar meses sin que nadie note el incumplimiento?** y, si sí, **¿es computable?**

| # | ¿Meses sin notarse? | ¿Computable? | Qué se hace |
|---|---|---|---|
| R-01 | Sí | Sí, **previniendo** | Bajada al hook |
| R-02 | No | - | Conservar escrita |
| R-03 | Sí | Su ejecución sí; su criterio no | Bajada a CI; el criterio en `REVIEW.md` |
| R-05 | Sí | Sí | Bajada a CI |
| R-06 | Sí | En los workflows sí; en local no | Bajada en CI, conversación en local |
| R-07 | Sí | Lo que está en el catálogo | Bajada a medias |
| R-08 | Sí | La mitad «deja una prueba» | Bajada esa mitad; «reproducirlo antes» sigue siendo conversación |
| R-09 | Sí en teoría | Del pasado no; `.gitignore` cubre lo que importa | Conservar escrita |
| R-10 | No | No | Conservar escrita: el hook de R-01 le da objeto |
| R-11 | Sí | No, salvo `Sin-prueba:` | Conversación |
| R-12 | Sí | Sí: es CI | Ya bajada |
| R-13 | - | No puede serlo | Tercera categoría |
| R-14 | Sí, y peor | Sí | Bajada al catálogo. Qué entra en él sigue siendo criterio |
| R-15 | Sí | Parcialmente: se puede contrastar `gh pr list` con el estado de los tickets vía MCP | Conversación en la Entrega 2; si se incumple, se baja a un script que compare PR abiertos con tickets en «En revisión» |

## 3 · La tercera categoría, que es la que se olvida

R-13 no está pendiente de comprobar: **no se puede comprobar**, y decirlo es más honesto que dejarla como aspiración. Ninguna comprobación sabe si un documento sigue siendo útil. Sabe si sigue **coincidiendo con el código**, que es otra cosa, y es exactamente lo que hace `scripts/verificar-docs.mjs`.

## 4 · El aviso

Bajar una regla a un guardarraíl **no la garantiza tampoco**. La columna «Qué la ejecuta» tiene una condición que no se ve en la tabla: **una comprobación cuenta cuando se la ha visto fallar a propósito**, no cuando existe. Es R-14, y su modo de fallo es el peor: las demás, cuando fallan, dejan el trabajo sin hacer; esta lo deja **aparentemente hecho**.

## 5 · Cómo se rellena la columna de estado

1. **Buscar en el repositorio lo que la regla predice.** Si dice que cada bug deja una prueba, los commits de arreglo tienen que traer un fichero de pruebas tocado.
2. **Contar los casos, no dar una impresión.** Y con `--limit`: `gh run list` devuelve veinte filas por defecto, y contar una página no es contar los casos.
3. **Anotar la distancia con la intuición**, que es lo que enseña.
4. **Decidir qué hacer con cada una**: bajarla a una comprobación, reescribirla para que sea comprobable, o retirarla.
