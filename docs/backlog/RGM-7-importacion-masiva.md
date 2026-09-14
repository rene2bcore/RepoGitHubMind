# RGM-7 · S1 · Importación masiva desde texto pegado o archivo `.txt`

**Identificador:** `RGM-7` · [en Jira](https://ai4devs.atlassian.net/browse/RGM-7)
**Épica:** RGM-1
**Traza:** RF-9 del [PRD](../prd.md) · Prompt maestro §6, §7, §42
**Prioridad:** should-have · **Entrega:** final si cabe (`PA-5`) · **Spec:** [`specs/repositories`](../specs/repositories/spec.md), requisito «Importación masiva»

## Historia

> Como persona con cientos de URLs en chats de WhatsApp y notas, quiero pegar un texto largo o subir un export `.txt` y que se extraigan todas las URLs de GitHub, para importarlas de golpe sin pegarlas una a una.

## Criterios de aceptación

**CA-1 · Preview antes de importar**
DADO un texto o un `.txt` con URLs de GitHub
CUANDO lo proceso
ENTONCES veo «Encontramos N · Nuevos · Ya guardados · Inválidos» y no se importa nada hasta confirmar.

**CA-2 · Importar en cola**
DADO el preview confirmado
CUANDO importo
ENTONCES se encolan solo los nuevos, sin cientos de peticiones a GitHub a la vez, y veo el progreso; cerrar la pantalla no los cancela.

**CA-3 · Archivo seguro**
DADO un archivo que no es `.txt`, supera el límite o tiene otro MIME
CUANDO lo subo
ENTONCES se rechaza; el contenido nunca se ejecuta ni se renderiza como HTML, y el archivo no se conserva.

**CA-4 · Deduplicado**
DADO un texto con la misma URL en tres variantes
CUANDO se procesa
ENTONCES cuenta como un solo repositorio.

## Fuera de alcance

- Integración directa con WhatsApp, Share Target (R2).

## Tickets

Se descompone si entra en la Entrega final. Depende de la cola de H2.
