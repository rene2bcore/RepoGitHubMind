# ADR-0012 · Dos repositorios: el producto como fuente de verdad y el fork académico con `git subtree`

## Estado

Aceptada · 2026-09-14

## Contexto

LIDR exige hacer fork de `LIDR-academy/AI4Devs-finalproject`, trabajar en ramas `feature/entrega-1-RLL`, `feature/entrega-2-RLL` y `final-project-RLL`, y completar su `readme.md` y `prompts.md` sin borrar campos. El prompt maestro exige que el producto viva primero en un repositorio de 2BCORE, como fuente de verdad, y que el fork se use solo para las entregas (§60 a §63), sin `force push`, sin borrar ramas y sin tocar `upstream`.

La plantilla de LIDR trae únicamente `readme.md` (en minúsculas) y `prompts.md`. Y **en Windows `README.md` y `readme.md` son el mismo fichero**: se comprobó el 2026-09-14 creando los dos en un directorio y viendo que el segundo pisaba al primero. Un merge de historias entre el producto (que tiene `README.md`) y el fork (que tiene `readme.md`) destruiría el de LIDR en cualquier clon en Windows.

La organización `2BCORE` no existe en GitHub (solo `2BCORE-Internal`, que no es sitio para open source), así que el propietario es `rene2bcore`.

## Decisión

**`rene2bcore/RepoGitHubMind` es la fuente de verdad, donde corre el harness entero. El fork `rene2bcore/AI4Devs-finalproject` recibe el producto bajo `producto/` con `git subtree`:**

```bash
# en el fork, rama de entrega
git remote add producto https://github.com/rene2bcore/RepoGitHubMind.git
git fetch producto
git subtree add  --prefix=producto producto main     # primera entrega
git subtree pull --prefix=producto producto main     # entregas siguientes
```

La raíz del fork queda con los dos ficheros de LIDR y nada más. El `readme.md` de LIDR se rellena sección a sección desde `producto/docs/`, con enlaces al detalle, y su sección 0.5 apunta al repositorio del producto. CI y el revisor corren en el producto; el PR del fork enlaza esa evidencia. La historia del producto viaja entera al fork (sin `--squash`), para que el PR muestre los commits.

## Alternativas consideradas

**`git merge --allow-unrelated-histories` del producto en la rama de entrega.** Es lo que se había escrito primero. Descartado al comprobar la colisión `README.md` / `readme.md` en Windows.

**Copiar el árbol sin historia.** Pierde los commits, que son parte de lo que LIDR evalúa (sección 7 del readme).

**Desarrollar solo en el fork.** Contradice la propiedad y la continuidad del producto (§62).

## Consecuencias

Cada entrega son dos operaciones: fusionar en `main` del producto y `subtree pull` en la rama de entrega del fork. `subtree pull` puede dar conflictos si alguien tocó `producto/` en el fork: no se toca; los cambios van siempre al producto. El fork no ejecuta CI: su verificación es la del producto, enlazada.

## Cómo se comprobó

La colisión de nombres, con un `mktemp` en Git Bash el 2026-09-14: `echo a > readme.md; echo b > README.md; cat readme.md` imprime `b`. Que `git subtree` está disponible en Git for Windows 2.53: `git subtree -h` responde con su uso. El primer `subtree add` real se hace en la Entrega 1 y se anota aquí con fecha.
