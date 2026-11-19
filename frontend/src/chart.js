import {exactWind} from '../../numerical_methods/models.js';

const palette=['#ff9b62','#68d5df','#bdabff','#85dfaa','#b9cad6'];
const w=840,h=230,l=61,r=19,g=19,b=33;
const textNumber=(num,d=2)=> Number(num.toPrecision(5)).toLocaleString('es-BO',{maximumFractionDigits:d});
const attrs='vector-effect="non-scaling-stroke"';
const poly=(points,x,y)=>points.map(([a,c],i)=>`${i?'L':'M'}${x(a).toFixed(2)},${y(c).toFixed(2)}`).join(' ');

export function drawChart(svg,legend,input) {
  const {result,module,t,integration,refinement,showErrors,params} = input;
  const isArea=module==='wind'&&integration;
  const colors=module==='wind'&&!integration?['#92f2b8','#60e5f0','#c994ff']:palette;
  let lines=result.lines;
  if(isArea) lines=[{name:'|x(t)|',points:result.lines[0].points.map(([x,y])=>[x,Math.abs(y)])}];
  if(module==='sensors'&&!showErrors) lines=lines.slice(0,3);
  const all=lines.flatMap(line=>line.points).filter(p=>p.every(Number.isFinite));
  const min=Math.min(...all.map(p=>p[0])),max=Math.max(...all.map(p=>p[0]));
  const bottom=Math.min(0,...all.map(p=>p[1])),top=Math.max(1e-8,...all.map(p=>p[1]));
  const mapX=v=>l+(w-l-r)*(v-min)/Math.max(1e-9,max-min);
  const mapY=v=>g+(h-g-b)*(top-v)/(top-bottom);
  const vertical=Array.from({length:6},(_,i)=>{
    const value=min+(max-min)*i/5,x=mapX(value);
    return `<path d="M${x} ${g}V${h-b}" class="grid-line"/><text x="${x}" y="${h-10}" text-anchor="middle">${textNumber(value,1)}</text>`;
  }).join('');
  const horizontal=Array.from({length:5},(_,i)=>{
    const value=bottom+(top-bottom)*i/4,y=mapY(value);
    return `<path d="M${l} ${y}H${w-r}" class="grid-line"/><text x="${l-11}" y="${y+4}" text-anchor="end">${textNumber(value,3)}</text>`;
  }).join('');
  let layer='';
  if (isArea) {
    const row=result.area[integration][Math.min(refinement,result.area[integration].length-1)];
    const n=row.n, valueAt=time=>Math.abs(exactWind(params,time)[0]);
    const points=Array.from({length:n+1},(_,i)=>[min+(max-min)*i/n,0]).map(([x])=>[x,valueAt(x)]);
    if(integration==='Simpson') {
      for(let i=0;i<n;i+=2) {
        const [a,ya]=points[i],[mid,ym]=points[i+1],[c,yc]=points[i+2];
        const controlY=2*ym-(ya+yc)/2;
        layer+=`<path class="area-segment" d="M${mapX(a)} ${mapY(0)} L${mapX(a)} ${mapY(ya)} Q${mapX(mid)} ${mapY(controlY)} ${mapX(c)} ${mapY(yc)} V${mapY(0)}Z"/>`;
      }
    } else {
      for(let i=0;i<n;i++) {
        const [a,ya]=points[i],[c,yc]=points[i+1];
        layer+=`<path class="area-segment" d="M${mapX(a)} ${mapY(0)} L${mapX(a)} ${mapY(ya)} L${mapX(c)} ${mapY(yc)} V${mapY(0)}Z"/>`;
      }
    }
  } else if(module==='brake'||module==='wear'){
    const points=lines[0].points;
    layer+=`<path fill="url(#signal-fill)" d="${poly(points,mapX,mapY)} L${mapX(points.at(-1)[0])},${mapY(bottom)} H${l}Z"/>`;
  }
  const sensorDots=(result.nodes??[]).map(([x,y],i)=>`<circle tabindex="0" role="button" aria-label="Nodo ${i+1}. Usa las flechas para moverlo" data-node="${i}" cx="${mapX(x)}" cy="${mapY(y)}" r="6" fill="#15212c" stroke="#f1f3fa" stroke-width="2"><title>Nodo ${i+1} · ${textNumber(x,3)}, ${textNumber(y,3)}</title></circle>`).join('');
  const hidden=module==='sensors'&&showErrors ? result.test.map(x=>`<circle cx="${mapX(x)}" cy="${mapY(params.runge?1/(1+25*x*x):Math.sin(x))}" r="4" fill="none" stroke="#f8dc92"/>`).join('') : '';
  const markers=(result.markers??[]).map((line,index)=>line.points.map(([x,y],i)=>
    `<circle cx="${mapX(x)}" cy="${mapY(y)}" r="${3+index}" fill="${colors[index+1]}" fill-opacity=".65"><title>${line.name} · iterado ${i+1} · ${textNumber(x,5)}</title></circle>`).join('')).join('');
  const cursor=module==='condition'||isArea?'':`<path d="M${mapX(Math.min(max,Math.max(min,module==='sensors'?t+min:t)))} ${g}V${h-b}" class="cursor-line"/>`;
  const inspection=module==='wear'?`<path d="M${mapX(result.inspection)} ${g}V${h-b}" class="cursor-line inspection"/>`:'';
  const focused=svg.contains(document.activeElement)?document.activeElement.dataset.node:null;
  svg.innerHTML=`<defs><linearGradient id="signal-fill" x2="0" y2="1"><stop offset="0" stop-color="#e68d5a" stop-opacity=".29"/><stop offset="1" stop-color="#e68d5a" stop-opacity=".025"/></linearGradient></defs>
  ${vertical}${horizontal}${layer}${lines.map((line,i)=>`<path d="${poly(line.points,mapX,mapY)}" stroke="${colors[i]}" stroke-width="${i===0?2.3:1.6}" ${module==='wear'&&i===1?'stroke-dasharray="6 5"':''} fill="none" ${attrs}/>`).join('')}${cursor}${inspection}${markers}${hidden}${sensorDots}`;
  if(focused!==null&&focused!==undefined) svg.querySelector(`[data-node="${focused}"]`)?.focus({preventScroll:true});
  legend.innerHTML=lines.map((line,i)=>`<span><b style="--key:${colors[i]}"></b>${line.name}</span>`).join('')+
    (module==='wear'?result.markers.map((line,i)=>`<span><b style="--key:${colors[i+1]}"></b>${line.name}</span>`).join(''):'');
  return {
    updateCursor(value){
      const x=mapX(Math.min(max,Math.max(min,module==='sensors'?value+min:value)));
      svg.querySelector('.cursor-line:not(.inspection)')?.setAttribute('d',`M${x} ${g}V${h-b}`);
    },
    fromEvent(event){
      const rect=svg.getBoundingClientRect(), x=(event.clientX-rect.left)*w/rect.width,y=(event.clientY-rect.top)*h/rect.height;
      return [min+(max-min)*(x-l)/(w-l-r),top-(top-bottom)*(y-g)/(h-g-b)];
    }
  };
}
