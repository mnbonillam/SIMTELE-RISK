# Verificación

- `npm test` ejecuta ocho pruebas de Node, incluidas las referencias del PDF, cuadratura, error con referencia cero y guardado/recuperación con una implementación de IndexedDB para pruebas.
- `npm run build` compila y empaqueta el Web Worker, los activos gráficos y las fuentes locales. Vite informa que la entrada supera su umbral orientativo de 500 kB sin compresión, debido principalmente al renderizador Three.js. jsPDF se carga al solicitar la exportación.
- La versión compilada se verificó en Chromium con WebGL por software. Se probaron los seis modos, el cruce de la barrera en estrés, la inspección de deterioro, la resonancia y las integrales, la edición de muestras con puntero y teclado, Runge, los recuentos de la carrera, el control de ε, las descargas PDF/CSV y la búsqueda, comparación y recuperación del historial después de recargar. Se comprobó el layout de escritorio y un viewport móvil de 390 px.
- El objetivo de 60 fps queda pendiente de medición con GPU y teléfonos físicos. Se incluyeron límites de densidad de píxeles, instancias, reducción de partículas y suspensión del redibujado al estabilizarse.
