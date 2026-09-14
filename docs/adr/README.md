# Decisiones de arquitectura

Un ADR por decisión significativa, con contexto, alternativas descartadas, decisión, estado y consecuencias. `scripts/verificar-docs.mjs` exige las cinco secciones. Breves, como pide el prompt maestro §65.

**Un ADR no se edita cuando la decisión cambia**: se crea uno nuevo que lo reemplaza, y el viejo cambia su estado a «Reemplazado por». Sí se edita para registrar una consecuencia descubierta al aplicarlo, con fecha.

Los ADR 0001 a 0005 vienen del Harness-LDIR: registran decisiones que el proyecto de origen tomó después de pagar su ausencia, adaptadas a este stack. Los 0006 a 0011 son las del prompt maestro. El 0012 es de este proyecto.

| # | Decisión | Estado |
|---|---|---|
| [0000](0000-plantilla.md) | Plantilla | - |
| [0001](0001-el-contrato-se-genera-se-versiona-y-se-vigila-la-deriva.md) | El contrato se genera desde Zod, se versiona, y lo que se vigila es la deriva | Aceptada |
| [0002](0002-la-documentacion-se-verifica-no-se-regenera.md) | La documentación se verifica contra el código, no se regenera desde él | Aceptada |
| [0003](0003-aislamiento-de-la-base-de-datos-en-pruebas.md) | Aislamiento de la base de datos en las pruebas | Aceptada |
| [0004](0004-el-volcado-de-depuracion-va-apagado.md) | El volcado de depuración va apagado, salvo que alguien lo encienda | Aceptada |
| [0005](0005-validar-antes-de-resolver.md) | La petición se valida antes de resolver el identificador | Aceptada |
| [0006](0006-monolito-modular.md) | Monolito modular en Next.js con un worker aparte | Aceptada |
| [0007](0007-postgresql-y-pgvector.md) | PostgreSQL + pgvector como única infraestructura de datos | Aceptada |
| [0008](0008-repository-global-y-userrepository-privada.md) | `Repository` global y `UserRepository` privada | Aceptada |
| [0009](0009-proveedor-de-ia-reemplazable.md) | Proveedor de IA reemplazable y análisis cacheado por repositorio | Aceptada |
| [0010](0010-cola-de-trabajos-en-postgresql.md) | Cola de trabajos en PostgreSQL, sin Redis | Aceptada |
| [0011](0011-licencia-apache-2.md) | Apache-2.0 con copyright de 2BCORE y marca separada | Aceptada |
| [0012](0012-dos-repositorios-y-subtree.md) | Dos repositorios: el producto como fuente de verdad y el fork académico con `git subtree` | Aceptada |
