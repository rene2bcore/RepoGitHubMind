# ADR-0002 · La documentación se verifica contra el código, no se regenera desde él

## Estado

Aceptada · 2026-09-14

## Contexto

Hay dos formas de que la documentación no mienta: regenerarla desde el código en cada build, o escribirla a mano y contrastarla. Un generador produce documentos que quedan bien aunque el código haga otra cosa, porque documentan lo que el código hace y no lo que debería hacer. Ninguno de los defectos de dominio del proyecto de origen del harness se habría notado en un documento generado.

Y el contraste tiene su propio modo de fallo: en ese proyecto, la primera versión del verificador dio luz verde mientras tres documentos afirmaban comportamientos que la API no tenía. Comprobaba lo fácil. Un contraste flojo es peor que ninguno porque da una garantía que no existe.

## Decisión

**La documentación de producto y arquitectura se escribe a mano y se comprueba automáticamente.** `scripts/verificar-docs.mjs` corre en CI y falla la build cuando un documento y el código dejan de decir lo mismo.

**Toda comprobación que se añada se demuestra mutando el código y viendo que falla.** Una comprobación que no se ha visto fallar no cuenta, y se registra en `scripts/mutaciones.mjs`, que lo ejecuta en cada push.

Las comprobaciones leen el código **sin comentarios**: una comprobación que un comentario puede satisfacer no comprueba nada.

## Alternativas consideradas

**Generar y servir toda la documentación.** Se hace con el contrato ([ADR-0001](0001-el-contrato-se-genera-se-versiona-y-se-vigila-la-deriva.md)), donde un generador hace mejor la forma de las rutas. Para lo demás no: un generador no puede afirmar que toda query de `UserRepository` filtre por sesión ni que el manejador de errores no devuelva el mensaje de la excepción.

**No documentar y confiar en las specs y las pruebas.** Las specs describen comportamiento observable; la arquitectura, el modelo de datos, la taxonomía y los runbooks son otra capa que quien llega necesita, y la que LIDR pide en el readme.

## Consecuencias

El documento hay que actualizarlo a mano cuando cambia el código, y el verificador solo avisa de lo que sabe comprobar. Es trabajo humano recurrente, y ese es el precio. Ninguna comprobación sabe si un documento sigue siendo útil: solo si coincide con el código. Eso es R-13, y no se puede comprobar.

## Cómo se comprobó

Las diez comprobaciones genéricas del harness se vieron fallar en el proyecto de origen y cuatro de ellas se volvieron a mutar a mano al adaptar el harness el 2026-09-13 (pipefail, fila corta en trazabilidad, hallazgo sin reproducción, secreto en `.env.example`). Aquí, tres están en el catálogo desde el primer push: `R-06`, `rutas-documentadas` y `ruta-protegida-publica`. Las específicas de este producto se añaden con cada historia y se ven fallar antes de commitearse.
