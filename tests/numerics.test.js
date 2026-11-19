import test from 'node:test';
import assert from 'node:assert/strict';
import {A,b,xExact,defaults,calculate,brakeAt,exactWind} from '../numerical_methods/models.js';
import {errors,lu,matvec,residual,lagrange,spline,quadrature} from '../numerical_methods/numerics.js';

const near=(value,expected,tolerance)=>assert.ok(Math.abs(value-expected)<=tolerance,`${value} ≠ ${expected} ± ${tolerance}`);

test('Informe §3: las dos referencias de detención y el segmento de reacción',()=>{
  const n=calculate('brake',defaults('brake','NORMAL'));
  const e=calculate('brake',defaults('brake','ESTRÉS'));
  assert.deepEqual([n.end,n.distance,e.end,e.distance],[12.5,62.5,30,180]);
  const params={...defaults('brake','NORMAL'),reaction:1.15};
  const r=calculate('brake',params);
  assert.deepEqual(brakeAt(params,1),{x:10,v:10});
  near(r.distance,74,1e-12);
  near(r.methods[0].value,74,1e-10);
  near(r.samples.at(-1).y[1],0,1e-10);
});

test('Informe §2.2: los tres métodos llegan a 11,3746 y a 9,0587 meses',()=>{
  for(const [scenario,expected] of [['NORMAL',11.3746],['ESTRÉS',9.0587]]){
    const r=calculate('wear',defaults('wear',scenario));
    near(r.inspection,expected,5e-5);
    for(const m of r.methods){
      near(m.value,r.inspection,1e-8);
      assert.ok(m.converged);
      assert.ok(m.metrics.res<=1e-10);
    }
  }
  assert.equal(calculate('wear',{...defaults('wear','NORMAL'),initial:0.5}).inspection,0);
});

test('Informe §6: Jacobi/GS/CG dan 27/10/4 con tolerancia escalada',()=>{
  assert.deepEqual(matvec(A,xExact),b);
  const r=calculate('solvers',defaults('solvers','NORMAL'));
  assert.equal(r.threshold,2.5e-9);
  assert.deepEqual(r.methods.slice(0,3).map(m=>m.rows.at(-1).k),[27,10,4]);
  for(const [i,expected] of [1.7078e-9,1.3883e-9,1.7764e-15].entries()){
    const m=r.methods[i];
    assert.ok(m.rows.at(-2).res>r.threshold);
    near(m.metrics.res,expected,expected*1e-4);
    assert.ok(m.converged);
  }
  assert.equal(residual(A,b,lu(A,b)),0);
  assert.deepEqual(lu([[0,2],[3,4]],[4,11]),[1,2]);
  assert.equal(calculate('solvers',{tolerance:1e-10,max:1}).methods[0].converged,false);
});

test('Informe §6.1: condición 1999 y direcciones de la perturbación',()=>{
  const p=defaults('condition','NORMAL'), r=calculate('condition',p);
  assert.equal(r.kappa,1999);
  r.x.forEach((v,i)=>near(v,[1.001,0.999,1,1][i],2e-12));
  near(r.gain,1999,1e-5);
  assert.ok(calculate('condition',{logE:-6}).kappa>r.kappa);
});

test('Informe §2.3: analítica libre, condiciones iniciales forzadas y error por paso',()=>{
  const p=defaults('wind','NORMAL'), r=calculate('wind',p);
  assert.equal(r.natural,2);
  assert.equal(r.ratio,0.04);
  const w=Math.sqrt(4-0.08**2);
  near(exactWind(p,1.5)[0],Math.exp(-0.12)*(0.05*Math.cos(w*1.5)+0.004/w*Math.sin(w*1.5)),1e-13);
  assert.deepEqual(exactWind(p,0),[0.05,0]);
  const stress=defaults('wind','ESTRÉS'), forced=calculate('wind',stress);
  near(exactWind(stress,0)[0],0.05,1e-13);
  near(exactWind(stress,0)[1],0,1e-13);
  const t=3,h=1e-5,[x,v]=exactWind(stress,t);
  const deriv=(exactWind(stress,t+h)[1]-exactWind(stress,t-h)[1])/(2*h);
  near(stress.m*deriv+stress.c*v+stress.k*x,stress.force*Math.sin(stress.omega*t),1e-7);
  assert.ok(forced.methods[1].metrics.abs<forced.methods[0].metrics.abs);
  assert.equal(forced.samples[0].at(-1).t,20);
});

test('Integración compuesta y extrapolación de Romberg',()=>{
  const r=quadrature(x=>x*x,0,1,8);
  near(r.Trapecio.at(-1).value,1/3,2e-5);
  near(r.Simpson.at(-1).value,1/3,1e-14);
  near(r.Romberg.at(-1).value,1/3,1e-14);
  const windResult=calculate('wind',defaults('wind','NORMAL'));
  for(const m of windResult.methods.slice(2)) assert.ok(m.metrics.abs<0.001&&m.value>0);
});

test('Informe §2.4: muestra oculta en π/4 y reconstrucción de nodos',()=>{
  const r=calculate('sensors',defaults('sensors','NORMAL'));
  near(r.test[0],Math.PI/4,1e-15);
  near(r.methods[0].value,0.75,1e-15);
  near(r.methods[0].metrics.abs,0.0428932,5e-8);
  const nodes=[[0,0],[0.42,0.8],[1.25,0.9],[1.9,0.22]];
  for(const f of [lagrange(nodes),spline(nodes)])for(const [x,y] of nodes)near(f(x),y,1e-14);
  assert.deepEqual(errors(0.1,0),{abs:0.1,rel:null,percent:null});
  const runge=calculate('sensors',defaults('sensors','MAL CONDICIONADO'));
  assert.ok(Math.max(...runge.lines[1].points.map(p=>p[1]))>1.5);
});
