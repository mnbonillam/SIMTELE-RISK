import {MODULES,TYPES} from '../../numerical_methods/models.js';
import {icon} from './icons.js';
import {CASES} from '../../numerical_methods/experiments.js';
const formatters=new Map();
function formatter(decimals){
  if(!formatters.has(decimals))formatters.set(decimals,new Intl.NumberFormat('es-BO',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}));
  return formatters.get(decimals);
}
export const format=(v,d=2)=>v==null?'—':Array.isArray(v)?'['+v.map(x=>format(x,d)).join(', ')+']':!Number.isFinite(v)?'—':v!==0&&(Math.abs(v)<0.001||Math.abs(v)>=1e6)?v.toExponential(2):formatter(d).format(v);
export const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(v,t=v)=>`<option value="${v}">${t}</option>`;
const nav=(key,i)=>`<button class="nav-item" data-module="${key}" aria-pressed="false"><span class="nav-icon">${icon(key)}</span><span>${MODULES[key].short}</span>${i!==undefined?`<small>0${i+1}</small>`:''}</button>`;
export function mount() {
  document.querySelector('#app').innerHTML=`
  <header class="topbar">
    <a class="brand" id="home-link" href="./" aria-label="SIMTELE-RISK, inicio"><span class="brand-symbol">${icon('logo',26)}</span><span>SIMTELE<span class="brand-risk">-RISK</span><small>LABORATORIO NUMÉRICO</small></span></a>
    <div class="course"><span>DAT 242 - COM 254</span><span>Métodos Numéricos · UMSA</span></div>
    <div class="top-actions">
      <button class="utility" id="error-mode" aria-pressed="false" title="Mostrar errores y residuos"><span class="switch"></span>Modo Error</button>
      <button class="utility icon-button" id="quality" aria-pressed="false" title="Calidad baja" aria-label="Calidad baja">${icon('layers')}</button>
      <button class="utility icon-button" id="night" aria-pressed="false" title="Alternar día y noche" aria-label="Modo nocturno">${icon('moon')}</button>
    </div>
  </header>
  <div class="shell">
    <aside class="rail" aria-label="Navegación">
      <div class="rail-main"><button class="nav-item" id="home-nav"><span class="nav-icon">${icon('logo')}</span>Inicio</button><p class="label">CASOS DE ESTUDIO</p><nav aria-label="Casos de estudio">${['brake','wear','wind','sensors'].map(nav).join('')}</nav>
      <p class="label rail-divider">HERRAMIENTAS AUXILIARES</p><nav aria-label="Herramientas auxiliares">${nav('solvers')}${nav('condition')}</nav>
      <p class="label rail-divider">REGISTRO</p><button class="nav-item" id="history"><span class="nav-icon">${icon('history')}</span>Historial</button></div>
      <div class="rail-foot"><span class="tiny-dot"></span><span>Datos sintéticos<small>Modelo educativo</small></span></div>
    </aside>
    <main id="workspace">
      <section class="home-band" id="lab-home" aria-labelledby="home-title">
        <div class="panel-head"><div><p class="label">LABORATORIO · DAT 242 - COM 254</p><h2 id="home-title">Elige un caso de estudio</h2></div><button class="button" id="global-compare">${icon('solvers',16)} Comparar escenarios</button></div>
        <div class="home-cards">${CASES.map((key,i)=>`<button class="home-card panel" data-case="${key}"><span class="tile-icon">${icon(key)}</span><span><strong>${MODULES[key].short}</strong><small>${['Tiempo y distancia de frenado','Umbral y coeficientes','Oscilación e integración','Interpolación y ruido'][i]}</small></span>${icon('arrow',16)}</button>`).join('')}</div>
      </section>
      <div class="page-title">
        <div><div class="breadcrumb" id="breadcrumb"></div><h1 id="module-title"></h1><p id="module-subtitle"></p></div>
        <div class="scenario-wrap"><label class="label" for="scenario">ESCENARIO</label><div class="select-wrap"><span class="scenario-dot"></span><select id="scenario">${TYPES.map(t=>option(t)).join('')}</select>${icon('chevron',16)}</div></div>
      </div>
      <div class="work-grid">
        <section class="viewport panel" aria-label="Escena tridimensional del valle">
          <div class="stage" id="stage">
            <div class="stage-vignette"></div>
            <div class="stage-top"><span class="stage-label"><span class="live-dot"></span> VISTA 3D</span><span class="stage-location">VALLE ANDINO <i></i> LA PAZ, BOLIVIA</span></div>
            <div class="intro" id="intro"><span class="label">UMSA · INFORMÁTICA · DAT 242 - COM 254</span><div>SIMTELE<span>-RISK</span></div><button type="button" id="enter" class="primary">Entrar al laboratorio ${icon('arrow',16)}</button></div>
            <div class="stage-module" id="stage-module" hidden></div>
            <div class="scene-tag" id="limit-tag">LÍMITE · 150 m</div>
            <div class="stage-bottom"><span>${icon('point',15)} <span id="camera-label">CÁMARA DE SEGUIMIENTO</span></span><span id="scene-state">EN ESPERA</span></div>
          </div>
          <div class="transport" aria-label="Reproducción">
            <button class="transport-btn" id="play" aria-label="Reproducir" title="Reproducir">${icon('play')}</button>
            <button class="transport-btn secondary" id="reset-time" aria-label="Reiniciar tiempo" title="Reiniciar tiempo">${icon('reset',17)}</button>
            <span class="clock" id="time-code">00.00 s</span>
            <input class="timeline" id="timeline" type="range" min="0" max="1" step="0.001" value="0" aria-label="Barra de tiempo">
            <span class="clock end-clock" id="time-end">00.00 s</span>
            <label class="rate"><span class="sr-only">Velocidad de reproducción</span><select id="rate">${[0.25,0.5,1,2,4,8].map(n=>option(n,n+'×')).join('')}</select></label>
          </div>
        </section>
        <aside class="panel config" aria-label="Configuración del modelo" id="config"></aside>
      </div>
      <div class="panel replay-check" id="replay-check" role="status" hidden></div>
      <div class="metrics" id="metrics" aria-label="Telemetría"></div>
      <div class="analysis-grid">
        <section class="panel chart-panel" id="chart-holder" aria-labelledby="chart-title">
          <div class="panel-head"><div><p class="label" id="chart-caption">ANÁLISIS DEL MODELO</p><h2 id="chart-title"></h2></div><div id="chart-tools"></div></div>
          <div class="chart-legend" id="legend"></div>
          <svg id="chart" viewBox="0 0 840 230" preserveAspectRatio="none" role="group" aria-label="Gráfico del modelo"></svg>
          <div class="chart-note" id="chart-note" hidden></div>
        </section>
        <aside class="panel results" id="results" aria-label="Resultados numéricos"></aside>
      </div>
      <div class="evidence-grid" id="evidence"></div>
      <div class="disclaimer">${icon('info',16)} Datos sintéticos con fines educativos. No representan instalaciones reales ni datos operativos de Mi Teleférico.</div>
    </main>
  </div>
  <dialog id="history-dialog" aria-labelledby="history-title"><div class="dialog-head"><div><p class="label">REGISTRO LOCAL</p><h2 id="history-title">Historial de simulaciones</h2></div><button id="history-close" class="utility icon-button" aria-label="Cerrar historial">${icon('close')}</button></div><div class="history-tools"><label class="sr-only" for="history-search">Buscar corrida</label><input id="history-search" type="search" placeholder="Buscar por caso, escenario o fecha"><button id="compare" class="button" disabled>Comparar selección</button></div><div id="history-content"></div><div id="comparison" hidden></div></dialog>
  <dialog id="presets-dialog" aria-labelledby="presets-title"><div class="dialog-head"><div><p class="label">EXPERIMENTOS REPRODUCIBLES</p><h2 id="presets-title">Comparación de escenarios</h2></div><button id="presets-close" class="utility icon-button" aria-label="Cerrar comparación">${icon('close')}</button></div>
    <div class="history-tools"><p class="chart-note">Valores con parámetros predeterminados de cada escenario.</p><select id="presets-filter" aria-label="Caso de estudio"></select></div><div id="presets-output" aria-live="polite"></div></dialog>
  <div id="toast" class="toast" role="status" hidden></div>`;
  document.querySelector('#rate').value='1';
}
export const controls = {
  brake:[['v0','Velocidad inicial','m/s',2,16,0.1,'v₀'],['a','Desaceleración','m/s²',0.4,2.5,0.05,'a'],['reaction','Tiempo de reacción','s',0,4,0.1,'tᵣ']],
  wear:[['initial','Deterioro inicial','',0,0.5,0.01,'D₀'],['alpha','Tasa lineal','mes⁻¹',0.005,0.05,0.001,'α'],['beta','Tasa cuadrática','mes⁻²',0.0005,0.007,0.0001,'β'],['limit','Umbral de inspección','',0.2,0.8,0.01,'Dᵤ']],
  wind:[['force','Fuerza sinusoidal','N',0,40,1,'F'],['c','Amortiguamiento','N·s/m',5,120,1,'c'],['omega','Frecuencia de viento','rad/s',0.2,4,0.05,'ω'],['step','Paso temporal','s',0.05,0.9,0.01,'h'],['m','Masa equivalente','kg',180,450,5,'m'],['k','Rigidez','N/m',500,1800,10,'k']],
  sensors:[['noise','Ruido de muestra','',0,0.3,0.005,'σ'],['count','Cantidad de nodos','',3,15,1,'n']],
  solvers:[['max','Máximo de iteraciones','',1,160,1,'kₘₐₓ']],
  condition:[['logE','Distancia a la singularidad','',-7,-1,0.05,'ε']]
};
export const sliderText=(key,v,step)=>{
  if(key==='logE')return (10**v).toExponential(2);
  const places=step.toString().split('.')[1]?.length??0;
  return format(v,places);
};

