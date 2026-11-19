import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES,comparePresets} from '../numerical_methods/experiments.js';
import {TYPES} from '../numerical_methods/models.js';

test('Se ejecutan 12 escenarios con resultados y sensibilidad reproducibles',()=>{
  for(const module of CASES){
    const runs=comparePresets(module);
    assert.deepEqual(runs.map(r=>r.scenario),TYPES);
    for(const run of runs){
      assert.ok(Number.isFinite(run.indicator));
      assert.ok(run.sensitivity.delta>0);
      assert.ok(run.result.methods.length>=3);
    }
    if(module==='sensors')assert.ok(runs[2].sensitivity.gain>runs[0].sensitivity.gain*10);
    else assert.equal(runs[2].sensitivity.linked.kappa,1999);
  }
});

test('El verificador distingue una corrida reproducible de una discrepancia numérica',async()=>{
  const {verifyReplay}=await import('../numerical_methods/experiments.js');
  const [normal]=comparePresets('wear');
  const original=normal.result, altered=structuredClone(original);
  assert.deepEqual(verifyReplay(original,original),{verified:7,total:7,sameCurves:true,tolerance:1e-10});
  altered.methods[0].rows[0].value+=0.001;
  altered.lines[0].points[0][1]+=0.001;
  const check=verifyReplay(original,altered);
  assert.equal(check.verified,6);
  assert.equal(check.sameCurves,false);
});
