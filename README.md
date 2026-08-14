# LaDimir Hoja

Hoja milimétrica digital para practicar geometría, colocar puntos y unirlos con segmentos. Funciona en el navegador, sin cuenta, backend ni proceso de compilación.

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
- **Recta**: selecciona dos puntos existentes para crear un segmento. `Esc` cancela la selección.
- La esquina superior derecha muestra las coordenadas del cursor en centímetros (origen en la esquina inferior izquierda).
- Atajos: `M` mover, `P` punto y `R` recta.

## Guardar y abrir

`Guardar JSON` conserva un documento versionado y `Guardar TXT` genera un formato legible. `Abrir` acepta ambos formatos y reconstruye la hoja, puntos y segmentos. Los archivos se guardan en la carpeta de descargas del navegador.

## Desarrollo

No hay dependencias de ejecución. Para correr las pruebas unitarias:

```bash
npm test
```

La aplicación usa módulos ES en `src/`, Canvas 2D y `requestAnimationFrame` para invalidar el render. Consulta [ARCHITECTURE.md](ARCHITECTURE.md) antes de cambiar contratos de coordenadas o formatos.
