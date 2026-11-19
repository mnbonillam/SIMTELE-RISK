import {calculate} from '../../numerical_methods/models.js';
import {comparePresets} from '../../numerical_methods/experiments.js';

self.onmessage=({data:{id,module,params,type}})=>{
  if(type==='presets'){
    try {
      const result=comparePresets(module).map(run=>({...run,result:{methods:run.result.methods.map(({rows,...summary})=>summary)}}));
      self.postMessage({type,module,result});
    } catch(error){self.postMessage({type,module,error:error.message});}
    return;
  }
  try {self.postMessage({id,result:calculate(module,params)});}
  catch(error){self.postMessage({id,error:error.message});}
};
