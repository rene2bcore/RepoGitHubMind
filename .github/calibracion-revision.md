# Calibración de la revisión adversarial

> Qué se considera grave, cuántas sugerencias menores caben, y por qué esta revisión **no bloquea**.
>
> Un guardarraíl no muere fallando. Muere acertando sobre cosas que a nadie le importaban, hasta que nadie lo lee. Este fichero existe para retrasar ese momento.
>
> **Este documento no se inyecta al revisor.** Lo que se le pasa es [`REVIEW.md`](../REVIEW.md), en la raíz, que cabe en una pantalla y dice **qué** hacer. Aquí queda el **porqué**: de dónde sale el gasto, por qué no bloquea, y qué no se ha visto funcionar. Es para quien mantiene el job, no para el modelo. Si las dos listas de categorías dejan de coincidir, **manda `REVIEW.md`**, que es la que se ejecuta.

## Por qué no bloquea

Las comprobaciones deterministas de `verificacion.yml` (tipos, lint, pruebas, contrato, verificador, mutaciones) **sí bloquean**, porque su respuesta no depende del día: o el contrato coincide con el código o no.

Esta no. Es un modelo leyendo un diff, y se equivoca. Un revisor no determinista que tumba la build se desactiva la primera vez que se equivoca con prisa, y entonces no queda ni revisor ni build.

Así que el reparto es: **lo determinista bloquea, el revisor informa.** Lo que decide si el revisor sirve no es su veredicto, es cuántos de sus hallazgos acaban en un cambio de código.

## Qué se considera grave

Las siete categorías de `REVIEW.md`, y solo esas. Un hallazgo que no encaje en ninguna es menor, por convincente que suene. En particular no lo son: estilo, nombres, comentarios que no mienten, preferencias de estructura, «esto podría extraerse a una función», ni rendimiento sin un número que lo respalde.

## Cuántas sugerencias menores caben

**Tres por revisión, como máximo.** Las tres mejores, no las tres primeras. Un informe de quince puntos menores no es más exhaustivo: es un informe que nadie va a leer entero, y el efecto real de publicarlo es que la próxima revisión tampoco se lea.

Sin hallazgos graves y sin nada menor que llegue al umbral, el informe correcto es **una línea diciendo que no hay nada**.

## Qué se pide de cada hallazgo

**Un caso que lo provoque.** No «esto podría fallar si el usuario manda algo raro», sino qué hay que mandar y qué devuelve. Un hallazgo sin caso concreto es una sospecha, y las sospechas van en menores o no van.

**Contraste contra la spec, no contra el gusto.** El adversario no decide qué es un bug: lo deciden `docs/specs/`, `docs/api/openapi.json` y `CLAUDE.md`. Un comportamiento que ningún documento exige y ninguno prohíbe es un hueco de la spec, y eso se dice como tal.

## Presupuesto

Una ejecución por cambio propuesto, no por commit. `concurrency` cancela la revisión anterior cuando llega un push nuevo, y en `push` el job sale antes de gastar nada si la rama no tiene PR abierto.

Se revisa **una sola unidad de trabajo**: si la rama de otro PR abierto es ancestro de esta, ese trabajo ya tuvo su revisión y la base pasa a ser esa rama. Pagar por revisar dos veces el mismo trabajo es la forma más rápida de que las revisiones dejen de leerse.

`--max-turns 40` es el tope duro. Si una revisión lo agota, el problema es el tamaño del diff, no el tope.

### De dónde sale el gasto

