-- Custom SQL migration file, put your code below! --
-- H5 · RGM-6. Migración personalizada (`drizzle-kit generate --custom`): Drizzle
-- no genera `CREATE EXTENSION`, y la columna `vector(1536)` de la migración
-- siguiente no existe sin ella. La imagen `pgvector/pgvector:pg16` trae la
-- extensión instalada; aquí solo se habilita en la base, que es lo que un
-- volumen de producción ya creado no tiene.
CREATE EXTENSION IF NOT EXISTS vector;
