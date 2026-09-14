# Specs vivas

> Qué hace el sistema, en comportamiento observable. Es lo que el revisor adversarial contrasta y lo que las pruebas citan.

## Qué va aquí y qué no

- **La spec viva**, en `specs/<capability>/spec.md`: requisitos en lenguaje normativo (`SHALL` / `NO SHALL`) con sus escenarios `WHEN` / `THEN`, escritos a nivel de comportamiento observable, nunca de implementación. Rutas, códigos de respuesta y datos visibles; nunca clases ni ficheros. Es lo que les permite sobrevivir a un refactor.
- **Los delta-specs**, en `specs/changes/<slug>/`: una propuesta de cambio sobre la spec viva, con sus requisitos marcados `ADDED`, `MODIFIED` o `REMOVED`. Un `MODIFIED` reescribe el requisito **entero**, con todos sus escenarios. Al cerrar el change, el delta se fusiona en la spec viva y la carpeta se archiva en `specs/changes/archive/`.
- **El backlog** (`docs/backlog/`) dice qué se quiere; la spec dice qué hace el sistema. Son cosas distintas: el backlog contiene historias que no tienen ni un requisito en la spec, y la spec resuelve contradicciones que la historia dejaba abiertas.

## Con OpenSpec o sin él

Este harness funciona con [OpenSpec](https://github.com/Fission-AI/OpenSpec) (`openspec init` eligiendo Claude Code crea `openspec/`, y entonces esta carpeta pasa a ser `openspec/specs/`) o a mano con la misma estructura. Si usas OpenSpec, fija su versión en CI (`npm install -g @fission-ai/openspec@X.Y.Z`) y añade a `verificacion.yml` un paso `openspec validate --specs`.

El flujo, y el orden importa:

| Paso | Qué produce |
|---|---|
| Proponer | `proposal.md` (qué y por qué), `specs/<capability>/spec.md` (el delta), `design.md` (cómo), `tasks.md` (pasos) |
| **Gate humano** | Revisar los cuatro artefactos **antes** de que exista una línea de código. Esto es el trabajo, no un trámite |
| Aplicar | El código, acotado por grupos de tareas. Backend primero y frontend después, revisando en medio |
| Archivar | Fusiona el delta contra la spec viva |

**Cuándo no usarlo**: escribir la spec de algo que ya existe es un antipatrón declarado. Es legítimo para poner al día una spec atrasada, pero invierte el orden: la spec deja de dirigir el trabajo y pasa a describirlo.

**Un change no se archiva con casillas mudas**: si `tasks.md` queda con trabajo sin hacer, el propio fichero dice cuál y qué costó, en una sección «Lo que no se ejecutó» con filas de verdad. Una casilla vacía en un archivo es indistinguible de una que nadie tuvo que hacer.

## Plantilla de spec

```markdown
# nombre-de-la-capability Specification

## Purpose
Para qué existe esta capability, en dos frases y en lenguaje de producto.

## Requirements

### Requirement: Título en lenguaje de producto

El sistema SHALL ... cuando ..., y SHALL devolver .... NO SHALL ....

#### Scenario: Caso concreto

- **WHEN** se envía `POST /api/v1/...` con `{...}` y un token válido
- **THEN** la respuesta es `201` con `{"data": {...}}`

#### Scenario: El caso que no debe ocurrir

- **WHEN** ...
- **THEN** la respuesta es `422` con un error sobre el campo `...`, y no se crea nada
```

Los escenarios se escriben para poder leerse como casos de prueba: son la unidad que se cita al escribir un test.
