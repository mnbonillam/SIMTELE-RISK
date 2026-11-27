import {CASES,CASE_NOTES} from '../../numerical_methods/experiments.js';
import {MODULES,TYPES} from '../../numerical_methods/models.js';
import {format,escape} from './layout.js';

const palette=['#ff9b62','#68d5df','#bdabff'];
const phase=['Nominal','Estrés','Mal condicionado'];
const compact=value=>format(value,4);
const numeric=(value,digits=4)=>value!==0&&Number.isFinite(value)&&Math.abs(value)<0.001?value.toExponential(3):format(value,digits);
const plotFloor=1e-16;

export function drawEvidence(section,state) {
  const note=CASE_NOTES[state.module];
  section.hidden=!note||!state.result;
  if(section.hidden)return;
  const r=state.result, p=state.params;
  const sensorUnit=r.unit?' '+r.unit:'';
  const outcome={
    brake:()=>`Recorrido total: ${compact(r.distance)} m. ${r.distance>150?'Supera el límite ilustrativo por '+compact(r.distance-150)+' m.':'Margen hasta el límite ilustrativo: '+compact(150-r.distance)+' m.'}`,
    wear:()=>`Cruce del umbral: ${compact(r.inspection)} meses. Un mes después, D ≈ ${compact(p.initial+p.alpha*(r.inspection+1)+p.beta*(r.inspection+1)**2)}.`,
    wind:()=>`Pico analítico muestreado: ${compact(r.peak??Math.max(...r.lines[0].points.map(([,y])=>Math.abs(y))))} m.`,
    sensors:()=>`Máximo error absoluto en muestras ocultas: Lagrange ${compact(Math.max(...r.methods[0].rows.map(row=>row.abs)))}${sensorUnit}; spline ${compact(Math.max(...r.methods[1].rows.map(row=>row.abs)))}${sensorUnit}.`
  }[state.module]();
  const method=state.result.methods.filter(m=>m.rows.length>1&&m.rows.some(row=>Number.isFinite(row.abs)||Number.isFinite(row.res)));
  section.innerHTML=`
    <section class="panel evidence-panel" aria-labelledby="error-chart-title">
      <div class="panel-head"><div><p class="label">VERIFICACIÓN</p><h2 id="error-chart-title">Error y convergencia</h2></div>
        <div class="evidence-tools"><select id="error-method" aria-label="Método del gráfico de error">${method.map((m,i)=>`<option value="${i}">${m.name}</option>`).join('')}</select>
          <select id="error-kind" aria-label="Métrica del gráfico"><option value="abs">Error absoluto</option><option value="res">Residuo / defecto</option></select></div>
      </div>
      <svg id="error-chart" viewBox="0 0 560 188" role="img" aria-labelledby="error-chart-title"></svg><p class="chart-note" id="error-caption"></p>
      <details class="evidence-details"><summary>Modelo, parámetros y referencia</summary><p>${note.model}</p><p>Fuente de los parámetros: valores sintéticos de la consigna y del avance académico.</p></details>
    </section>
    <section class="panel evidence-panel conclusions" aria-labelledby="interpret-title">
      <div class="panel-head"><div><p class="label">INTERPRETACIÓN</p><h2 id="interpret-title">Qué nos dicen los resultados</h2></div></div>
      <article><h3>Conclusión numérica</h3><p>${note.numerical}</p></article>
      <article><h3>Conclusión del problema</h3><p>${note.physical}</p><p><strong>${outcome}</strong></p></article>
      <button class="button" data-show-presets>Comparar los tres escenarios</button>
    </section>`;
  const methodSelect=section.querySelector('#error-method'), kind=section.querySelector('#error-kind');
  const selected=state.result.methods[state.methodIndex];
  methodSelect.value=String(Math.max(0,method.indexOf(selected)));
  function render(){
    const m=method[Number(methodSelect.value)], metric=kind.value;
    const rows=m?.rows.filter(row=>Number.isFinite(row[metric]))??[];
    const axes=rows.map(row=>[row.t??row.k,Math.log10(Math.max(plotFloor,row[metric]))]);
    const caption=section.querySelector('#error-caption'), svg=section.querySelector('#error-chart');
    if(!axes.length) {
      svg.innerHTML='<text x="280" y="94" text-anchor="middle">Sin valores para esta métrica</text>';
      caption.textContent='';
      return;
    }
    const min=axes[0][0], max=axes.at(-1)[0];
    const lower=Math.max(-16,Math.floor(Math.min(...axes.map(([,y])=>y))));
    const upper=Math.max(lower+1,Math.ceil(Math.max(...axes.map(([,y])=>y))));
    const x=value=>62+478*(value-min)/(max-min||1);
    const y=value=>13+136*(upper-value)/(upper-lower);
    const labels=Array.from({length:5},(_,i)=>{
      const v=lower+(upper-lower)*i/4, pos=y(v);
      return `<path class="evidence-line" d="M62 ${pos}H540"/><text x="52" y="${pos+4}" text-anchor="end">10^${Number(v.toFixed(2))}</text>`;
    }).join('');
    svg.innerHTML=labels+`<path d="${axes.map(([a,b],i)=>`${i?'L':'M'}${x(a).toFixed(2)},${y(b).toFixed(2)}`).join(' ')}" fill="none" stroke="${palette[0]}" stroke-width="2.2"/>
      <text x="62" y="169">${format(min,2)}</text><text x="540" y="169" text-anchor="end">${format(max,2)}</text>`;
    const isTime=rows[0].t!==undefined;
    caption.textContent=`${m.name} · ${isTime?'abscisa t':'índice de iteración o refinamiento'} · escala logarítmica. Los ceros se dibujan en 10⁻¹⁶.`;
  }
  methodSelect.onchange=kind.onchange=render;
  render();
}

