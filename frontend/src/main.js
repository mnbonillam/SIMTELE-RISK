import '@fontsource-variable/space-grotesk/wght.css';
import '@fontsource-variable/inter/wght.css';
import './style.css';
import {MODULES,defaults,brakeAt,sampleAt} from '../../numerical_methods/models.js';
import {saveRun,listRuns,loadRun} from '../../database/history.js';
import {createScene} from './scene.js';
import {drawChart} from './chart.js';
import {mount,format,escape,configMarkup,controls,sliderText,titles} from './layout.js';
import {icon} from './icons.js';
import {csv,pdf} from './export.js';
import {drawEvidence,setupComparison} from './evidence.js';
import {verifyReplay} from '../../numerical_methods/experiments.js';

mount();
const q=(id)=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const s={module:'brake',scenario:'NORMAL',params:defaults('brake','NORMAL'),result:null,t:0,rate:1,playing:false,intro:!reduced.matches&&!sessionStorage.getItem('simtele-entered'),
  showErrors:false,replayReference:null,quality:false,night:false,methodIndex:0,integration:'',refinement:0,record:null,pendingRun:false};
const stage=q('stage'),scene=createScene(stage);
const worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
const openPresets=setupComparison(worker,(module,scenario)=>{
  finishIntro();q('lab-home').hidden=true;selectModule(module,scenario);
  q('module-title').scrollIntoView({block:'start'});
});
const showHome=(event)=>{
  event?.preventDefault();finishIntro();q('lab-home').hidden=false;
  q('lab-home').scrollIntoView({block:'start'});
};
q('home-link').onclick=showHome;
q('home-nav').onclick=showHome;
q('global-compare').onclick=()=>{finishIntro();openPresets();};
q('evidence').addEventListener('click',e=>{
  if(e.target.closest('[data-show-presets]'))openPresets(s.module);
});
document.querySelectorAll('[data-case]').forEach(button=>button.onclick=()=>{
  finishIntro();q('lab-home').hidden=true;selectModule(button.dataset.case,'NORMAL');
  q('module-title').scrollIntoView({block:'start'});
});
let activeRequest=0, readyRequest=0, queuedFrame=0, chartView, drag=null, toastTimer, list=[], selected=new Set(), dialogRev=0;
const cameraLevels=[0.75,1,1.35,1.8,2.4];
let cameraLevel=1;
let lastHud=0, lastFrame=0, accumulator=0;
function notify(message) {
  q('toast').textContent=message;q('toast').hidden=false;clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>q('toast').hidden=true,3000);
}
function finishIntro(){
  if(!s.intro)return;
  s.intro=false;
  const intro=q('intro');
  if(reduced.matches) intro.hidden=true;
  else {
    intro.classList.add('leaving');
    q('enter').tabIndex=-1;
    if(document.activeElement===q('enter'))q('play').focus();
    setTimeout(()=>intro.hidden=true,260);
  }
  sessionStorage.setItem('simtele-entered','1');
}
q('camera-controls').hidden=stage.classList.contains('no-webgl');
function setCameraLevel(level){
  cameraLevel=Math.max(0,Math.min(cameraLevels.length-1,level));
  q('camera-out').disabled=cameraLevel===0;
  q('camera-in').disabled=cameraLevel===cameraLevels.length-1;
  q('camera-magnification').textContent=new Intl.NumberFormat('es-BO').format(cameraLevels[cameraLevel])+'×';
}
q('camera-out').onclick=()=>setCameraLevel(cameraLevel-1);
q('camera-in').onclick=()=>setCameraLevel(cameraLevel+1);
q('camera-reset').onclick=()=>setCameraLevel(1);
q('intro').hidden=!s.intro;
q('enter').onclick=finishIntro;
if(s.intro) setTimeout(()=>{if(s.intro)finishIntro();},3500);
reduced.addEventListener('change',()=>{if(reduced.matches)finishIntro();});

