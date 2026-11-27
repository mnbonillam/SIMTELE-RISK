import {errors, integrateODE, rkStep, root, solveIterative, lu, residual, matvec, lagrange, spline, newtonInterpolation, quadrature} from './numerics.js';

export const MODEL_VERSION = '1.1.0';
export const TYPES = ['NORMAL', 'ESTRÉS', 'MAL CONDICIONADO'];
export const MODULES = {
  brake: {title:'Detención de emergencia', short:'Detención', subtitle:'Cinemática de frenado con desaceleración constante.', equation:'dv/dt = −a    ·    dx/dt = v', unit:'s'},
  wear: {title:'Deterioro mecánico', short:'Deterioro', subtitle:'Localiza el cruce del umbral de inspección.', equation:'D(t) = D₀ + αt + βt²', unit:'meses'},
  wind: {title:'Oscilaciones por viento', short:'Viento', subtitle:'Explora el amortiguamiento, la resonancia y el paso temporal.', equation:'mx″ + cx′ + kx = F sen(ωt)', unit:'s'},
  sensors: {title:'Reconstrucción de sensores', short:'Sensores', subtitle:'Recupera lecturas perdidas de tensión cerca del paso simulado de una cabina.', equation:'T(t) = 40 + 12 exp[−((t − 6)/1,6)²]', unit:'s'},
  solvers: {title:'Carrera de solvers', short:'Solvers', subtitle:'Observa cómo cae el residuo del sistema SPD 4 × 4.', equation:'Ax = b    ·    ‖b − Ax‖∞ ≤ τ max(1, ‖b‖∞)', unit:'iter'},
  condition: {title:'Mal condicionamiento', short:'Condicionamiento', subtitle:'Mide cómo una perturbación se amplifica cerca de la singularidad.', equation:'κ₂(A) = (2 − ε) / ε', unit:''}
};

export function defaults(module, scenario) {
  const stress = scenario === 'ESTRÉS';
  const ill = scenario === 'MAL CONDICIONADO';
  return {
    brake: {v0:stress ? 12 : 10, a:stress ? 0.4 : 0.8, reaction:0, step:stress ? 0.5 : 0.25, tolerance:1e-10},
    wear: {initial:0.1, alpha:0.015, beta:stress ? 0.002 : 0.001, limit:0.4, tolerance:1e-10},
    wind: {m:250, c:stress ? 14 : 40, k:1000, force:stress ? 18 : 0, omega:stress ? 2 : 1.25, step:stress ? 0.65 : 0.12, amplification:10},
    sensors: {tension:true, gap:stress?2:1, noise:stress?0.12:0, runge:false, clustered:ill, count:ill?11:9, edits:{}},
    solvers: {tolerance:stress ? 1e-12 : 1e-10, max:100},
    condition: {logE:stress ? -4 : -3}
  }[module];
}

export function brakeAt(p, t) {
  t = Math.max(0, t);
  const tb = Math.min(p.v0 / p.a, Math.max(0, t - p.reaction));
  return {x:p.v0 * (Math.min(t, p.reaction) + tb) - p.a * tb ** 2 / 2, v:Math.max(0, p.v0 - p.a * tb)};
}

const linspace = (a, b, n) => Array.from({length:n+1}, (_, i) => a + (b - a) * i / n);
const series = (name, points) => ({name, points});
function method(name, rows, options = {}) {
  const {tolerance = null, step = null, max = null, timeMs = null, converged = null, reference = null, criterion = null, interpretation = '', value = rows.at(-1)?.value ?? null, metrics = rows.at(-1) ?? {}} = options;
  return {name, rows, tolerance, step, max, timeMs, converged, reference, criterion, interpretation, value, metrics};
}

