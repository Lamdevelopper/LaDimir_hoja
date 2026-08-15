# Arquitectura de LaDimir Hoja

## Objetivo

Aplicación web estática, ligera y sin backend para dibujar sobre hoja milimétrica.
Debe poder abrirse desde GitHub Pages o con un servidor HTTP local sencillo.

## Stack

- HTML semántico y CSS responsivo.
- JavaScript moderno mediante módulos ES, sin framework ni dependencias de ejecución.
- Canvas 2D para renderizar la hoja, la cuadrícula, puntos y rectas.
- File API del navegador para importar y exportar JSON/TXT.
- Pruebas unitarias con `node:test`; Node solo es una herramienta de desarrollo.

## Módulos y contratos

- `src/model.js`: estado canónico, validación de tamaños/coordenadas y operaciones
  de puntos y rectas.
- `src/serialization.js`: formato JSON versionado y formato TXT legible. Ambos
  deben reconstruir el mismo documento validado.
- `src/viewport.js`: conversión entre centímetros del documento y píxeles,
  paneo y zoom anclado al cursor.
- `src/renderer.js`: dibujo Canvas con fondo blanco, milímetros grises tenues,
  centímetros grises marcados, puntos y trazos.
- `src/app.js`: única capa que toca el DOM; herramientas, formularios,
  accesibilidad, descargas y apertura de archivos.
- `index.html` y `styles.css`: estructura y presentación.

Los módulos no deben depender de variables globales. Las coordenadas se guardan
en centímetros como números; el render puede redondear a milímetros. El origen
del documento es la esquina inferior izquierda, con X hacia la derecha e Y hacia
arriba. El tamaño permitido es de 1 a 500 cm por eje.

## Documento persistido

```json
{
  "format": "ladimir-hoja",
  "version": 1,
  "sheet": { "widthCm": 21, "heightCm": 29.7, "name": "Mi hoja" },
  "points": [{ "id": "p1", "x": 2, "y": 3, "label": "A" }],
  "lines": [{ "id": "l1", "kind": "line", "from": "p1", "to": "p2" }]
}
```

TXT usa encabezados simples (`LADIMIR_HOJA 1`, `SHEET`, `POINT`, `LINE`, `FIT`) con
campos separados por tabuladores. Nombres y etiquetas se codifican como cadenas
JSON para evitar ambigüedad.

### Tipos de trazo

- `segment`: une únicamente los dos puntos referenciados por `from` y `to`.
- `line`: recta infinita definida por `from` y `to`, recortada visualmente al
  borde de la hoja. Es el modo predeterminado para trazos nuevos.
- `best-fit`: recta experimental calculada por mínimos cuadrados con todos los
  puntos disponibles. Guarda `pointIds` y `equation`; la ecuación usa
  `{ "axis": "y", "slope": m, "intercept": b }` o, si todos los valores X
  coinciden, `{ "axis": "x", "constant": x }`.

Para compatibilidad, un trazo antiguo sin `kind` se interpreta como `segment`.
La regresión con intercepto minimiza la suma de residuos cuadrados y hace que
la suma algebraica de distancias verticales sea cero: quedan puntos arriba y
abajo de la recta siguiendo el protocolo experimental habitual.

## Interacción

- Crear hoja: diálogo inicial con nombre, ancho y alto en centímetros.
- Navegar: rueda para zoom centrado bajo el cursor; arrastre con botón central,
  espacio o herramienta Mover para paneo fluido.
- Punto: clic en la hoja o formulario X/Y; ajuste opcional al milímetro.
- Recta/segmento: seleccionar el modo y después dos puntos existentes. Recta es
  el modo inicial.
- Recta automática: con dos o más puntos, calcula y guarda el mejor ajuste
  lineal usando todos los puntos actuales.
- Indicador: coordenadas del cursor siempre visibles en una esquina.
- Persistencia: descargar `.json` o `.txt` y abrir ambos formatos.

## Rendimiento y límites

El render usa `requestAnimationFrame`, limita el zoom y solo dibuja líneas de
cuadrícula visibles. No se almacena imagen de fondo. El tamaño lógico de la hoja
es independiente del tamaño del canvas y de la densidad de píxeles del equipo.

## Criterios de aceptación

1. Paneo y zoom permanecen fluidos en una hoja de 500 x 500 cm.
2. La cuadrícula muestra cada milímetro y enfatiza cada centímetro.
3. Puntos por clic y por coordenadas quedan dentro de la hoja.
4. Segmento une exactamente dos puntos; recta se extiende a los bordes.
5. Recta automática calcula un ajuste reproducible, incluido el caso vertical.
6. JSON y TXT hacen round-trip sin perder tamaño, puntos ni trazos.
7. La interfaz funciona con mouse, teclado y pantallas pequeñas.
8. GitHub Pages sirve e importa archivos mediante File API, sin backend.
