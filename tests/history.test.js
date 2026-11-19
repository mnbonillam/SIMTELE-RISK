import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {saveRun,listRuns,loadRun} from '../database/history.js';
import {defaults,calculate} from '../numerical_methods/models.js';

test('DER: corridas distintas, recuperación completa y cálculo reproducible',async()=>{
  const module='wear', scenario='NORMAL', params=defaults(module,scenario), result=calculate(module,params);
  const runs=await Promise.all([saveRun({module,scenario,params,result}),saveRun({module,scenario,params,result})]);
  assert.notEqual(...runs);
  const listed=await listRuns();
  assert.equal(listed.length,2);
  assert.equal(listed[0].title,'Deterioro mecánico');
  const r=await loadRun(runs[0]);
  assert.deepEqual(r.params,params);
  assert.deepEqual(r.result,result);
  const recalculated=calculate(r.module,r.params);
  assert.equal(recalculated.inspection,r.result.inspection);
  assert.deepEqual(recalculated.methods.map(x=>x.rows),r.result.methods.map(x=>x.rows));
  const req=indexedDB.open('simtele-risk',1);
  const database=await new Promise(resolve=>{req.onsuccess=()=>resolve(req.result);});
  assert.deepEqual(Array.from(database.objectStoreNames),['caso_estudio','ejecucion_metodo','escenario','iteracion_resultado','resultado_resumen','simulacion']);
  database.close();
  await assert.rejects(loadRun('no-existe'),/No se encontró/);
});
