import {MODEL_VERSION,MODULES} from '../numerical_methods/models.js';

const tables=['caso_estudio','escenario','simulacion','ejecucion_metodo','iteracion_resultado','resultado_resumen'];
let opening;
function database() {
  if (opening) return opening;
  opening=new Promise((resolve,reject)=>{
    const req=indexedDB.open('simtele-risk',1);
    req.onupgradeneeded=()=>{
      for(const name of tables) req.result.createObjectStore(name,{keyPath:'id'});
      req.transaction.objectStore('escenario').createIndex('caso_id','caso_id');
      req.transaction.objectStore('simulacion').createIndex('fecha','fecha');
      req.transaction.objectStore('simulacion').createIndex('escenario_id','escenario_id');
      req.transaction.objectStore('ejecucion_metodo').createIndex('simulacion_id','simulacion_id');
      req.transaction.objectStore('iteracion_resultado').createIndex('ejecucion_id','ejecucion_id');
      req.transaction.objectStore('resultado_resumen').createIndex('ejecucion_id','ejecucion_id',{unique:true});
    };
    req.onsuccess=()=>{
      req.result.onversionchange=()=>{req.result.close();opening=null;};
      resolve(req.result);
    };
    req.onerror=()=>{opening=null;reject(req.error);};
  });
  return opening;
}
const read=req=>new Promise((resolve,reject)=>{
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
});
export async function saveRun({module,scenario,params,result}) {
  const db=await database();
  const id=globalThis.crypto?.randomUUID?.()??Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const scenarioId=id+'-esc';
  const tx=db.transaction(tables,'readwrite');
  const done=new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve(id);
    tx.onabort=()=>reject(tx.error??new Error('No se pudo guardar la corrida'));
  });
  tx.objectStore('caso_estudio').put({id:module,nombre:MODULES[module].title,modelo_version:MODEL_VERSION});
  tx.objectStore('escenario').add({id:scenarioId,caso_id:module,tipo:scenario,parametros_json:params,fuente_datos:'Sintéticos'});
  const {methods,timeMs,...visual}=result;
  tx.objectStore('simulacion').add({id,escenario_id:scenarioId,fecha:new Date().toISOString(),estado:'calculada',tiempo_ms:timeMs,visual});
  methods.forEach((m,i)=>{
    const eid=id+'-'+i;
    tx.objectStore('ejecucion_metodo').add({id:eid,simulacion_id:id,orden:i,metodo:m.name,tolerancia:m.tolerance,paso:m.step,criterio:m.criterion??null,max_iter:m.max,convergio:m.converged,tiempo_ms:m.timeMs??null});
    m.rows.forEach((row,j)=>tx.objectStore('iteracion_resultado').add({
      id:eid+'-'+j,ejecucion_id:eid,numero:row.k,aproximacion_json:row.value,residual:row.res??null,
      error_abs:row.abs??null,error_rel:row.rel??null,datos_json:row
    }));
    tx.objectStore('resultado_resumen').add({id:eid,ejecucion_id:eid,referencia:m.reference,valor_json:m.value,metrica_error_json:m.metrics,interpretacion:m.interpretation});
  });
  return done;
}

export async function listRuns() {
  const db=await database(), tx=db.transaction(['simulacion','escenario','caso_estudio']);
  const [runs,scenarios,cases]=await Promise.all(tables.slice(0,3).reverse().map(name=>read(tx.objectStore(name).getAll())));
  const scenariosById=new Map(scenarios.map(r=>[r.id,r]));
  const casesById=new Map(cases.map(r=>[r.id,r]));
  return runs.map(run=>{
    const s=scenariosById.get(run.escenario_id), c=casesById.get(s.caso_id);
    return {id:run.id,date:run.fecha,module:c.id,title:c.nombre,scenario:s.tipo,params:s.parametros_json};
  }).sort((a,b)=>b.date.localeCompare(a.date));
}

export async function loadRun(id) {
  const db=await database();
  const parent=db.transaction('simulacion');
  const run=await read(parent.objectStore('simulacion').get(id));
  if(!run) throw new Error('No se encontró la corrida');
  const tx=db.transaction(['escenario','ejecucion_metodo']);
  const [s,exec]=await Promise.all([
    read(tx.objectStore('escenario').get(run.escenario_id)),
    read(tx.objectStore('ejecucion_metodo').index('simulacion_id').getAll(id))
  ]);
  const child=db.transaction(['iteracion_resultado','resultado_resumen']);
  const methods=await Promise.all(exec.sort((a,b)=>a.orden-b.orden).map(async m=>{
    const [iterations,summary]=await Promise.all([
      read(child.objectStore('iteracion_resultado').index('ejecucion_id').getAll(m.id)),
      read(child.objectStore('resultado_resumen').get(m.id))
    ]);
    return {name:m.metodo,rows:iterations.sort((a,b)=>a.numero-b.numero).map(i=>i.datos_json),tolerance:m.tolerancia,step:m.paso,max:m.max_iter,
      converged:m.convergio,reference:summary.referencia,value:summary.valor_json,metrics:summary.metrica_error_json,interpretation:summary.interpretacion,criterion:m.criterio??null,timeMs:m.tiempo_ms};
  }));
  return {id,date:run.fecha,module:s.caso_id,scenario:s.tipo,params:s.parametros_json,result:{...run.visual,methods,timeMs:run.tiempo_ms}};
}
