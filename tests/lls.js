// overall log loss / Brier of the engine's best-side chance vs TRUE odds (expected), all standard+goblin+demon picks
const P=[];for(const f of process.argv.slice(2))for(const d of JSON.parse(require('fs').readFileSync(f)))for(const p of d.picks){if(!p.t)continue;for(const [e,t] of [[p.pMore,p.t.pOver],[p.pLess,p.t.pUnder]]){if(e==null||t==null)continue;P.push([e,t])}}
let ll=0,br=0;for(const [e,t] of P){const x=Math.min(.98,Math.max(.02,e));ll-=t*Math.log(x)+(1-t)*Math.log(1-x);br+=t*(1-x)**2+(1-t)*x**2}
console.log('n',P.length,'expected logloss',(ll/P.length).toFixed(4),'brier',(br/P.length).toFixed(4));
