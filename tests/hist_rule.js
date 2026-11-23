// Compares Top-pick rules on simulated history-only sports (no opportunity engine) against TRUE odds.
const files=process.argv.slice(2);const P=[];
for(const f of files){for(const d of JSON.parse(require('fs').readFileSync(f)))for(const p of d.picks){if(!p.t)continue;const e=p.best==='More'?p.pMore:p.pLess;if(e==null)continue;
 const tr=p.best==='More'?p.t.pOver:p.t.pUnder,m=p.best==='More'?p.mM:p.mL,s=p.best==='More'?p.sM:p.sL;
 P.push({...p,e,tr,m,s,day:f+d.day,type:p.k.split('|')[3],v:e*p.lf,clean:p.blk===null})}}
const days=[...new Set(P.map(p=>p.day))];
function test(name,elig,score,N){const sel=[];let empty=0;for(const d of days){const x=P.filter(p=>p.day===d&&elig(p)).sort((a,b)=>score(b)-score(a)).slice(0,N);if(!x.length)empty++;sel.push(...x)}
 const avg=f=>sel.reduce((a,p)=>a+f(p),0)/sel.length;
 console.log(name.padEnd(48),'n/day',(sel.length/days.length).toFixed(1).padStart(4),' empty',String(empty).padStart(2),' says',(100*avg(p=>p.e)).toFixed(1),' TRUE',(100*avg(p=>p.tr)).toFixed(1),' true×pay',(100*avg(p=>p.tr*p.lf)).toFixed(1),' gob%',(100*avg(p=>p.type==='goblin'?1:0)).toFixed(0))}
const old=p=>p.clean&&!p.swingy&&p.lf>=0.7&&p.e>=0.58&&p.v>=0.6;
const bs=p=>p.m!=null&&p.s!=null?Math.min(p.m,p.s):null;
const nw=p=>p.clean&&p.lf>=0.7&&p.e>=0.56&&(bs(p)!=null?bs(p)>=0.58&&bs(p)*p.lf>=0.58:p.e>=0.58&&p.v>=0.6);
console.log('picks',P.length,'days',days.length,'with 2nd opinion',(100*P.filter(p=>p.m!=null).length/P.length).toFixed(0)+'%');
test('OLD fallback (prob>=58, value>=60), by value',old,p=>p.v,8);
test('NEW both-say (model & long-run), by trust',nw,p=>(bs(p)??p.e)*p.lf,8);
test('NEW, but min both-say 0.60',p=>nw(p)&&(bs(p)??0)>=0.60,p=>(bs(p)??p.e)*p.lf,8);
// calibration buckets for all best-side picks
console.log('\nall picks, engine says vs TRUE:');for(const [a,b] of [[.5,.55],[.55,.6],[.6,.65],[.65,.7],[.7,.8],[.8,1]]){const x=P.filter(p=>p.e>=a&&p.e<b);if(x.length)console.log(` ${a}-${b}: n=${x.length} says ${(100*x.reduce((s,p)=>s+p.e,0)/x.length).toFixed(1)} true ${(100*x.reduce((s,p)=>s+p.tr,0)/x.length).toFixed(1)}`)}
