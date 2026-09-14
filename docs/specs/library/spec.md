# library Specification

## Purpose

Da a cada persona su biblioteca: la lista de lo que guardó, con su estado, favorito, rating y notas, que solo ella ve. Es la capability que responde «¿qué tengo, y en qué quedé con cada cosa?».

Historia: H3 · RGM-4.

## Requirements

### Requirement: Lo mío no lo ve nadie

El sistema SHALL devolver en `GET /api/v1/repositories` únicamente las relaciones privadas de la cuenta con sesión, y NO SHALL exponer en ninguna respuesta el estado, favorito, rating, notas, tags ni colecciones de otra cuenta. Toda consulta o modificación de una relación privada por su id SHALL responder `404` cuando la relación pertenezca a otra cuenta, indistinguible de cuando no existe.

#### Scenario: Dos cuentas, el mismo repositorio

- **WHEN** Ada y Grace guardaron `pgvector/pgvector`, Ada lo marcó `USING` con una nota, y Grace pide su biblioteca o el detalle
- **THEN** Grace ve el repositorio con su propio estado `NEW` y sin ninguna nota, y en ningún campo aparece nada de Ada

#### Scenario: Id de otra cuenta

- **WHEN** Grace pide `GET /api/v1/repositories/{id}` o `PATCH .../personal` con el id de la relación de Ada
- **THEN** la respuesta es `404` con la misma forma que para un id que no existe, y nada cambia

#### Scenario: La identidad sale de la sesión

- **WHEN** una petición con sesión de Grace incluye un `userId` de Ada
- **THEN** se ignora y la respuesta es la de Grace

### Requirement: Estado personal con nueve valores fijos

El sistema SHALL mantener cada relación privada en exactamente uno de `NEW`, `TO_REVIEW`, `REVIEWED`, `TESTING`, `INSTALLED`, `USING`, `FAVORITE`, `REJECTED`, `ARCHIVED`, con `NEW` al guardar, y SHALL rechazar con `422` sobre `status` cualquier otro valor. `favorite` SHALL ser un booleano aparte para no acoplarlo al estado.

#### Scenario: Cambio de estado

- **WHEN** se envía `PATCH /api/v1/repositories/{id}/personal` con `{"status": "REVIEWED"}`
- **THEN** la respuesta es `200` con la relación releída de la base, con `status` `REVIEWED` y `reviewedAt` fijado

#### Scenario: Estado inventado

- **WHEN** se envía `{"status": "DONE"}`
- **THEN** la respuesta es `422` sobre `status`, y el estado no cambia

#### Scenario: Favorito y estado independientes

- **WHEN** se marca `favorite: true` sobre una relación en `USING`
- **THEN** sigue en `USING` y además es favorita

### Requirement: Rating y notas

El sistema SHALL admitir un rating entero de 1 a 5 o nulo, y notas de hasta 4000 caracteres o nulas, y SHALL rechazar con `422` los valores fuera de rango. Se SHALL validar el cuerpo antes de resolver el id.

#### Scenario: Rating fuera de rango

- **WHEN** se envía `{"rating": 6}` sobre un id que no existe
- **THEN** la respuesta es `422` sobre `rating`, no `404`

#### Scenario: Quitar una nota

- **WHEN** se envía `{"notes": null}`
- **THEN** la nota desaparece y la respuesta es `200`

#### Scenario: Cuerpo vacío

- **WHEN** se envía `{}`
- **THEN** la respuesta es `422`: no hay nada que cambiar

### Requirement: Lista con orden y filtros

El sistema SHALL devolver la biblioteca paginada, ordenable por `savedAt`, `pushedAt`, `stars`, `name` o `rating`, y filtrable por estado, favorito, lenguaje, licencia, categoría y estrellas mínimas. Un valor de orden o de filtro fuera del dominio SHALL rechazarse con `422`, no ignorarse.

#### Scenario: Filtro por estado

- **WHEN** se solicita `GET /api/v1/repositories?status=USING`
- **THEN** llegan solo las relaciones en `USING`, con `meta.total` correcto

#### Scenario: Orden inventado

- **WHEN** se solicita `?sort=color`
- **THEN** la respuesta es `422` sobre `sort`

#### Scenario: Biblioteca vacía

- **WHEN** una cuenta nueva pide su biblioteca
- **THEN** la respuesta es `200` con `data` vacío y `meta.total` 0, no un error

### Requirement: Pantalla de la biblioteca

La interfaz SHALL mostrar la biblioteca como cuadrícula o lista de tarjetas compactas con, en este orden de prioridad visual: nombre, resumen o descripción, estrellas, licencia, lenguaje, categorías, última actividad y estado personal. La licencia SHALL aparecer junto a las métricas principales cuando GitHub la identifique. El estado y el favorito SHALL cambiarse desde la propia tarjeta sin abrir el detalle, con la interfaz reflejando el cambio al momento y volviendo al valor real si el servidor lo rechaza.

#### Scenario: Tarjeta compacta

- **WHEN** se abre la biblioteca
- **THEN** cada tarjeta muestra `owner / name`, `⭐ 19.4k · MIT · PostgreSQL`, el resumen, las categorías, «Actualizado hace 2 días» y el estado

#### Scenario: Cambio desde la tarjeta

- **WHEN** se cambia el estado desde la tarjeta
- **THEN** se refleja al momento sin recargar, y si el servidor responde error la tarjeta vuelve al estado real y avisa

#### Scenario: Biblioteca vacía con sesión nueva

- **WHEN** una cuenta nueva entra
- **THEN** ve qué es la biblioteca y un campo «Pega una URL de GitHub» como primera acción, no una lista vacía sin más

#### Scenario: Móvil

- **WHEN** se abre a 375 px de ancho
- **THEN** la navegación es inferior, las tarjetas ocupan el ancho, y guardar, cambiar estado y marcar favorito se hacen con controles táctiles

### Requirement: Detalle de un repositorio

La interfaz SHALL mostrar en `/repositories/{id}` cabecera, resumen, propósito, casos de uso, tecnología, instalación, métricas, actividad, licencia, mis datos personales editables, tags y, cuando exista, similares, de forma compacta. El README de GitHub SHALL renderizarse como Markdown saneado, sin `script`, `iframe` ni HTML crudo.

#### Scenario: README hostil

- **WHEN** el README contiene `<script>` o un `<iframe>`
- **THEN** no se ejecuta ni se incrusta nada; el resto del Markdown se ve
