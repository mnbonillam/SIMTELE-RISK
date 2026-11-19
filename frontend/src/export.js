import reportFont from './assets/DejaVuSans.ttf?url';
import {MODULES} from '../../numerical_methods/models.js';
const serialize=v=>v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);
function download(text,type,name){
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;
  a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);
}
export function csv({module,scenario,params,result,date=new Date().toISOString()}){
  const rows=[['Caso','Escenario','Fecha','Parámetros','Método','Tolerancia','Paso','Máximo iteraciones','Convergió','Tipo','Índice','Tiempo o nodo','Aproximación','Referencia','Residuo','Error absoluto','Error relativo','Error porcentual','Interpretación','Detalle']];
  for(const m of result.methods) {
    const record=(kind,row)=>[MODULES[module].title,scenario,date,params,m.name,m.tolerance,m.step,m.max,m.converged,kind,row.k,row.t,row.value,kind==='Resumen'?m.reference:null,row.res,row.abs,row.rel,row.percent,m.interpretation,row.row];
    rows.push(record('Resumen',{...m.metrics,value:m.value}));
    m.rows.forEach(row=>rows.push(record('Iteración',row)));
  }
  download('\uFEFF'+rows.map(r=>r.map(v=>'"'+serialize(v).replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8','SIMTELE-'+module+'.csv');
}

const display=value=>Array.isArray(value)?'['+value.map(display).join(', ')+']':typeof value==='number'?Number(value.toPrecision(9)).toString():serialize(value)||'—';
export async function pdf({module,scenario,params,result,date=new Date().toISOString()}){
  const [{jsPDF},response]=await Promise.all([import('jspdf'),fetch(reportFont)]);
  if(!response.ok)throw new Error('Fuente del informe no disponible');
  const font=new Uint8Array(await response.arrayBuffer());
  let binary='';
  for(let i=0;i<font.length;i+=8192) binary+=String.fromCharCode(...font.subarray(i,i+8192));
  const doc=new jsPDF({compress:true,putOnlyUsedFonts:true});
  doc.addFileToVFS('DejaVuSans.ttf',btoa(binary));
  doc.addFont('DejaVuSans.ttf','DejaVu','normal');
  doc.setFont('DejaVu');
  doc.setProperties({title:'SIMTELE-RISK · '+MODULES[module].title,subject:'Laboratorio DAT 242 · UMSA'});
  const accent=[187,84,42];
  doc.setFillColor(...accent);
  doc.rect(19,13,14,1.5,'F');
  let y=23;
  function line(value,{size=10,color=[41,53,66],gap=5}={}){
    doc.setFontSize(size);doc.setTextColor(...color);
    const lines=doc.splitTextToSize(value,172);
    if(y+gap*lines.length>278){doc.addPage();y=21;}
    doc.text(lines,19,y);
    y+=gap*lines.length;
  }
  line('SIMTELE-RISK  /  DAT 242', {size:12,color:accent,gap:11});
  line(MODULES[module].title,{size:21,gap:10});
  line(scenario+'  |  '+date);
  line('UMSA · Informática · Métodos Numéricos');
  line('Datos sintéticos con fines educativos. No representan instalaciones reales.');
  y+=6;
  line('Parámetros de la corrida',{size:14,color:accent,gap:8});
  for(const [key,value] of Object.entries(params)) line(key+' = '+display(value));
  for(const m of result.methods) {
    y+=6;
    line(m.name,{size:14,color:accent,gap:8});
    line('Resultado '+display(m.value)+'   |   Referencia '+display(m.reference));
    line('Error absoluto '+display(m.metrics.abs)+'   |   Error relativo '+display(m.metrics.rel)+'   |   Error % '+display(m.metrics.percent));
    line('Residuo '+display(m.metrics.res)+'   |   Tolerancia '+display(m.tolerance)+'   |   Paso '+display(m.step));
    if(m.interpretation) line(m.interpretation);
    if(m.rows.length) line('Registros numéricos: '+m.rows.length+'. Consulte el CSV para ver el detalle.',{size:9});
  }
  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){
    doc.setPage(p);doc.setFontSize(8);doc.setTextColor(110,115,120);
    doc.text('SIMTELE-RISK  /  '+p+' de '+pages,19,289);
  }
  doc.save('SIMTELE-'+module+'.pdf');
}