export function configMarkup(state) {
  const {module:m,params:p}=state;
  const fieldMarkup=controls[m].map(([key,title,unit,min,max,step,symbol])=>`
   <div class="control"><label for="param-${key}" title="${title} (${symbol})">${title}</label><output for="param-${key}" id="out-${key}">${sliderText(key,p[key],step)}${unit?' <small>'+unit+'</small>':''}</output>
   <input id="param-${key}" data-param="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${p[key]}" style="--progress:${(p[key]-min)/(max-min)*100}%"></div>`);
  const fields=(m==='wind'?fieldMarkup.slice(0,4):fieldMarkup).join('');
  const physicalFields=m==='wind'?'<details class="wind-model"><summary>Masa y rigidez</summary>'+fieldMarkup.slice(4).join('')+'</details>':'';
  const extra={
    brake:`<div class="config-note">${icon('info',15)} <span>El límite didáctico es <b>150 m</b> desde la orden de frenado.</span></div>`,
    wear:`<div class="config-note">${icon('info',15)} <span>En estrés, β aumenta y el umbral se alcanza antes.</span></div>`,
    wind:`<button class="inline-button" id="resonance">${icon('wind',15)} Ajustar cerca de resonancia</button>`,
    sensors:`<label class="check"><input type="checkbox" id="runge" ${p.runge?'checked':''}> Demostración de Runge</label><button class="inline-button" id="reset-nodes">${icon('reset',15)} Restablecer nodos</button>`,
    solvers:`<label class="compact-select">Tolerancia relativa<select id="solver-tolerance">${[1e-8,1e-10,1e-12,1e-14].map(x=>`<option ${p.tolerance===x?'selected':''} value="${x}">${x}</option>`).join('')}</select></label>`,
    condition:`<div class="config-note">${icon('info',15)} <span>Δb = (+10⁻⁶, −10⁻⁶, 0, 0). Efecto matemático del sistema auxiliar.</span></div>`
  }[m];
  const primary={brake:'Frenar',wear:'Simular deterioro',wind:'Simular viento',sensors:'Reproducir señal',solvers:'Iniciar carrera',condition:'Aplicar perturbación'}[m];
  return `<div class="config-head"><span class="tile-icon">${icon('settings',18)}</span><div><h2>Parámetros</h2><p>MODELO DE SIMULACIÓN</p></div></div>
    <div class="model-formula">${MODULES[m].equation}</div><div class="fields">${fields}${extra}${physicalFields}</div>
    <div class="config-actions"><button id="run" class="primary">${icon(m==='brake'?'brake':'play',17)} ${primary}</button>
    <button id="slow" class="button" ${m!=='brake'?'hidden':''} aria-pressed="${state.rate===0.25}">Cámara lenta</button>
    <button id="reset-params" type="button" class="subtle">${icon('reset',14)} Restablecer valores</button></div>`;
}

export const titles={
  brake:['Perfil de velocidad','Velocidad (m/s) · tiempo desde la orden de frenado (s)'],
  wear:['Curva de deterioro','D(t) adimensional · tiempo (meses)'],
  wind:['Respuesta al viento','Desplazamiento lateral (m) · tiempo (s)'],
  sensors:['Reconstrucción de la señal','Ordenada adimensional · tiempo (rad en sen(t))'],
  solvers:['Convergencia por iteración','log₁₀ ‖b − Ax‖∞ · iteración'],
  condition:['Sensibilidad de la solución','log₁₀ κ₂ · log₁₀ ε']
};
