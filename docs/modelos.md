# Diseño y criterios numéricos

## Experiencia y arquitectura

La paleta combina azul pizarra, nieve y naranja de señal, con acentos coral y violeta para estrés y mal condicionamiento. El diseño usa Space Grotesk e Inter almacenadas con el sitio. La escena tiene una vista cinematográfica inicial y cámaras que interpolan su posición y objetivo por módulo. En pantallas estrechas, el panel de parámetros se desplaza debajo de la vista.

Three.js 0.180.0 dibuja el relieve, la catenaria, el valle urbano y las cabinas mediante geometrías procedurales e instancias. La distancia de la escena se mide por arco sobre la catenaria. El reloj de reproducción avanza con incrementos fijos de 1/120 s. Las trayectorias no dependen de la tasa de refresco. El Web Worker entrega las series calculadas y descarta, mediante un identificador por consulta, las respuestas de parámetros anteriores. El modo de calidad baja reduce densidad de píxeles, fondo urbano, partículas y cabinas secundarias. La escena deja de redibujarse cuando se estabiliza, y la telemetría se actualiza como máximo unas 15 veces por segundo.

## Referencias

| Caso | Referencia y criterio |
|---|---|
| Detención | Analítica por fases. Los métodos RK2 y RK4 reinician el paso en cada transición. El defecto se calcula sobre la ecuación discreta de velocidad. |
| Deterioro | Raíz cuadrática estable. En NORMAL, el umbral se alcanza a los 11,3746 meses. En ESTRÉS con β = 0,002, se alcanza a los 9,0587 meses. El residuo es \|D(t) − umbral\|. |
| Viento | Particular sinusoidal más solución homogénea con las condiciones x₀ = 0,05 m, v₀ = 0. El fantasma RK2 usa el punto medio. Una ganancia visual lateral de 10 amplifica el movimiento. El defecto compara la diferencia de velocidades por paso con la aceleración de punto medio. |
| Integral | Los tres métodos integran \|x analítico\| en [0,20] s y se comparan con una referencia independiente de Simpson compuesto con 16.384 subintervalos. En la animación de Romberg, el sombreado muestra la malla trapezoidal subyacente a la extrapolación. |
| Sensores | Error fuera de nodos contra la señal sintética y residuo máximo en los nodos. La prueba del PDF usa π/4 y devuelve 0,75 para Lagrange y error cercano a 0,0428932. |
| Solvers | A SPD 4×4 del informe, x₀ = 0 y parada por tolerancia escalada. La condición del ejemplo es independiente del modelo físico. La carrera mantiene el ejemplo 4×4 en todos los escenarios. |
| Condicionamiento | A SPD con correlación 1 − ε. Para ε = 0,001, κ₂ = 1999, x perturbado ≈ (1,001; 0,999; 1; 1). La ganancia de perturbación usa norma 2. |

Las iteraciones 0 de los sistemas lineales se guardan para visualizar el estado inicial, y la cuenta de convergencia usa el índice final. El tiempo dibujado en deterioro y solvers es un reloj de exposición: 1× muestra 1,7 meses por segundo o 4 iteraciones por segundo, respectivamente.

## Alcance

El modelo de detención usa desaceleración constante y una barrera ilustrativa a 150 m. MAL CONDICIONADO emplea la configuración física normal y un subexperimento algebraico separado. Sensores selecciona la función de Runge con nodos agrupados en ese escenario. El deterioro se muestra mediante color del cable y piezas de apoyo. La persistencia se conserva por perfil y origen de navegador. El objetivo de 60 fps depende de hardware y resolución.