function query() {
  cancelAnimationFrame(queuedFrame);
  s.record=null;
  activeRequest++;
  const id=activeRequest;
  queuedFrame=requestAnimationFrame(()=>worker.postMessage({id,module:s.module,params:s.params}));
}
worker.onmessage=({data})=>{
  if(data.type==='presets'||data.id!==activeRequest)return;
  if(data.error){s.pendingRun=false;notify(data.error);return;}
  readyRequest=data.id; s.result=data.result;s.t=Math.min(s.t,s.result.end);
  displayResult();
  if(s.replayReference){
    const check=verifyReplay(s.replayReference,s.result);
    const pass=check.verified===check.total&&check.sameCurves;
    q('replay-check').hidden=false;
    q('replay-check').textContent=pass
      ? `Reproducción verificada · ${check.verified} métodos, sus iteraciones y las curvas coinciden (tolerancia escalada 10⁻¹⁰).`
      : `Reproducción: ${check.verified} de ${check.total} métodos históricos coinciden; curvas ${check.sameCurves?'coincidentes':'distintas'}. Revisa la versión del modelo.`;
    s.replayReference=null;
  }
  if(s.pendingRun){s.pendingRun=false;startRun();}
};
worker.onerror=()=>notify('El motor numérico no pudo iniciarse.');

