# AGENTS.md

Las instrucciones de este repositorio viven en **[`CLAUDE.md`](CLAUDE.md)**, en la raíz. Ábrelo: ahí están los comandos, la arquitectura y las reglas de proceso.

---

Este fichero es un puntero escrito, **no un symlink**, a propósito. Un symlink en el índice de git (modo `120000`) solo se materializa donde el sistema lo permite: en Windows, con `core.symlinks=false`, git escribe un fichero de texto de nueve bytes cuyo contenido es la cadena `CLAUDE.md`, y quien lo abre no encuentra ni las instrucciones ni un aviso.

Un puntero escrito funciona en todos los sitios y no puede desincronizarse, porque no duplica ni una línea. `scripts/verificar-docs.mjs` comprueba que sigue siendo texto y que sigue apuntando a `CLAUDE.md`.
