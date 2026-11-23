// Synthetic tennis world with KNOWN true odds: players have separate serve and return skill (the fitter only uses one
// number per player, so this is a fair stress test). Compares the match simulator vs history-only hit rates.
const fs=require('fs');const src=fs.readFileSync(process.argv[2]||'/tmp/tsim.js','utf8');const code=src.slice(src.indexOf('// ===TENNIS-SIM-START==='),src.indexOf('// ===TENNIS-SIM-END==='));
const TSIM=new Function(code+';return TSIM;')();
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const seed=+process.argv[3]||7,R=mulberry(seed);const G=()=>{let u=0,v=0;while(!u)u=R();while(!v)v=R();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const NP=150,P=[];for(let i=0;i<NP;i++)P.push({id:'p'+i,s:0.64+0.035*G(),r:0.03*G()});
P.sort((a,b)=>(b.s+b.r)-(a.s+a.r));P.forEach((p,i)=>p.rank=i+1);
const trueMatch=(A,B,rnd,gs)=>{const pa=A.s-B.r,pb=B.s-A.r;return TSIM.match(pa,pb,3,false,0.55,0.24,rnd,gs)};
// history: 84 days of tournaments, players meet others of similar rank
const hist=[];for(let d=0;d<84;d++){for(let k=0;k<30;k++){const i=Math.floor(R()*NP);let j=Math.min(NP-1,Math.max(0,i+Math.round(G()*25)));if(j===i)continue;
 const row=trueMatch(P[i],P[j],R,G);hist.push({a:P[i].id,b:P[j].id,ga:row.GW,gb:row.GL,sets:row.sets,day:d,row,ar:P[i].rank,br:P[j].rank})}}
const rank=Object.fromEntries(P.map(p=>[p.id,p.rank]));const prior=k=>-0.02*Math.log(rank[k]/75);
const M=hist.map(m=>({a:m.a,b:m.b,ga:m.ga,gb:m.gb,sets:m.sets,w:Math.pow(0.5,(83-m.day)/60),base:0.64}));
const t0=Date.now();const F=TSIM.fit(M,prior);console.log('fit',M.length,'matches in',Date.now()-t0,'ms');
// how well x tracks the truth
const xs=P.map(p=>[F.P[p.id]?F.P[p.id].s+F.P[p.id].r:0,(p.s+p.r)-0.64]);const xs2=P.map(p=>[F.P[p.id]?F.P[p.id].s-F.P[p.id].r:0,p.s-p.r]);const mx=xs.reduce((a,b)=>a+b[0],0)/xs.length,my=xs.reduce((a,b)=>a+b[1],0)/xs.length;
const cor=xs.reduce((a,b)=>a+(b[0]-mx)*(b[1]-my),0)/Math.sqrt(xs.reduce((a,b)=>a+(b[0]-mx)**2,0)*xs.reduce((a,b)=>a+(b[1]-my)**2,0));console.log('corr(fitted edge, true edge)',cor.toFixed(3));{const c=(xs)=>{const mx=xs.reduce((a,b)=>a+b[0],0)/xs.length,my=xs.reduce((a,b)=>a+b[1],0)/xs.length;return xs.reduce((a,b)=>a+(b[0]-mx)*(b[1]-my),0)/Math.sqrt(xs.reduce((a,b)=>a+(b[0]-mx)**2,0)*xs.reduce((a,b)=>a+(b[1]-my)**2,0))};console.log('corr(fitted serve-return, true)',c(xs2).toFixed(3))}
const rowsOf=id=>hist.filter(m=>m.a===id||m.b===id).sort((x,y)=>y.day-x.day).map(m=>m.a===id?m.row:{...m.row,GW:m.row.GL,GL:m.row.GW});
const histProb=(rows,f,line)=>{const v=rows.slice(0,40).map(f);if(v.length<5)return null;const w=v.map((_,i)=>Math.pow(0.97,i)),W=w.reduce((a,b)=>a+b,0);const mu=v.reduce((s,x,i)=>s+w[i]*x,0)/W,sd=Math.max(Math.sqrt(v.reduce((s,x,i)=>s+w[i]*(x-mu)**2,0)/W),1);
 const ph=z=>0.5*(1+Math.tanh(0.7978845608*(z+0.044715*z*z*z)));const hm=v.reduce((s,x,i)=>s+(x>line?w[i]:0),0);return (hm+4*(1-ph((line-mu)/sd)))/(W+4)};
const stats={'Total Games':r=>r.GW+r.GL,'Games Won':r=>r.GW,'Total Sets':r=>r.SETS,'Aces':r=>r.ACE};
const res={sim:[],hist:[],blend:[],both:[]};
for(let t=0;t<300;t++){const i=Math.floor(R()*NP);let j=Math.min(NP-1,Math.max(0,i+Math.round(G()*25)));if(j===i)continue;const A=P[i],B=P[j];
 const truth=[];for(let n=0;n<8000;n++)truth.push(trueMatch(A,B,R,G));
 const z=k=>F.P[k]||{s:prior(k)/2,r:prior(k)/2};const sim=TSIM.run(0.64,z(A.id),z(B.id),F.n[A.id],F.n[B.id],3,false,TSIM.rate(rowsOf(A.id),'ACE',0.55),0.24,3000,R,G);
 for(const [st,f] of Object.entries(stats)){const tv=truth.map(f).sort((a,b)=>a-b);const line=Math.floor(tv[tv.length>>1]+G()*1.2)+0.5;
  const pt=tv.filter(v=>v>line).length/tv.length,ps=sim.map(f).filter(v=>v>line).length/sim.length,ph=histProb(rowsOf(A.id),f,line);
  // engine picks the better side; score that side
  const pb2=ph==null?ps:0.65*ps+0.35*ph;
  for(const [k,pp] of [['sim',ps],['hist',ph],['blend',pb2]]){if(pp==null)continue;const more=pp>=0.5;res[k].push({st,e:more?pp:1-pp,tr:more?pt:1-pt})}}}
for(const k of ['sim','hist','blend']){const x=res[k];console.log(`\n${k.toUpperCase()}: n=${x.length}  MAE vs truth ${(100*x.reduce((a,p)=>a+Math.abs(p.e-p.tr),0)/x.length).toFixed(1)} pts`);
 for(const [a,b] of [[.5,.55],[.55,.6],[.6,.65],[.65,.7],[.7,1]]){const y=x.filter(p=>p.e>=a&&p.e<b);if(y.length)console.log(`  says ${a}-${b}: n=${String(y.length).padStart(4)}  says ${(100*y.reduce((s,p)=>s+p.e,0)/y.length).toFixed(1)}  TRUE ${(100*y.reduce((s,p)=>s+p.tr,0)/y.length).toFixed(1)}`)}
 for(const st of Object.keys(stats)){const y=x.filter(p=>p.st===st);console.log(`  ${st.padEnd(12)} MAE ${(100*y.reduce((a,p)=>a+Math.abs(p.e-p.tr),0)/y.length).toFixed(1)}  best-10% picks TRUE ${(100*(()=>{const z=[...y].sort((a,b)=>b.e-a.e).slice(0,Math.ceil(y.length/10));return z.reduce((s,p)=>s+p.tr,0)/z.length})()).toFixed(1)}`)}}