const snapshot=()=>({module:s.module,scenario:s.scenario,params:structuredClone(s.params),result:s.result});
async function storeCurrent(explicit=false) {
  if(!s.result||readyRequest!==activeRequest)return;
  if(s.record&&!explicit)return;
  const run=snapshot(), revision=activeRequest;
  const task=saveRun(run);
  s.record=task;
  try {await task;if(explicit)notify('Corrida guardada en el historial');}
  catch {if(revision===activeRequest)s.record=null;notify('El navegador no pudo guardar la corrida');}
}
function stop(){s.playing=false;updatePlay();}
function updatePlay(){
  q('play').innerHTML=icon(s.playing?'pause':'play');
  q('play').setAttribute('aria-label',s.playing?'Pausar':'Reproducir');
  q('play').title=s.playing?'Pausar':'Reproducir';
}
function startRun(){
  finishIntro();
  if(!s.result||readyRequest!==activeRequest){s.pendingRun=true;return;}
  s.t=0;s.playing=true;updatePlay();updateHud();
  void storeCurrent();
}
function beginPlayback(){
  finishIntro();
  if(!s.result||readyRequest!==activeRequest){s.pendingRun=true;return;}
  if(s.playing) stop();
  else {
    if(s.t>=s.result.end-1e-8)s.t=0;
    s.playing=true;updatePlay();void storeCurrent();
  }
}
function changed(reset=true){
  q('replay-check').hidden=true;s.replayReference=null;
  if(reset){s.t=0;stop();}
  s.pendingRun=false;
  s.result=null;
  query();
}
function selectModule(module,scenario=s.scenario,params=null,result=null){
  q('evidence').hidden=true;q('replay-check').hidden=true;s.replayReference=null;
  s.module=module;s.scenario=scenario;s.params=params?structuredClone(params):defaults(module,scenario);
  s.result=result;s.t=0;s.methodIndex=0;s.integration='';s.refinement=0;s.record=null;s.pendingRun=false;
  activeRequest++;cancelAnimationFrame(queuedFrame);stop();
  drawFrame();
  if(result){readyRequest=activeRequest;s.record=true;displayResult();} else query();
}
function drawFrame(){
  const m=MODULES[s.module], group=['brake','wear','wind','sensors'];
  document.documentElement.dataset.scenario=s.scenario;
  document.querySelectorAll('[data-module]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.module===s.module)));
  q('module-title').textContent=m.title;q('module-subtitle').textContent=m.subtitle;
  q('breadcrumb').textContent=group.includes(s.module)?'Casos de estudio / 0'+(group.indexOf(s.module)+1):'Análisis numérico';
  q('scenario').value=s.scenario;
  q('config').innerHTML=configMarkup(s);
  q('run').onclick=()=>{s.record=null; startRun();};
  q('reset-params').onclick=()=>selectModule(s.module);
  q('slow').onclick=()=>{setRate(s.rate===0.25?1:0.25);};
  q('resonance')?.addEventListener('click',()=>{
    s.params={...s.params,omega:Math.round(Math.sqrt(s.params.k/s.params.m)/0.05)*0.05,force:18,c:14,step:0.65};
    drawFrame();changed();
  });
  q('runge')?.addEventListener('change',e=>{
    s.params={...s.params,runge:e.target.checked,clustered:false,count:e.target.checked?11:3,edits:{}};
    drawFrame();changed();
  });
  q('reset-nodes')?.addEventListener('click',()=>{s.params={...s.params,edits:{}};changed(false);});
  q('solver-tolerance')?.addEventListener('change',e=>{s.params={...s.params,tolerance:Number(e.target.value)};changed();});
  q('config').querySelectorAll('[data-param]').forEach(input=>input.oninput=()=>{
    const key=input.dataset.param, value=Number(input.value);
    s.params={...s.params,[key]:value,...(key==='count'?{edits:{}}:{})};
    const [, ,unit,min,max,step]=controls[s.module].find(row=>row[0]===key);
    q('out-'+key).innerHTML=sliderText(key,value,step)+(unit?' <small>'+unit+'</small>':'');
    input.style.setProperty('--progress',(value-min)/(max-min)*100+'%');
    const progress=s.t;
    changed(false);
    s.t=progress;
  });
  stage.dataset.module=s.module;
  q('stage-module').hidden=true;
  q('stage-module').innerHTML='';
  q('chart-title').textContent=titles[s.module][0];
  q('chart').setAttribute('aria-label',titles[s.module].join('. '));
  q('camera-label').textContent={wind:'CÁMARA LATERAL',wear:'CÁMARA DE INSPECCIÓN',sensors:'CÁMARA DE SENSORES',solvers:'VISTA PANORÁMICA',condition:'VISTA PANORÁMICA'}[s.module]??'CÁMARA DE SEGUIMIENTO';
  q('chart-caption').textContent=s.module==='sensors'?'PANEL DE SEÑAL':'ANÁLISIS DEL MODELO';
  if(!s.result){
    q('chart').innerHTML='';q('legend').innerHTML='';q('chart-tools').innerHTML='';
    q('chart-note').hidden=true;q('metrics').innerHTML='';
    q('results').innerHTML='<div class="panel-head"><h2>Resultados numéricos</h2></div><p class="empty">Calculando…</p>';
  }
  const holder=q('chart-holder'), grid=holder.closest('.analysis-grid')??document.querySelector('.analysis-grid');
  if(s.module==='sensors') {
    stage.append(holder);holder.classList.add('hologram');grid.classList.add('single');
  } else {
    grid.prepend(holder);holder.classList.remove('hologram');grid.classList.remove('single');
  }
}
function setRate(value){
  s.rate=value;q('rate').value=String(value);q('slow')?.setAttribute('aria-pressed',String(value===0.25));
}
q('rate').onchange=e=>setRate(Number(e.target.value));
q('play').onclick=beginPlayback;
q('reset-time').onclick=()=>{finishIntro();stop();s.t=0;s.refinement=0;updateHud();if(s.integration)drawGraph();};
q('timeline').oninput=e=>{finishIntro();stop();s.t=Number(e.target.value);updateHud();updateRefinement();};
q('scenario').onchange=e=>{finishIntro();selectModule(s.module,e.target.value);};
document.querySelectorAll('[data-module]').forEach(el=>el.onclick=()=>{finishIntro();q('lab-home').hidden=true;selectModule(el.dataset.module);});
q('error-mode').onclick=()=>{
  s.showErrors=!s.showErrors;
  q('error-mode').setAttribute('aria-pressed',String(s.showErrors));
  if(s.result){drawResults();drawGraph();updateHud();}
};
q('quality').onclick=()=>{
  s.quality=!s.quality;scene.quality(s.quality);
  q('quality').setAttribute('aria-pressed',String(s.quality));notify(s.quality?'Calidad baja activada':'Calidad alta activada');
};
q('night').onclick=()=>{s.night=!s.night;q('night').setAttribute('aria-pressed',String(s.night));};

const metricInfo={
  brake:[['VELOCIDAD','m/s','gauge'],['RECORRIDO','m','route'],['TIEMPO','s','clock'],['DETENCIÓN TOTAL','m','brake']],
  wear:[['DETERIORO','','wear'],['UMBRAL','','point'],['TIEMPO','meses','clock'],['INSPECCIÓN','meses','route']],
  wind:[['DESPLAZAMIENTO','m','wind'],['VELOCIDAD LATERAL','m/s','gauge'],['TIEMPO','s','clock'],['FRECUENCIA NATURAL','rad/s','sensors']],
  sensors:[['SEÑAL REAL','','sensors'],['LAGRANGE','','point'],['SPLINE','','route'],['MUESTRAS','','layers']],
  solvers:[['ITERACIÓN','','clock'],['RESIDUO JACOBI','','solvers'],['RESIDUO GAUSS-SEIDEL','','solvers'],['RESIDUO CG','','solvers']],
  condition:[['CONDICIÓN κ₂','','condition'],['PERTURBACIÓN REL.','','point'],['CAMBIO REL.','','route'],['AMPLIFICACIÓN','×','solvers']]
};
const raceColors=['#ff9b62','#68d5df','#bdabff'];
function displayResult(){
  q('metrics').innerHTML=[...metricInfo[s.module],['ERROR ABSOLUTO','','info'],['RESIDUO / DEFECTO','','point']].map(([label,unit,symbol],i)=>
    `<div class="metric panel" ${i>=4?'data-error-card hidden':''}><span class="metric-icon">${icon(symbol,17)}</span><div><div class="label">${label}</div><div class="metric-reading"><strong id="metric-${i}">—</strong><small>${unit}</small></div></div></div>`).join('');
  const r=s.result;
  q('timeline').max=r.end;
  q('time-end').textContent=timeLabel(r.end);
  q('chart-tools').innerHTML=s.module==='wind'?`<select id="integration" aria-label="Método de integración"><option value="">Oscilación</option>${Object.keys(r.area).map(key=>`<option ${key===s.integration?'selected':''}>${key}</option>`).join('')}</select>`:'';
  q('integration')?.addEventListener('change',e=>{s.integration=e.target.value;s.refinement=0;updateRefinement();drawGraph();});
  drawStagePanel();
  drawResults();
  drawEvidence(q('evidence'),s);
  drawGraph();
  updateHud();
}
function drawStagePanel(){
  const panel=q('stage-module');panel.hidden=!['solvers','condition','wind'].includes(s.module);
  if(s.module==='solvers') panel.innerHTML=`<div class="overlay-title">${icon('solvers',17)} Residuo en carrera</div>${s.result.methods.slice(0,3).map((m,i)=>`
    <div class="race-row" style="--racer:${raceColors[i]}"><div><b>${m.name==='CG'?'Gradiente conjugado':m.name}</b><output id="race-text-${i}"></output></div><div class="race-track"><i id="race-${i}"></i></div></div>`).join('')}`;
  if(s.module==='condition') panel.innerHTML=`<div class="overlay-title">${icon('condition',18)} Lupa de sensibilidad</div>
    <div class="sensitivity-label">x₁ − 1 <output id="delta-plus"></output></div><div class="sensitivity-track"><i id="delta-bar-plus"></i></div>
    <div class="sensitivity-label">x₂ − 1 <output id="delta-minus"></output></div><div class="sensitivity-track"><i id="delta-bar-minus"></i></div>
    <small>Se alterna el signo de Δb. La vista amplifica los desplazamientos.</small>`;
  if(s.module==='wind') panel.innerHTML='<span class="ghost-key">Analítica</span><span class="ghost-key">RK2 punto medio</span><span class="ghost-key">RK4</span>';
}
function drawGraph(){
  if(!s.result)return;
  const area=Boolean(s.integration), note=q('chart-note');
  q('chart-title').textContent=area?'Refinamiento del área |x(t)|':titles[s.module][0];
  chartView=drawChart(q('chart'),q('legend'),{...s});
  const text={
    brake:'Velocidad frente al tiempo. La fase de reacción conserva v₀.',
    wear:'Los puntos señalan los iterados de cada método. La línea vertical marca el mes de inspección.',
    wind:'El paso temporal controla el muestreo y el error de cada trayectoria.',
    sensors:'Arrastra un nodo o muévelo con las flechas. Activa Modo Error para mostrar las muestras ocultas.',
    solvers:'Escala logarítmica. El residuo se mide en norma infinito.',
    condition:'Épsilon se muestra en escala logarítmica. La matriz sigue siendo definida positiva.'
  }[s.module];
  note.hidden=false;
  if(!area){note.textContent=text;return;}
  const rows=s.result.area[s.integration], row=rows[s.refinement]??rows[0];
  const detail=s.integration==='Romberg'?' · extrapolación de la malla trapezoidal':'';
  note.innerHTML=`<span>${row.n} subintervalos · ${format(row.value,6)} m·s${detail}</span>
    <button class="subtle" id="refine">${icon('arrow',14)} Refinar área</button>`;
  q('refine').onclick=()=>{
    stop();s.refinement=(s.refinement+1)%rows.length;
    s.t=s.result.end*s.refinement/(rows.length-1);updateHud();drawGraph();
  };
}
function updateRefinement(){
  if(!s.integration||!s.result)return;
  const steps=s.result.area[s.integration].length-1;
  const k=Math.min(steps,Math.floor(s.t/s.result.end*steps+1e-8));
  if(k!==s.refinement){s.refinement=k;drawGraph();}
}
function drawResults() {
  const r=s.result,m=r.methods[s.methodIndex]??r.methods[0];
  const e=m.metrics;
  const errorRows=s.showErrors ? `
   <dt>Error absoluto</dt><dd>${format(e.abs,6)}</dd>
   <dt>Error relativo</dt><dd>${format(e.rel,6)}</dd>
   <dt>Error porcentual</dt><dd>${e.percent==null?'—':format(e.percent,6)+' %'}</dd>
   <dt>${['brake','wind'].includes(s.module)&&m.step!==null&&m.name.startsWith('RK')?'Defecto discreto':'Residuo'}</dt><dd>${format(e.res,6)}</dd>`:'';
  const windSummary=s.module==='wind'&&r.peak!==undefined?`<dt>Pico analítico muestreado</dt><dd>${format(r.peak,4)} m</dd>`:'';
  const brakeSummary=s.module==='brake'?`<dt>Solo frenado</dt><dd>${format(r.brakingDistance)} m</dd><dt>Reacción</dt><dd>${format(r.reactionDistance)} m</dd>`:'';
  const solverSummary=s.module==='solvers'?`<dt>Umbral ‖r‖∞</dt><dd>${format(r.threshold)}</dd>`:'';
  const wearSummary=s.module==='wear'?`<dt>Mes de inspección</dt><dd>${format(r.inspection,4)}</dd>`:'';
  const count=s.module==='solvers'&&m.name!=='LU'?m.rows.at(-1)?.k:m.rows.length;
  const status=m.converged===null?'':`<div class="result-status ${m.converged?'':'warning'}">${m.converged?'Convergió':'Límite de iteraciones alcanzado'}</div>`;
  q('results').innerHTML=`<div class="panel-head"><div><p class="label">VALIDACIÓN</p><h2>Resultados numéricos</h2></div><span class="tile-icon">${icon('gauge',18)}</span></div>
   <label class="compact-select method-select">Método<select id="method">${r.methods.map((x,i)=>`<option value="${i}" ${i===s.methodIndex?'selected':''}>${x.name}</option>`).join('')}</select></label>
   <dl class="result-values"><dt>Aproximación</dt><dd>${format(m.value,4)}</dd><dt>Referencia</dt><dd>${format(m.reference,4)}</dd><dt>${s.module==='solvers'||s.module==='wear'?'Iteraciones':'Registros'}</dt><dd>${count||'—'}</dd>${brakeSummary}${solverSummary}${wearSummary}${windSummary}${m.step!==null?`<dt>Paso</dt><dd>${format(m.step,6)}</dd>`:''}${m.tolerance!==null?`<dt>Tolerancia</dt><dd>${format(m.tolerance,6)}</dd>`:''}${errorRows}</dl>
   ${status}${m.criterion?`<p class="result-note">${m.criterion}</p>`:''}${m.interpretation?`<p class="result-note">${m.interpretation}</p>`:''}
   <details id="iterations" ${m.rows.length?'':'hidden'}><summary>Ver detalle numérico</summary><div class="iteration-scroll"><table><thead><tr><th>Índice</th><th>${m.rows.some(row=>row.n)?'n':'t'}</th><th>Valor</th><th>Residuo</th><th>Error abs.</th><th>Error rel.</th><th>Error %</th></tr></thead><tbody></tbody></table></div></details>
   <div class="result-actions"><button class="button" id="save">${icon('save',15)} Guardar</button><button class="button" id="csv" title="Exportar el detalle a CSV">${icon('download',14)} CSV</button><button class="button" id="pdf" title="Exportar el resumen a PDF">PDF</button></div>`;
  q('method').onchange=e=>{s.methodIndex=Number(e.target.value);drawResults();drawEvidence(q('evidence'),s);q('method').focus();updateHud();};
  q('iterations').ontoggle=e=>{
    if(!e.target.open)return;
    e.target.querySelector('tbody').innerHTML=m.rows.map(row=>`<tr><td>${row.k}</td><td>${row.n??format(row.t,4)}</td><td>${format(row.value,7)}</td><td>${format(row.res,5)}</td><td>${format(row.abs,5)}</td><td>${format(row.rel,5)}</td><td>${format(row.percent,5)}</td></tr>`).join('');
  };
  q('save').onclick=()=>void storeCurrent(true);
  q('csv').onclick=()=>{if(readyRequest===activeRequest)csv(snapshot());};
  q('pdf').onclick=()=>{if(readyRequest===activeRequest)void pdf(snapshot()).catch(()=>notify('No se pudo exportar el PDF'));};
}

function timeLabel(t){
  const d=s.module==='solvers'?0:2;
  return format(s.module==='solvers'?Math.floor(t):t,d)+(MODULES[s.module].unit?' '+MODULES[s.module].unit:' s');
}
function ordinates(lines,t) {
  return lines.map(line=>{
    const points=line.points,i=Math.max(0,Math.min(points.length-2,Math.floor((points.length-1)*(t-points[0][0])/(points.at(-1)[0]-points[0][0]))));
    const [a,y]=points[i],[b,z]=points[i+1];return y+(z-y)*(t-a)/(b-a);
  });
}
function updateHud(){
  const r=s.result;if(!r)return;
  q('timeline').value=s.t;
  q('timeline').style.setProperty('--progress',(r.end?s.t/r.end*100:0)+'%');
  q('timeline').setAttribute('aria-valuetext',timeLabel(s.t));
  q('time-code').textContent=timeLabel(s.t);
  chartView?.updateCursor(s.t);
  const {module,t,params:p}=s, a=brakeAt(s.module==='brake'?p:defaults('brake','NORMAL'),t);
  let values,state=s.playing?'EN REPRODUCCIÓN':'EN PAUSA', errorPoint=r.methods[s.methodIndex]?.metrics??{};
  if(module==='brake'){
    values=[a.v,a.x,t,r.distance];
    state=t===0&&!s.playing?'EN ESPERA':a.x>150?'LÍMITE SUPERADO':a.v<=0.00001?'CABINA DETENIDA':t<p.reaction?'EN REACCIÓN':'FRENANDO';
  } else if(module==='wear'){
    const d=p.initial+p.alpha*t+p.beta*t*t;
    values=[d,p.limit,t,r.inspection];state=d>=p.limit?'UMBRAL ALCANZADO':d>=0.1+0.65*(p.limit-0.1)?'DETERIORO ÁMBAR':'SEGUIMIENTO';
  } else if(module==='wind'){
    values=[...sampleAt(r.samples[2],t),t,r.natural];
    state=p.force&&Math.abs(p.omega-r.natural)<0.15?'CERCA DE RESONANCIA':p.force?'OSCILACIÓN FORZADA':'OSCILACIÓN LIBRE';
  } else if(module==='sensors'){
    values=[...ordinates(r.lines.slice(0,3),r.a+t),r.nodes.length];
    state=p.runge?'DEMOSTRACIÓN DE RUNGE':'MUESTRAS SINTÉTICAS';
  } else if(module==='solvers'){
    const k=Math.floor(t), now=r.methods.slice(0,3).map(m=>m.rows[k]??m.rows.at(-1));
    values=[k,...now.map(row=>row.res)];errorPoint=now[s.methodIndex]??errorPoint;
    now.forEach((row,i)=>{
      const progress=Math.min(100,Math.max(0,100*Math.log10(25/Math.max(1e-16,row.res))/Math.log10(25/r.threshold)));
      q('race-'+i).style.width=progress+'%';q('race-text-'+i).textContent='k '+row.k+' · '+format(row.res,4);
    });
  } else {
    values=[r.kappa,r.bRel,r.xRel,r.gain];
    const sign=reduced.matches||!s.playing?1:(Math.floor(t*2)%2?-1:1);
    [r.x[0]-1,r.x[1]-1].forEach((dx,i)=>{
      const part=i?'minus':'plus', value=sign*dx;
      q('delta-'+part).textContent=(value>0?'+':'')+format(value,6);
      const width=Math.min(48,4*Math.log10(1+Math.abs(value)*1e6));
      const bar=q('delta-bar-'+part);
      bar.style.width=width+'%';bar.style.left=(value<0?50-width:50)+'%';
      bar.classList.toggle('negative',value<0);
    });
    state='SISTEMA SPD AUXILIAR';
  }
  if(module==='brake'||module==='wind'){
    const rows=r.methods[s.methodIndex]?.rows;
    if(rows?.[0]?.t!==undefined) errorPoint=rows[Math.min(rows.length-1,Math.floor(t/(r.methods[s.methodIndex].step||1)))]??errorPoint;
  }
  q('scene-state').textContent=state;
  q('scene-state').classList.toggle('alert',state==='LÍMITE SUPERADO'||state==='UMBRAL ALCANZADO');
  stage.classList.toggle('over-limit',module==='brake'&&a.x>150);
  q('limit-tag').textContent=a.x>150?'LÍMITE SUPERADO · 150 m':'LÍMITE · 150 m';
  [...values,errorPoint.abs,errorPoint.res].forEach((value,i)=>{
    const node=q('metric-'+i), text=format(value,module==='wear'&&(i===0||i===3)?4:module==='solvers'&&i===0||module==='sensors'&&i===3?0:2);
    if(node.textContent!==text){node.textContent=text;node.animate?.([{opacity:0.65},{opacity:1}],{duration:reduced.matches?0:220});}
    if(i>=4)node.closest('.metric').hidden=!s.showErrors;
  });
}

const svg=q('chart');
function moveNode(index,x,y){
  const r=s.result;if(s.module!=='sensors'||!r)return;
  const nodes=r.nodes, padding=(r.b-r.a)/200;
  x=index===0?r.a:index===nodes.length-1?r.b:Math.max(nodes[index-1][0]+padding,Math.min(nodes[index+1][0]-padding,x));
  const ref=s.params.runge?1/(1+25*x*x):Math.sin(x);
  const offset=Math.max(-1,Math.min(1,y-ref-s.params.noise*Math.sin(91*index+0.6)));
  s.params={...s.params,edits:{...s.params.edits,[index]:[x,offset]}};
  query();
}
svg.addEventListener('pointerdown',e=>{
  if(e.target.dataset.node===undefined||!chartView)return;
  drag={index:Number(e.target.dataset.node),id:e.pointerId,coordinates:chartView.fromEvent};svg.setPointerCapture(e.pointerId);stop();
});
svg.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  moveNode(drag.index,...drag.coordinates(e));
});
for(const name of ['pointerup','lostpointercapture','pointercancel'])svg.addEventListener(name,()=>drag=null);
svg.addEventListener('keydown',e=>{
  const shifts={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowDown:[0,-1],ArrowUp:[0,1]};
  if(e.target.dataset.node===undefined||!shifts[e.key])return;
  e.preventDefault();
  const i=Number(e.target.dataset.node),[x,y]=s.result.nodes[i],[dx,dy]=shifts[e.key];
  moveNode(i,x+dx*(s.result.b-s.result.a)/100,y+dy*0.025);
});