const rootNames = ['Bisección','Secante','Newton-Raphson'];
function roots(f, derivative, left, right, tolerance, reference) {
  return rootNames.map(name=>{
    const start=performance.now();
    const r=root(name,f,derivative,left,right,tolerance,reference);
    return method(name,r.rows,{reference,tolerance,max:100,timeMs:performance.now()-start,converged:r.converged,
      criterion:`|f(t)| ≤ ${tolerance}. ${name==='Bisección'?'Intervalo':name==='Secante'?'Semillas':'Semilla derecha'}: ${name==='Newton-Raphson'?right:`[${left}, ${right}]`}.`});
  });
}
function quadratureMethods(area, reference, unit, span, timeMs) {
  return Object.entries(area).map(([name,list])=>{
    const rows=list.map((row,i)=>({...row,res:i?Math.abs(row.value-list[i-1].value):null,...errors(row.value,reference)}));
    return method(name,rows,{timeMs,step:span/list.at(-1).n,reference,
      criterion:`Refinamiento hasta n = ${list.at(-1).n}. Residuo: diferencia entre niveles sucesivos. Resultado en ${unit}.`});
  });
}
export function braking(p) {
  const end=p.reaction+p.v0/p.a, distance=brakeAt(p,end).x;
  const sampleSets=[];
  const methods=[4,2].map(order=>{
    const started=performance.now();
    const samples=[{t:0,y:[0,p.v0]}];
    let t=0,state=samples[0].y;
    while(t<end-1e-10){
      const reacting=t<p.reaction-1e-10;
      const next=Math.min(reacting?p.reaction:end,t+p.step);
      state=rkStep(order,(_,[x,v])=>[v,reacting?0:-p.a],t,state,next-t);
      t=next;
      samples.push({t,y:state});
    }
    sampleSets.push(samples);
    const rows=samples.map(({t,y},k)=>{
      const prev=samples[k-1], acceleration=prev?.t<p.reaction-1e-10?0:-p.a;
      const defect=prev?Math.abs((y[1]-prev.y[1])/(t-prev.t)-acceleration):0;
      return {k,t,value:y[0],velocity:y[1],res:defect,...errors(y[0],brakeAt(p,t).x)};
    });
    return method(order===4?'RK4':'RK2 punto medio',rows,{step:p.step,timeMs:performance.now()-started,reference:distance,
      criterion:'Hasta v = 0. Los pasos se dividen en el instante de reacción; defecto de la ecuación de velocidad.'});
  });
  const reactionDistance=p.v0*p.reaction, brakingDistance=p.v0**2/(2*p.a);
  const areaStart=performance.now();
  // Split at the change of acceleration so Simpson/Romberg do not straddle the corner.
  const area=quadrature(t=>p.v0-p.a*t,0,p.v0/p.a,9);
  for(const list of Object.values(area))for(const row of list){
    row.value+=reactionDistance;
    if(row.row)row.row=row.row.map(v=>v+reactionDistance);
  }
  methods.push(...quadratureMethods(area,distance,'m',p.v0/p.a,performance.now()-areaStart));
  const extended=t=>p.v0-p.a*(t-p.reaction);
  methods.push(...roots(extended,()=>-p.a,p.reaction,p.reaction+2*p.v0/p.a,p.tolerance??1e-10,end));
  return {end,distance,reactionDistance,brakingDistance,samples:sampleSets[0],methods,
    lines:[series('Velocidad',linspace(0,end,180).map(t=>[t,brakeAt(p,t).v]))]};
}

export function deterioration(p) {
  const curve = t => p.initial + p.alpha * t + p.beta * t * t;
  const gap = p.limit - p.initial;
  const inspection = gap <= 0 ? 0 : 2 * gap / (p.alpha + Math.sqrt(p.alpha ** 2 + 4 * p.beta * gap));
  const end = Math.max(16, inspection * 1.4);
  const rootMethods=gap<=0?rootNames.map(name=>method(name,[],{reference:0,value:0,interpretation:'Umbral alcanzado desde el inicio.'})):
    roots(t=>curve(t)-p.limit,t=>p.alpha+2*p.beta*t,0,end,p.tolerance,inspection);
  const coefficientScale=[1,10,100,1000];
  const expected=[p.initial,10*p.alpha,100*p.beta,0];
  const calibration=linearMethods(matvec(A,expected),expected,p.tolerance,100,'Calibración auxiliar SPD sobre coeficientes escalados [D₀, 10α, 100β, 1000γ], con γ de referencia igual a cero.');
  return {end,inspection,methods:[...rootMethods,...calibration],coefficientScale,
    lines:[series('Deterioro D(t)',linspace(0,end,160).map(t=>[t,curve(t)])),series('Umbral',[[0,p.limit],[end,p.limit]])],
    markers:rootMethods.map(m=>series(m.name,m.rows.map(row=>[row.value,curve(row.value)])))};
}

export function exactWind(p, t) {
  const gamma = p.c / (2 * p.m), wn2 = p.k / p.m, q = p.omega;
  // Particular A sin(qt) + B cos(qt).
  const delta = p.k - p.m * q*q, damping = p.c * q, den = delta*delta + damping*damping;
  const A = p.force ? p.force * delta / den : 0, B = p.force ? -p.force * damping / den : 0;
  const u = 0.05 - B, v = -A*q, disc = wn2 - gamma*gamma;
  const C = v + gamma*u, decay = Math.exp(-gamma*t);
  let free, speed;
  if (Math.abs(disc) < 1e-10) {
    free = u + C*t; speed = C;
  } else if (disc > 0) {
    const w = Math.sqrt(disc);
    free = u*Math.cos(w*t) + C*Math.sin(w*t)/w;
    speed = -w*u*Math.sin(w*t) + C*Math.cos(w*t);
  } else {
    const w = Math.sqrt(-disc);
    free = u*Math.cosh(w*t) + C*Math.sinh(w*t)/w;
    speed = w*u*Math.sinh(w*t) + C*Math.cosh(w*t);
  }
  return [decay*free + A*Math.sin(q*t)+B*Math.cos(q*t), decay*(speed-gamma*free)+q*(A*Math.cos(q*t)-B*Math.sin(q*t))];
}

