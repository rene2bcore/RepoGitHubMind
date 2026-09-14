---
name: commit
description: Genera un commit convencional a partir de los cambios staged. Usar al cerrar cada petición.
---

# Commit convencional

1. Comprueba la rama: `git branch --show-current`. Si es `main`, para y crea una rama de trabajo (`git switch -c feat/<slug>`); el hook la rechazaría igual.
2. Ejecuta `git diff --staged` y resume el cambio. Si no hay nada staged, añade **por nombre** (`git add <fichero>`) lo que corresponde a la petición que se cierra, nunca `git add -A` ni `git add .`.
3. Redacta un asunto `tipo(ámbito): qué` (feat, fix, docs, chore, refactor, test, ci, build, perf, style, revert). Si es un `fix:` y no toca ninguna prueba, o añades la prueba o el cuerpo lleva una línea `Sin-prueba: <motivo>`; lo exige CI.
4. Commitea con ese mensaje. Nunca `--no-verify`.
