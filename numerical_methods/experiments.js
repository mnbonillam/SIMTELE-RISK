import {defaults,calculate,conditioning,TYPES} from './models.js';

export const CASES=['brake','wear','wind','sensors'];
export const CASE_NOTES={
  brake:{
    label:'Distancia total (m)', model:'x(0)=0, v(0)=v₀. La reacción mantiene la velocidad; después actúa una desaceleración constante. v₀ en m/s, a en m/s², reacción y paso en s. El límite de 150 m es un supuesto didáctico.',
    numerical:'RK2 y RK4 integran por separado las dos fases. Al ser lineal la velocidad de frenado, las cuadraturas coinciden con la referencia salvo redondeo. Se busca la raíz de la extensión lineal de v, ya que la velocidad física recortada vale cero después de detenerse.',
    physical:'La reacción añade v₀·tᵣ. El tramo de frenado crece con v₀² y disminuye al aumentar a. El alcance del límite se interpreta dentro del ensayo sintético.',
    perturb:'Se aumenta v₀ en 0,01 m/s; se mide el cambio en distancia.'
  },
  wear:{
    label:'Inspección (meses)', model:'t en meses. D₀ y el umbral son adimensionales; α en mes⁻¹ y β en mes⁻². La calibración usa una matriz SPD sintética de 4 × 4 y un vector de coeficientes escalados conocido.',
    numerical:'Bisección divide un intervalo que encierra la raíz. Newton usa D′ y secante usa dos semillas. Para la calibración SPD se comprueban residuos y errores contra coeficientes conocidos; el sistema normal es simétrico y estrictamente dominante, con diagonal positiva.',
    physical:'Una β mayor adelanta el cruce. Aplazar una inspección más allá del cruce aumenta D dentro de la hipótesis de crecimiento monótono. El umbral y los plazos son supuestos educativos.',
    perturb:'Se aumenta el umbral en 0,001; se mide el cambio en meses.'
  },
  wind:{
    label:'Pico analítico muestreado (m)', model:'m en kg, c en N·s/m, k en N/m, F en N, ω en rad/s y paso en s. x(0)=0,05 m, v(0)=0 m/s. Caso lineal de un grado de libertad. Referencia de área: Simpson compuesto con 16.384 subintervalos del desplazamiento analítico.',
    numerical:'RK2 usa punto medio; RK4 usa el esquema clásico. El paso y el régimen de oscilación cambian el error. Trapecio, Simpson 1/3 y Romberg integran |x|; compare el refinamiento porque los cruces por cero introducen quiebres en |x|.',
    physical:'Una excitación cercana a la frecuencia natural y una amortiguación menor pueden aumentar la oscilación sintética. El pico es aproximado por muestreo de la solución analítica.',
    perturb:'Se aumenta el amortiguamiento en 0,1 N·s/m; se mide el cambio en el pico.'
  },
  sensors:{
    label:'Error máximo Lagrange', model:'Señal sen(t) (t en radianes), ordenada y ruido adimensionales. Runge usa un dominio adimensional. Los tres interpolantes comparten nodos y se evalúan en muestras ocultas.',
    numerical:'Lagrange y Newton representan el mismo polinomio con bases distintas; el spline natural usa tramos cúbicos. Un residuo pequeño en nodos puede acompañar un error grande entre ellos. La calibración auxiliar resuelve cuatro sesgos sintéticos conocidos en una matriz SPD.',
    physical:'La incertidumbre entre nodos depende del ruido y de su distribución. La prueba oculta mide el error de reconstrucción para una señal sintética conocida.',
    perturb:'Se añade 0,001 a la ordenada del primer nodo. Se mide la mayor diferencia entre las dos reconstrucciones Lagrange en la malla de evaluación.'
  }
};

export function indicator(module,result){
  if(module==='brake')return result.distance;
  if(module==='wear')return result.inspection;
  if(module==='wind')return result.peak??Math.max(...result.lines[0].points.map(([,y])=>Math.abs(y)));
  return Math.max(...result.methods[0].rows.map(row=>row.abs));
}

export function linkedCondition(module,scenario){
  if(module==='sensors'||scenario!==TYPES[2])return null;
  const {kappa,bRel,xRel,gain}=conditioning({logE:-3});
  return {kappa,bRel,xRel,gain};
}

export function sensitivity(module,params,result,scenario){
  const perturbation={
    brake:{v0:params.v0+0.01}, wear:{limit:params.limit+0.001}, wind:{c:params.c+0.1},
    sensors:module==='sensors'?{edits:{...params.edits,0:[result.nodes[0][0],(params.edits[0]?.[1]??0)+0.001]}}:null
  }[module];
  const changed=calculate(module,{...params,...perturbation});
  const lineIndex={sensors:1, wind:0}[module];
  const delta=lineIndex!==undefined
    ? Math.max(...result.lines[lineIndex].points.map(([,y],i)=>Math.abs(changed.lines[lineIndex].points[i][1]-y)))
    : Math.abs(indicator(module,changed)-indicator(module,result));
  return {delta, gain:module==='sensors'?delta/0.001:null, linked:linkedCondition(module,scenario)};
}

export function comparePresets(module){
  return TYPES.map(scenario=>{
    const params=defaults(module,scenario), result=calculate(module,params);
    return {scenario,params,result,indicator:indicator(module,result),sensitivity:sensitivity(module,params,result,scenario)};
  });
}

export function verifyReplay(saved,fresh,tolerance=1e-10){
  function matches(left,right){
    if(Array.isArray(left))return Array.isArray(right)&&left.length===right.length&&left.every((v,i)=>matches(v,right[i]));
    if(typeof left!=='number'||typeof right!=='number')return left===right;
    return Math.abs(left-right)<=tolerance*Math.max(1,Math.abs(left));
  }
  const methods=new Map(fresh.methods.map(method=>[method.name,method]));
  const fields=['k','t','n','value','res','abs','rel','percent'];
  const verified=saved.methods.filter(original=>{
    const next=methods.get(original.name);
    return next&&matches(original.value,next.value)&&next.rows.length===original.rows.length&&
      original.rows.every((row,i)=>fields.every(key=>matches(row[key],next.rows[i][key])));
  }).length;
  const sameCurves=saved.lines.length===fresh.lines.length&&saved.lines.every((line,i)=>
    line.name===fresh.lines[i].name&&matches(line.points,fresh.lines[i].points));
  return {verified,total:saved.methods.length,sameCurves,tolerance};
}