function snapshot(module,runs){
  const note=CASE_NOTES[module];
  const max=Math.max(1e-13,...runs.map(run=>Math.abs(run.indicator)));
  const rows=runs.map(({scenario,indicator,sensitivity,result},i)=>`
    <tr><th scope="row">${phase[i]}</th><td><div class="preset-value">${compact(indicator)}
    <span class="preset-track"><i style="--fill:${Math.abs(indicator)/max*100}%;--graph:${palette[i]}"></i></span></div></td>
    <td>${numeric(sensitivity.delta,6)}</td><td>${sensitivity.linked?`κ₂ = ${format(sensitivity.linked.kappa,0)}`:sensitivity.gain===null?'—':`${compact(sensitivity.gain)}×`}</td>
    <td><button class="button" data-preset-module="${module}" data-preset-scenario="${TYPES.indexOf(scenario)}" aria-label="Abrir ${phase[i]} en ${MODULES[module].short}">Abrir</button></td></tr>`).join('');
  const detail=runs.map(({scenario,result,params,sensitivity},i)=>`
    <details class="preset-details"><summary>${phase[i]} · entradas y métodos</summary>
      <p class="chart-note">${escape(Object.entries(params).filter(([key])=>key!=='edits').map(([k,v])=>`${k} = ${v}`).join(' · '))}</p>
      ${sensitivity.linked?`<p class="chart-note">Subexperimento matemático SPD vinculado al caso. ε = 0,001; perturbación relativa de b = ${numeric(sensitivity.linked.bRel)}, cambio relativo de x = ${numeric(sensitivity.linked.xRel)}. Ganancia ≈ ${format(sensitivity.linked.gain,0)}.</p>`:''}
      <div class="preset-table-wrap"><table><thead><tr><th>Método</th><th>Valor</th><th>Referencia</th><th>Error abs.</th><th>Error rel.</th><th>Error %</th><th>Residuo</th></tr></thead>
      <tbody>${result.methods.map(m=>`<tr><th scope="row">${m.name}</th><td>${compact(m.value)}</td><td>${compact(m.reference)}</td><td>${numeric(m.metrics.abs)}</td><td>${numeric(m.metrics.rel)}</td><td>${numeric(m.metrics.percent)}</td><td>${numeric(m.metrics.res)}</td></tr>`).join('')}</tbody></table></div>
    </details>`).join('');
  return `<section class="panel preset-case"><h3>${MODULES[module].title}</h3><p class="chart-note">${note.perturb}</p>
  <div class="preset-table-wrap"><table><thead><tr><th>Escenario</th><th>${note.label}</th><th>Cambio absoluto</th><th>Condición / ganancia</th><th>Abrir caso</th></tr></thead><tbody>${rows}</tbody></table></div>
  ${detail}</section>`;
}

export function setupComparison(worker,openPreset){
  const dialog=document.querySelector('#presets-dialog'), output=document.querySelector('#presets-output');
  const filter=document.querySelector('#presets-filter');
  const cached=new Map(), pending=new Set();
  filter.innerHTML='<option value="">Cuatro casos</option>'+CASES.map(m=>`<option value="${m}">${MODULES[m].short}</option>`).join('');
  filter.onchange=render;
  document.querySelector('#presets-close').onclick=()=>dialog.close();
  function render(){
    const cases=filter.value?[filter.value]:CASES;
    output.innerHTML=cases.map(module=>{
      const result=cached.get(module);
      if(result?.error)return `<p class="empty">No se pudo calcular ${MODULES[module].short}.</p>`;
      if(result)return snapshot(module,result);
      if(!pending.has(module)){pending.add(module);worker.postMessage({type:'presets',module});}
      return `<p class="empty">Calculando ${MODULES[module].short}…</p>`;
    }).join('');
  }
  worker.addEventListener('message',({data})=>{
    if(data.type!=='presets')return;
    pending.delete(data.module);
    cached.set(data.module,data.result??{error:data.error});
    if(dialog.open)render();
  });
  output.addEventListener('click',event=>{
    const target=event.target.closest('[data-preset-module]');
    if(!target)return;
    dialog.close();
    openPreset(target.dataset.presetModule,TYPES[Number(target.dataset.presetScenario)]);
  });
  return module=>{
    filter.value=module??'';
    if(!dialog.open)dialog.showModal();
    render();
  };
}
