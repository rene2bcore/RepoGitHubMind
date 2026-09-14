# ADR-0011 · Apache-2.0 con copyright de 2BCORE y marca separada

## Estado

Aceptada · 2026-09-14

## Contexto

RepoGitHubMind es open source desde el primer commit y a la vez un producto de 2BCORE que quiere seguir desarrollándose después del curso y, eventualmente, ofrecerse como servicio. Hace falta una licencia que permita el uso comercial, proteja la atribución, y no confunda el código con la marca (§59).

## Decisión

**Apache License 2.0**, íntegra en `LICENSE`, con `NOTICE` que dice `RepoGitHubMind · Copyright 2026 2BCORE` y `SPDX-License-Identifier: Apache-2.0` en las cabeceras donde corresponda. El README lleva una sección «Trademark and Branding» que dice que los nombres y logos «RepoGitHubMind» y «2BCORE» son marcas de 2BCORE y no se transfieren por la licencia del código, sujeto a revisión jurídica posterior.

Ninguna parte de la documentación afirma que Apache-2.0 impida comercializar: **lo permite**, y no se inventan restricciones incompatibles con la licencia.

## Alternativas consideradas

**MIT.** Más corta; sin cláusula de patentes ni de marca, que aquí interesan.

**AGPL-3.0.** Protege contra el uso como servicio sin contribuir, y ahuyenta a empresas que podrían adoptarlo; incompatible con la intención de adopción amplia del maestro.

**Propietaria.** Contradice «open source» del maestro.

## Consecuencias

Cualquiera puede usar, modificar y redistribuir el código, también comercialmente, manteniendo `LICENSE` y `NOTICE`. La marca queda fuera de esa concesión. Las contribuciones externas entran bajo la misma licencia (`CONTRIBUTING.md`).

## Cómo se comprobó

`LICENSE` es el texto oficial descargado de `apache.org/licenses/LICENSE-2.0.txt` el 2026-09-14, 202 líneas. `scripts/verificar-docs.mjs` comprueba que `README.md` enlaza `LICENSE` y `NOTICE` y que ambos existen.