const dialog=q('history-dialog');
const search=q('history-search');
q('history').onclick=async()=>{
  finishIntro();stop();q('comparison').hidden=true;selected.clear();search.value='';
  q('history-content').innerHTML='<p class="empty">Cargando historial…</p>';q('compare').disabled=true;dialog.showModal();
  try{list=await listRuns();refreshList();}catch{q('history-content').innerHTML='<p class="empty">No se pudo abrir el historial.</p>';}
};
q('history-close').onclick=()=>dialog.close();
dialog.onclose=()=>{dialogRev++;};
search.oninput=refreshList;
function refreshList(){
  const normalized=text=>text.toLocaleLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
  const value=normalized(search.value);
  const date=iso=>new Date(iso).toLocaleString('es-BO');
  const matches=list.filter(r=>normalized([r.title,r.scenario,r.date,date(r.date)].join(' ')).includes(value));
  q('history-content').innerHTML=matches.length?matches.map(r=>`
    <article class="history-row"><label><input type="checkbox" data-select="${r.id}" ${selected.has(r.id)?'checked':''}><span><b>${r.title}</b><small>${r.scenario} · ${escape(date(r.date))}</small></span></label>
    <div><button class="button" data-open="${r.id}">Abrir</button><button class="button" data-rerun="${r.id}">Relanzar</button></div></article>`).join(''):'<p class="empty">No hay corridas para esta búsqueda.</p>';
  q('history-content').querySelectorAll('[data-select]').forEach(el=>el.onchange=()=>{
    if(el.checked&&selected.size===2){el.checked=false;notify('Selecciona dos corridas para comparar');return;}
    if(el.checked)selected.add(el.dataset.select);else selected.delete(el.dataset.select);
    q('compare').disabled=selected.size!==2;q('comparison').hidden=true;dialogRev++;
  });
  q('history-content').querySelectorAll('[data-open],[data-rerun]').forEach(button=>button.onclick=()=>open(button.dataset.open??button.dataset.rerun,Boolean(button.dataset.rerun)));
}
async function open(id,rerun){
  try {
    const run=await loadRun(id);
    dialog.close();
    selectModule(run.module,run.scenario,run.params,rerun?null:run.result);
    if(rerun){s.pendingRun=true;s.replayReference=run.result;}
    else notify('Corrida recuperada');
  } catch{notify('No se pudo recuperar la corrida');}
}
q('compare').onclick=async()=>{
  const revision=++dialogRev;
  try {
    const runs=await Promise.all([...selected].map(loadRun));
    if(revision!==dialogRev)return;
    const box=q('comparison');box.hidden=false;
    box.innerHTML=`<h3>Comparación de corridas</h3><div class="comparison-grid">${runs.map(r=>`<article><b>${MODULES[r.module].title}</b><p>${r.scenario} · ${escape(new Date(r.date).toLocaleString('es-BO'))}</p>
    <details><summary>Parámetros de entrada</summary><pre>${escape(JSON.stringify(r.params,null,2))}</pre></details>
    <table><thead><tr><th>Método</th><th>Resultado</th><th>Error abs.</th><th>Residuo</th></tr></thead><tbody>${r.result.methods.map(m=>`<tr><td>${m.name}</td><td>${format(m.value,6)}</td><td>${format(m.metrics.abs,6)}</td><td>${format(m.metrics.res,6)}</td></tr>`).join('')}</tbody></table></article>`).join('')}</div>`;
    box.scrollIntoView({block:'nearest',behavior:reduced.matches?'instant':'smooth'});
  }catch{notify('No se pudo abrir la comparación');}
};

