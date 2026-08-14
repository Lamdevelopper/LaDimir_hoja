# Vista gráfica

`viewport.js` contiene la transformación reversible entre centímetros con
origen inferior izquierdo y píxeles CSS, además de paneo, zoom anclado y
cálculo del rectángulo visible. `renderer.js` dibuja la hoja naranja, la
cuadrícula milimétrica (centímetros enfatizados), puntos y segmentos en Canvas.

La vista no conserva estado global. Los cambios visuales se solicitan mediante
`createRenderer().invalidate()` para agruparse en un solo `requestAnimationFrame`.
El modelo sigue siendo responsabilidad de `src/model.js` y sus coordenadas no
se transforman al guardar.

## Modelo y persistencia

`model.js` conserva el documento canónico en centímetros y muta sus arreglos al
añadir o eliminar elementos; `addPoint` y `addLine` devuelven el objeto creado.
Los identificadores automáticos usan los prefijos `p` y `l`. Las rectas siempre
referencian dos puntos existentes y eliminar un punto elimina sus rectas.

`serialization.js` valida antes de leer o escribir. JSON usa `format` igual a
`ladimir-hoja` y `version` 1. TXT comienza con `LADIMIR_HOJA 1`; nombres y
etiquetas son cadenas JSON para conservar tabuladores y saltos de línea.
