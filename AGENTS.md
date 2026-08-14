# Guía para agentes

Este repositorio implementa una hoja milimétrica digital como aplicación web
estática. Antes de cambiar contratos o coordenadas, consulta `ARCHITECTURE.md`.

- Conserva el stack sin framework y sin dependencias de ejecución.
- Usa módulos ES y evita estado global o valores de dimensiones hard-coded.
- El modelo guarda coordenadas en cm y usa origen inferior izquierdo.
- Mantén JSON versionado y TXT compatible; añade pruebas para todo cambio de formato.
- El render debe invalidarse con `requestAnimationFrame`, no ejecutar bucles continuos.
- Actualiza este archivo o el `AGENTS.md` más cercano al añadir una sección relevante.
- Ejecuta `npm test` y una prueba manual en navegador antes de declarar terminado.

La implementación inicial está completa. `src/AGENTS.md` es la referencia local
para contratos de modelo, serialización, viewport y render; la integración DOM
vive en `src/app.js`. El flujo validado en navegador cubre crear hoja, añadir dos
puntos, unirlos, descargar JSON/TXT y volver a abrir JSON.

## Propiedad durante la implementación inicial

- Modelo y persistencia: `src/model.js`, `src/serialization.js`, `test/model.test.js`,
  `test/serialization.test.js`.
- Vista gráfica: `src/viewport.js`, `src/renderer.js`, pruebas correspondientes.
- Integración y experiencia: `index.html`, `styles.css`, `src/app.js`, `README.md`,
  `package.json`.