function animate(now){
  const frame=Math.min(0.06,(now-(lastFrame||now))/1000);
  lastFrame=now;
  if(s.playing&&s.result) {
    const fixed=1/120;
    accumulator+=frame;
    while(accumulator>=fixed){
      const playback=s.module==='solvers'?4:s.module==='wear'?1.7:1;
      s.t=Math.min(s.result.end,s.t+fixed*s.rate*playback);
      accumulator-=fixed;
      if(s.t>=s.result.end){accumulator=0;stop();break;}
    }
  } else accumulator=0;
  const p=s.params, r=s.result,t=s.t;
  const b=s.module==='brake'?brakeAt(p,t):{x:0,v:0};
  const wear=s.module==='wear'?p.initial+p.alpha*t+p.beta*t*t:0;
  const swing=s.module==='wind'&&r?r.samples.map(list=>sampleAt(list,t)[0]):null;
  scene.render({zoom:cameraLevels[cameraLevel],module:s.module,scenario:s.scenario,intro:s.intro,night:s.night,t,distance:b.x,speed:b.v,wear,limit:p.limit,swing,amplification:p.amplification,reduced:reduced.matches},frame);
  const tag=q('limit-tag'), projected=!s.intro&&s.module==='brake'?scene.track('limit'):null;
  tag.hidden=!projected?.visible;
  if(projected?.visible){tag.style.left=projected.x+'%';tag.style.top=projected.y+'%';}
  if(now-lastHud>66){lastHud=now;updateHud();updateRefinement();}
  requestAnimationFrame(animate);
}
selectModule('brake');
requestAnimationFrame(animate);
