import { config } from 'dotenv'

// Cada worker de Vitest es un proceso: el entorno de pruebas se carga también
// aquí, con `override`, por lo mismo que en el global setup.
config({ path: '.env.test', override: true })
