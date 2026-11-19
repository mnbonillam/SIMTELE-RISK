# Modelo de datos

La base local `simtele-risk` tiene seis almacenes con llave primaria `id`.

| Almacén | Referencia | Datos principales |
|---|---|---|
| caso_estudio | — | Nombre y versión del modelo |
| escenario | caso_id | Tipo, fuente y copia de los parámetros de la corrida |
| simulacion | escenario_id | Fecha ISO, estado, duración total de cálculo y series visuales |
| ejecucion_metodo | simulacion_id | Nombre, tolerancia, paso, límite, convergencia y tiempo cuando se mide individualmente |
| iteracion_resultado | ejecucion_id | Índice, aproximación, errores, residuo y detalle opcional |
| resultado_resumen | ejecucion_id único | Referencia, valor, métricas e interpretación |

Cada escritura agrega una instantánea del escenario y la corrida en una transacción atómica. IndexedDB indexa las relaciones y la aplicación escribe las referencias junto con sus padres. La fecha y los resultados se restauran después de recargar, dentro del mismo origen y perfil. El tiempo de cómputo individual es opcional cuando varios métodos comparten una única pasada.
