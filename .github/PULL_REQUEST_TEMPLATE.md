## Qué cambia

<!-- La unidad de trabajo entera, no la última petición. Qué puede hacer ahora una persona que antes no podía, o qué deja de pasar. Ticket o historia: RGM-N -->

## Estado a <fecha>

<!-- Qué está hecho y verificado, qué queda abierto. Sin adjetivos: cifras, comandos y ejecuciones de CI. -->

## Cómo se verificó

<!-- Qué se ejecutó y qué salió. Si algo se vio fallar a propósito antes de arreglarlo, decirlo: es la parte que vale. -->

- [ ] Lint, formato, tipos y pruebas en verde en CI
- [ ] Contrato regenerado si cambió una ruta, y su comparación en verde
- [ ] Si hay un `fix:`, deja una prueba o lleva `Sin-prueba: <motivo>`
- [ ] Si cambió el comportamiento, la spec de `docs/specs/` lo dice
- [ ] Si se añadió una comprobación, tiene su entrada en `scripts/mutaciones.mjs` y se la ha visto morder
- [ ] `docs/traceability.md` al día para lo que este PR toca

## Hallazgos nuevos

<!-- Los que se registraron en docs/hallazgos.md durante esta unidad, con su estado. Si ninguno, decir "ninguno". -->

## Lo que este PR NO arregla

<!-- Obligatoria. Lo que queda abierto a sabiendas, con su motivo. Un PR sin esta sección promete más de lo que entrega. -->
