# SIMTELE-RISK

Laboratorio 3D de **Métodos Numéricos (DAT 242)**, carrera de Informática de la **UMSA**. El valle está inspirado en La Paz, Bolivia. Todos los parámetros y resultados son sintéticos y tienen fines educativos.

## GitHub Pages

[Abre SIMTELE-RISK en GitHub Pages](https://mnbonillam.github.io/SIMTELE-RISK/).

El flujo **Publicar SIMTELE-RISK en GitHub Pages** instala las dependencias, ejecuta las pruebas y publica `dist/` al actualizar `main`. También se puede ejecutar desde **Actions**. En un repositorio nuevo, activa **Settings → Pages → Source → GitHub Actions**.

## Ejecutar

Con Node.js 20+ y npm, extrae el ZIP y abre una terminal en la carpeta `SIMTELE-RISK`.

```sh
npm ci
npm run dev
```

Abre la URL que aparece en la terminal, normalmente [http://127.0.0.1:5173](http://127.0.0.1:5173). Se requiere WebGL 2 para el valle 3D. El gráfico numérico sigue disponible si el navegador no puede inicializar WebGL.

Para verificar y compilar:

```sh
npm test
npm run build
npm run preview
```

El directorio `dist/` del ZIP incluye la compilación lista para servir. Para usarla sin instalar Node.js, con Python 3 ejecuta `python -m http.server 8080 --directory dist` y abre [http://localhost:8080](http://localhost:8080). También se puede publicar el contenido de `dist/` en un alojamiento estático. Usa HTTP para que los módulos JavaScript, el Web Worker e IndexedDB funcionen correctamente. Conserva el mismo origen (host y puerto) para recuperar el mismo historial.

## Recorrido sugerido

1. En **Detención**, presiona **Frenar** y arrastra la barra de tiempo. Compara **NORMAL** con **ESTRÉS**. Con reacción cero obtendrás 62,50 m y 180,00 m de frenado.
2. En **Deterioro**, reproduce la curva hasta el umbral. Abre el selector de métodos para inspeccionar los iterados de bisección, secante y Newton-Raphson.
3. En **Viento**, activa el ajuste de resonancia y observa cómo cambia RK2 punto medio frente a RK4 y la referencia analítica. Selecciona Trapecio, Simpson o Romberg en el gráfico para reproducir el refinamiento de la integral.
4. En **Sensores**, arrastra los nodos o enfócalos con Tab y muévelos con las flechas. Cambia el ruido. Activa **Demostración de Runge** para comparar un polinomio global con el spline ante nodos equiespaciados.
5. En **Solvers**, reproduce la carrera de Jacobi, Gauss-Seidel y CG. Las barras codifican el residuo en escala logarítmica. LU aparece como método directo.
6. En **Condicionamiento**, reduce ε y aplica la perturbación. La lupa ilustra los cambios en la solución. El signo alternante de la animación es una representación visual del efecto matemático SPD.

**Modo Error** añade error absoluto, relativo, porcentual y residuos o defectos aplicables. La cifra relativa se omite si la referencia es cero. **Calidad baja**, en la cabecera, reduce resolución, partículas e instancias dibujadas. El botón de la luna cambia la luz del valle y enciende las ventanas de las cabinas.

Cada pulsación de la acción principal registra una corrida. También puedes guardar explícitamente, o exportar el resumen a PDF y las filas numéricas a CSV. En **Historial** busca por caso, escenario o fecha, abre o relanza una corrida y marca dos para compararlas.

## Organización

| Ruta | Contenido |
|---|---|
| `frontend/` | Centro de control, escena Three.js, gráficos, Web Worker y exportación |
| `numerical_methods/` | Algoritmos y modelos reproducibles sin dependencias de la UI |
| `database/` | Persistencia IndexedDB y DER |
| `backend/` | Nota de arquitectura estática |
| `tests/` | Pruebas unitarias y de persistencia |
| `docs/` | Diseño, supuestos y criterios de verificación |
| `dist/` | Sitio compilado listo para servir |

Fuente de los modelos y datos de referencia: informe del proyecto **SIMTELE-RISK · Avance semana 1**, secciones 2–7. El prototipo 2D citado en la consigna no estaba adjunto al material disponible, por lo que la biblioteca numérica se implementó desde las fórmulas del informe.
