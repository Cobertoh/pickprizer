const files=process.argv.slice(2);const P=[];
for(const f of files){const R=JSON.parse(require('fs').readFileSync(f));for(const d of R)for(const p of d.picks){if(!p.t)continue;const e=p.best==='More'?p.pMore:p.pLess;if(e==null)continue;
 const tr=p.best==='More'?p.t.pOver:p.t.pUnder,hit=p.t.actual===p.t.line?null:(p.best==='More'?p.t.actual>p.t.line:p.t.actual<p.t.line)?1:0;
 const m=p.best==='More'?p.mM:p.mL,s=p.best==='More'?p.sM:p.sL;P.push({...p,e,tr,hit,m,s,dis:m!=null&&s!=null?Math.abs(m-s):0.15,day:f+d.day,type:p.k.split('|')[3],v:e*p.lf,clean:p.blk===null})}}
const days=[...new Set(P.map(p=>p.day))];
const base=p=>p.clean&&p.e>=0.58&&p.lf>=0.7&&p.v>=0.6;
function test(name,elig,score,N){const sel=[];let empty=0;for(const d of days){const x=P.filter(p=>p.day===d&&elig(p)).sort((a,b)=>score(b)-score(a)).slice(0,N);if(!x.length)empty++;sel.push(...x)}
 const h=sel.filter(p=>p.hit!=null);const tv=sel.reduce((a,p)=>a+p.tr*p.lf,0)/sel.length;
 console.log(name.padEnd(52),'n/day',(sel.length/days.length).toFixed(1).padStart(4),' empty days',String(empty).padStart(2),' engine',(100*sel.reduce((a,p)=>a+p.e,0)/sel.length).toFixed(1),' TRUE',(100*sel.reduce((a,p)=>a+p.tr,0)/sel.length).toFixed(1),' hit',(100*h.reduce((a,p)=>a+p.hit,0)/h.length).toFixed(1),' true value',tv.toFixed(3))}
for(const N of [6,12]){console.log(`\n-- best ${N} per day --`);
 test('current: by value',base,p=>p.v,N);
 test('agreement only (|model-history|<=0.08), by value',p=>base(p)&&p.dis<=0.08,p=>p.v,N);
 test('agreement only (<=0.05), by value',p=>base(p)&&p.dis<=0.05,p=>p.v,N);
 test('both methods >=56% on that side, by value',p=>base(p)&&p.m>=0.56&&p.s>=0.56,p=>p.v,N);
 test('score = value - 0.6*disagreement',base,p=>p.v-0.6*p.dis,N);
 test('score = min(model,history)*payout',base,p=>Math.min(p.m??p.e,p.s??p.e)*p.lf,N);
 test('min(model,history)>=0.58, by min',p=>p.clean&&p.lf>=0.7&&Math.min(p.m??0,p.s??0)>=0.58,p=>Math.min(p.m,p.s)*p.lf,N);}
