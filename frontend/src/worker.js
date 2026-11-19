import {calculate} from '../../numerical_methods/models.js';
self.onmessage = ({data:{id,module,params}}) => {
  try { self.postMessage({id,result:calculate(module,params)}); }
  catch (error) { self.postMessage({id,error:error.message}); }
};