export function sampleAt(samples, t) {
  let l = 0, r = samples.length - 1;
  if (t <= 0) return samples[l].y;
  if (t >= samples[r].t) return samples[r].y;
  while (r - l > 1) {
    const i = (l + r) >> 1;
    if (samples[i].t <= t) l = i; else r = i;
  }
  const a = samples[l], b = samples[r], f = (t-a.t)/(b.t-a.t);
  return a.y.map((v,i)=>v+(b.y[i]-v)*f);
}

export function wind(p) {
  const end = 20, initial = [0.05,0];
  const acceleration = (t,x,v) => (p.force*Math.sin(p.omega*t)-p.c*v-p.k*x)/p.m;
  const exact = linspace(0,end,500).map(t=>({t,y:exactWind(p,t)}));
  const durations = [];
  const samples = [2,4].map(order=>{
    const start = performance.now();
    const output = integrateODE(order,(t,[x,v])=>[v,acceleration(t,x,v)],initial,end,p.step);
    durations.push(performance.now()-start);
    return output;
  });
  const methods = samples.map((list, i) => {
    const rows = list.map(({t,y}, k) => {
      const prev = list[k-1];
      const defect = prev ? Math.abs((y[1]-prev.y[1])/(t-prev.t) - acceleration((t+prev.t)/2,(y[0]+prev.y[0])/2,(y[1]+prev.y[1])/2)) : 0;
      return {k,t,value:y[0],velocity:y[1],res:defect,...errors(y[0],exactWind(p,t)[0])};
    });
    return method(i ? 'RK4' : 'RK2 punto medio',rows,{step:p.step,timeMs:durations[i],reference:exact.at(-1).y[0],criterion:'Paso fijo con último paso ajustado a t = 20 s; defecto discreto de la aceleración.'});
  });
  const magnitude = t=>Math.abs(exactWind(p,t)[0]);
  const areaStart=performance.now(), area=quadrature(magnitude,0,end,9);
  // Independent reference: composite Simpson on two fine grids.
  const areaReference=quadrature(magnitude,0,end,15).Simpson.at(-1).value;
  methods.push(...quadratureMethods(area,areaReference,'m·s',end,performance.now()-areaStart));
  return {end,area,methods,samples:[...samples,exact],peak:Math.max(...exact.map(({y})=>Math.abs(y[0]))),natural:Math.sqrt(p.k/p.m),ratio:p.c/(2*Math.sqrt(p.k*p.m)),
    lines:[series('Analítica',exact.map(({t,y})=>[t,y[0]])),...samples.map((s,i)=>series(i?'RK4':'RK2',s.map(({t,y})=>[t,y[0]])))]};
}

export function sensorSignal(params,t){
  if(params.runge)return 1/(1+25*t*t);
  if(params.tension)return 40+12*Math.exp(-(((t-6)/1.6)**2));
  return Math.sin(t);
}

