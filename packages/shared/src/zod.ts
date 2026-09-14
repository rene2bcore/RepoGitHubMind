import { z } from 'zod'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'

// Antes de construir ningún esquema: en Zod 4 los métodos se añaden al crear
// cada instancia, así que la extensión tiene que existir cuando se crean.
extendZodWithOpenApi(z)

// Los mensajes por defecto en castellano, para todo esquema del paquete que
// no traiga mensaje propio: los de la API y los de las variables de entorno.
z.config(z.locales.es())

export { z }
