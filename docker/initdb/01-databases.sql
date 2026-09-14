-- Se ejecuta una sola vez, al crear el volumen. La base de desarrollo la crea
-- POSTGRES_DB; aquí va la de pruebas, con la extensión que las migraciones
-- esperan poder habilitar.
CREATE DATABASE repogithubmind_test;
