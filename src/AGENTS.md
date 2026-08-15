# Vista gráfica

`viewport.js` contiene la transformación reversible entre centímetros con
origen inferior izquierdo y píxeles CSS, además de paneo, zoom anclado y
cálculo del rectángulo visible. `renderer.js` dibuja la hoja blanca, la
cuadrícula milimétrica gris (centímetros enfatizados), puntos, segmentos,
rectas infinitas y ajustes lineales en Canvas.

Los colores de trazo forman parte del contrato visual: `line` azul, `segment`
verde y `best-fit` magenta. `renderScene` permite sobrescribirlos mediante
`options.colors`, y la leyenda de `index.html` debe mantenerse sincronizada.

`app.js` implementa `delete-line` como herramienta de un solo borrado: detecta
trazos a 14 px, prioriza el más reciente cuando se superponen, llama
`model.removeLine()` y vuelve a Mover. Cualquier nuevo tipo de trazo debe añadir
su geometría tanto al renderer como a `strokeDistance()` para poder borrarse.

La vista no conserva estado global. Los cambios visuales se solicitan mediante
`createRenderer().invalidate()` para agruparse en un solo `requestAnimationFrame`.
El modelo sigue siendo responsabilidad de `src/model.js` y sus coordenadas no
se transforman al guardar.

## Modelo y persistencia

`model.js` conserva el documento canónico en centímetros y muta sus arreglos al
añadir o eliminar elementos; `addPoint`, `addLine` y `addBestFitLine` devuelven
el objeto creado. Los identificadores automáticos usan los prefijos `p` y `l`.
Los trazos manuales referencian dos puntos; los `best-fit` guardan ecuación y
`pointIds`. Eliminar un punto elimina cualquier trazo que dependa de él.

`serialization.js` valida antes de leer o escribir. JSON usa `format` igual a
`ladimir-hoja` y `version` 1. TXT comienza con `LADIMIR_HOJA 1` y admite `LINE`
y `FIT`; nombres, etiquetas, ecuaciones e IDs agrupados usan JSON cuando hace
falta. Un `LINE` antiguo de cuatro campos se normaliza como `segment`.
