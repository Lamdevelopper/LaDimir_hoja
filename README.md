# LaDimir Hoja

Hoja milimétrica digital de fondo blanco para colocar puntos, trazar rectas,
segmentos y ajustes experimentales. Funciona en el navegador, sin cuenta,
backend ni proceso de compilación.

## Usarla sin conocimientos técnicos

1. Descarga el repositorio desde GitHub con **Code → Download ZIP** y descomprímelo.
2. Abre `index.html` con un navegador moderno. Si el navegador bloquea módulos al abrir archivos, inicia un servidor local sencillo:

   ```bash
   python -m http.server 8000
   ```

   Después visita <http://localhost:8000>.

3. Al abrirse, elige nombre, ancho y alto de la hoja (entre 1 y 500 cm).

También puede publicarse directamente en GitHub Pages: selecciona la rama y la carpeta raíz del repositorio. No hay build ni variables de entorno.

## Controles

- **Mover**: arrastra para desplazar la vista. La rueda hace zoom centrado en el cursor; también puedes usar el botón central o `Shift` mientras arrastras.
- **Punto**: selecciona la herramienta y haz clic en la hoja. El formulario permite escribir X/Y en centímetros. El ajuste a milímetros está activado por defecto.
- **Recta**: selecciona el modo `Recta (infinita)` o `Segmento` y después dos puntos existentes. La recta se recorta visualmente a los bordes de la hoja; el segmento une únicamente los puntos. `Esc` cancela la selección.
- **Recta automática**: calcula una regresión lineal experimental con todos los puntos actuales. Requiere al menos dos puntos y conserva la ecuación en el documento.
- **Borrar recta**: activa el botón y haz clic cerca de un trazo para eliminarlo; se detectan rectas, segmentos y rectas automáticas. Tras borrar, vuelve a Mover. Atajo: `D`.
- Los colores distinguen cada resultado: azul para rectas infinitas, verde para
  segmentos y magenta para la recta automática. La interfaz incluye una leyenda.
- La esquina superior derecha muestra las coordenadas del cursor en centímetros (origen en la esquina inferior izquierda).
- Atajos: `M` mover, `P` punto y `R` recta.

## Guardar y abrir

`Guardar JSON` conserva un documento versionado y `Guardar TXT` genera un formato legible. `Importar hoja` acepta ambos formatos mediante la File API del navegador y reconstruye la hoja, puntos y trazos sin subir datos a ningún servidor. Los archivos se guardan en la carpeta de descargas del navegador.

La aplicación puede publicarse directamente en GitHub Pages: selecciona la rama y la carpeta raíz del repositorio. Las rutas son relativas y no requieren backend, build ni variables de entorno; la importación funciona desde la página publicada.

## Desarrollo

No hay dependencias de ejecución. Para correr las pruebas unitarias:

```bash
npm test
```

La aplicación usa módulos ES en `src/`, Canvas 2D y `requestAnimationFrame` para invalidar el render. Consulta [ARCHITECTURE.md](ARCHITECTURE.md) antes de cambiar contratos de coordenadas o formatos.