| Secreto                   | De dónde sale                               | Contrapartida                                                                                                        |
| ------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token`, contra la suscripción | No hay factura por token. **Pero el gasto sale de la misma cuota que usas para trabajar**                            |
| `ANTHROPIC_API_KEY`       | Consola de Anthropic                        | Se factura aparte y no toca la cuota personal. Es lo correcto el día que esto deje de ser un proyecto de una persona |

Cruzarlas falla en la primera llamada, sin gastar nada y sin decir por qué. OpenRouter, Cline o cualquier otro proveedor **no sirven**: el CLI autentica contra Anthropic, Bedrock, Vertex o Foundry, y nada más.

### El token caduca

`claude setup-token` da un token de larga duración, no eterno. Cuando expire, la credencial seguirá **presente** y dejará de valer. El job distingue los dos casos a propósito:

- **Sin credencial**: se omite, verde, una línea en el resumen. Es un estado esperado.
- **Con credencial y fallando**: **rojo**, con el error en el resumen.

Un rojo por algo que nunca se configuró enseña a ignorar el rojo. Un verde silencioso cuando la revisión que sí configuraste dejó de ejecutarse es peor: es un guardarraíl que desapareció sin avisar.

## Criterio de priorización

El revisor no ordena por «criticidad»: ese es el criterio que inventa quien no tiene otro, y seis corridas del mismo prompt sobre el mismo código dan seis órdenes distintos. Lo que se le pide son las **cuatro casillas** de `REVIEW.md` (daño, radio contado, reversibilidad, precedencia) y el orden lo pone este fichero, no el modelo:

1. **Precedencia primero, en orden topológico.** Si el arreglo de A abarata el de B, A va antes.
2. **Dentro de cada nivel, daño ÷ radio.** Un daño grande en un sitio va antes que el mismo daño repartido en diez.
3. **El negocio desempata.** Aquí, con bibliotecas privadas por usuario, **una fuga de datos personales de otra cuenta (notas, estado, rating) va antes que una caída**, y una caída va antes que un coste de IA disparado. Es lo que el modelo no sabe y lo que decide el orden.
4. **Contención antes que arreglo cuando el arreglo no cabe.** La contención es lo que se despliega hoy y revierte limpio; el arreglo es el deber ser. Se decide cuál va, no lo decide el modelo.

**Se delega la ejecución del diagnóstico, nunca el criterio ni la decisión.**

## Cómo se mide si esto sirve

Una sola métrica: **cuántos hallazgos acaban en un cambio de código.** No cuántos produce.

| Ejecución                                                                                                  | Qué encontró | ¿Acabó en código? |
| ---------------------------------------------------------------------------------------------------------- | ------------ | ----------------- |
| Pendiente: se plantará el primer defecto en la Entrega 2, cuando exista código que contradiga un escenario |              |                   |

## Estado: lo que se ha visto y lo que no

Por R-14, esta comprobación no cuenta hasta verla morder. El procedimiento:

1. Poner la credencial y ver el job ejecutar sus pasos en vez de omitirse.
2. Abrir una rama `test/ver-morder-al-revisor` con un defecto plantado que contradiga un escenario de la spec, abrirla como PR y **no fusionarla**.
3. Comprobar que el informe lo nombra con `fichero:línea`, cita el escenario roto y da el caso concreto.
4. Poner un valor inválido en el secreto y ver el job en **rojo** con `401`. Comprobar antes con `gh secret list` que el cambio se aplicó.
5. Volver a poner el token real y ver el verde **con informe**.

| Qué                                             | Visto                                                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La puerta omite en verde sin credencial         | No aplica: la credencial se puso el 2026-09-14 antes del primer push. Sí se vio la otra puerta: en `push` sin PR abierto, verde con «la rama no tiene PR abierto» (run `34818446587`) |
| El revisor nombra un defecto plantado           | Pendiente, Entrega 2                                                                                                                                                                  |
| Credencial inválida sale en rojo                | Pendiente                                                                                                                                                                             |
| El informe llega al PR                          | Visto el 2026-09-14 en el PR #1, run `34818658486`: comentario publicado con «Graves: Ninguno. Menores: Ninguno»                                                                      |
| `--disallowed-tools` acota de verdad al revisor | No se ha visto: el revisor nunca ha intentado usar una herramienta negada. La defensa que sí está en pie es que el diff se entrega en un fichero                                      |