export function sensors(p) {
  const tension=p.tension&&!p.runge;
  const a=p.runge?-1:0, b=p.runge?1:tension?12:Math.PI;
  const gap=tension?[6-(p.gap??1),6+(p.gap??1)]:null;
  const signal=t=>sensorSignal(p,t);
  const split=Math.floor(p.count/2);
  const locations=gap?[
    ...Array.from({length:split},(_,i)=>gap[0]*(i/(split-1||1))**(p.clustered?4:1)),
    ...linspace(gap[1],b,p.count-split-1)
  ]:linspace(a,b,p.count-1).map(x=>p.clustered?a+(b-a)*((x-a)/(b-a))**2:x);
  const nodes=locations.map((x,i)=>{
    const position=p.edits[i]?.[0]??x;
    return [position,signal(position)+(p.edits[i]?.[1]??0)+p.noise*Math.sin(91*i+0.6)];
  });
  const test=gap?[6, ...linspace(gap[0],gap[1],8).slice(1,-1).filter(x=>x!==6)]:
    p.clustered?linspace(a,b,44).slice(1,-1).filter(x=>nodes.every(([u])=>Math.abs(u-x)>1e-8)):
    linspace(a,b,2*(p.count-1)).filter((_,i)=>i%2);
  const hidden=test.filter(x=>!gap||nodes.every(([u])=>Math.abs(u-x)>1e-8));
  if(!hidden.length)hidden.push(6);
  const fit = [['Lagrange',lagrange(nodes)],['Spline cúbico',spline(nodes)],['Newton interpolante',newtonInterpolation(nodes)]];
  const methods = fit.map(([name,f])=> {
    const nodeResidual = Math.max(...nodes.map(([x,y])=>Math.abs(f(x)-y)));
    const rows = hidden.map((t,k)=>({k,t,value:f(t),res:nodeResidual,...errors(f(t),signal(t))}));
    const query = rows[0];
    return method(name,rows,{value:query.value,reference:signal(query.t),metrics:query,criterion:'Interpolación directa en los nodos comunes. Error en muestras ocultas; residuo máximo en nodos.'});
  });
  const bias=[0.01,-0.02,0.03,0.005];
  const calibration=linearMethods(matvec(A,bias),bias,1e-10,100,'Calibración auxiliar SPD de cuatro sesgos sintéticos conocidos; la interpolación se evalúa aparte sobre los nodos del experimento.');
  return {end:b-a,a,b,nodes,test:hidden,gap,unit:tension?'kN':'',timeUnit:tension?'s':p.runge?'':'rad',methods:[...methods,...calibration],
    lines:[series(p.runge?'Runge':tension?'Tensión de referencia':'sen(t)',linspace(a,b,280).map(t=>[t,signal(t)])),...fit.map(([name,f])=>series(name,linspace(a,b,280).map(t=>[t,f(t)])))]};
}

export const A = [[10,-1,2,0],[-1,11,-1,3],[2,-1,10,-1],[0,3,-1,8]];
export const b = [6,25,-11,15];
export const xExact = [1,2,-1,1];
function linearMethods(rhs,reference,tolerance,max,interpretation='') {
  const methods=['Jacobi','Gauss-Seidel','CG'].map(name=>{
    const start=performance.now(), r=solveIterative(name,A,rhs,tolerance,max,reference);
    return method(name,r.rows,{tolerance,max,timeMs:performance.now()-start,converged:r.converged,reference,interpretation,
      criterion:`‖b − Ax‖∞ ≤ ${r.threshold.toExponential(3)}; inicio x = 0.`});
  });
  const start=performance.now(), direct=lu(A,rhs);
  methods.push(method('LU',[],{value:direct,timeMs:performance.now()-start,reference,interpretation,
    criterion:'Método directo con pivoteo parcial.',metrics:{res:residual(A,rhs,direct),...errors(direct,reference)}}));
  return methods;
}
export function solvers(p) {
  const methods=linearMethods(b,xExact,p.tolerance,p.max);
  return {end:Math.max(...methods.map(m=>m.rows.at(-1)?.k??0)),methods,threshold:p.tolerance*25,
    lines:methods.slice(0,3).map(m=>series(m.name,m.rows.map(r=>[r.k,Math.log10(Math.max(1e-16,r.res))])))};
}

export function conditioning(p) {
  const epsilon = 10 ** p.logE, rho = 1 - epsilon, kappa = (2-epsilon)/epsilon;
  const matrix = [[1,rho,0,0],[rho,1,0,0],[0,0,1,rho],[0,0,rho,1]];
  const original = Array(4).fill(2-epsilon), perturbation = [1e-6,-1e-6,0,0];
  const perturbed = original.map((v,i)=>v+perturbation[i]), reference = [1,1,1,1], x = lu(matrix,perturbed);
  const bRel = Math.hypot(...perturbation)/Math.hypot(...original);
  const xRel = Math.hypot(...x.map(v=>v-1))/2;
  const metrics = {res:residual(matrix,perturbed,x),...errors(x,reference)};
  return {end:10,epsilon,kappa,x,bRel,xRel,gain:xRel/bRel, perturbation,matrix,
    methods:[method('LU perturbado',[],{value:x,reference,metrics,interpretation:'Sensibilidad matemática del sistema SPD auxiliar.'})],
    lines:[series('log₁₀ κ₂',linspace(-7,-1,120).map(log=>[log,Math.log10((2-10**log)/(10**log))]))],markers:[series('κ₂ actual',[[p.logE,Math.log10(kappa)]])]};
}

const calc = {brake:braking, wear:deterioration, wind, sensors, solvers, condition:conditioning};
export function calculate(module, params) {
  const start = performance.now();
  const output = calc[module](params);
  return {...output, timeMs:performance.now()-start};
}
