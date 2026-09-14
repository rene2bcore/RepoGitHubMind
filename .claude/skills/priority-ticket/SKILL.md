---
name: priority-ticket
description: Trae el ticket de mayor prioridad asignado al usuario logeado en Jira (vía MCP) y arranca el trabajo sobre él. Usar al empezar una tarea nueva.
---
# Priority ticket

Proyecto de Jira: `RGM`.

1. Consulta Jira vía MCP: busca los tickets del proyecto asignados al usuario actual **en estado «Por hacer»**, ordénalos por prioridad y toma el de mayor prioridad. No consideres tickets ya en «En curso» o «En revisión»: evita re-tomar uno que ya está en marcha o cerrado.
2. Resume sus criterios de aceptación. Si no tiene, para: un ticket sin criterio de aceptación no se delega ni se implementa; se devuelve a quien lo escribió.
3. Localiza su fila en `docs/traceability.md`. Si no está, añádela con lo que se sabe y las columnas de prueba y código en blanco.
4. Entra en plan mode y propón cómo implementarlo siguiendo `CLAUDE.md`: spec o delta-spec, pruebas necesarias, ficheros a modificar.
5. En cuanto el usuario apruebe el plan: mueve el ticket a «En curso» y crea la rama `feat/<CLAVE-N>-<slug>` desde `main`.
6. Al terminar, con el PR ya creado siguiendo las reglas de `CLAUDE.md`: mueve el ticket a «En revisión» y deja un comentario en el ticket con el enlace al PR.
