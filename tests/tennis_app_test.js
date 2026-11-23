// Runs the APP's own tennis code (simulator fit + per-pick blend with history) on ESPN-shaped synthetic results
// with known true odds. usage: node tennis_app_test.js [seed]
const fs=require('fs');const S=fs.readFileSync(__dirname+'/../src/app.html','utf8');
const cut=(a,b)=>{const i=S.indexOf(a);const j=S.indexOf(b,i);if(i<0||j<0)throw new Error('missing '+a);return S.slice(i,j)};
const lines=S.split('\n');const line=pre=>lines.find(l=>l.startsWith(pre));
let code=[line('const clip = '),line('function erf')||'',line('const erf')||'',line('const phi = '),lines[lines.findIndex(l=>l.startsWith('const norm = '))],lines[lines.findIndex(l=>l.startsWith('const norm = '))+1],line('const pct = '),line('const nn = '),
 cut('const TENNIS_STATS = {','async function sofa('),cut('// ===TENNIS-SIM-START===','async function analyzeTennis('),cut('function winProb(info){','async function analyzeTennis(')].join('\n');
// winProb..scoreTennis region includes TSIM again? strip duplicate by only keeping functions up to TSIM marker
code=code.replace(/(function winProb[\s\S]*?)\/\/ ===TENNIS-SIM-START===[\s\S]*$/,'$1');
code+='\nconst noteErr=()=>{};\nreturn {TSIM,tennisFit,tennisSim,applyTennisSim,scoreTennis,TENNIS_STATS};';
let A;try{A=new Function(code)()}catch(e){fs.writeFileSync('/tmp/extract.js',code);throw e}
const {TSIM,tennisFit,tennisSim,applyTennisSim,scoreTennis,TENNIS_STATS}=A;
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R=mulberry(+process.argv[2]||5);Math.random=R;const G=()=>{let u=0,v=0;while(!u)u=R();while(!v)v=R();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const NP=160,P=[];for(let i=0;i<NP;i++)P.push({name:'player '+i,s:0.64+0.035*G(),r:0.03*G(),ace:Math.max(0.1,0.55+0.25*G())});
P.sort((a,b)=>(b.s+b.r)-(a.s+a.r));P.forEach((p,i)=>p.rank=i+1);
const tm=(A,B)=>TSIM.match(A.s-B.r,B.s-A.r,3,false,A.ace,0.24,R,G);
const by={};let id=0;const now=Date.now();
for(let d=0;d<84;d++)for(let k=0;k<30;k++){const i=Math.floor(R()*NP),j=Math.min(NP-1,Math.max(0,i+Math.round(G()*25)));if(i===j)continue;const A=P[i],B=P[j],r=tm(A,B),date=new Date(now-(84-d)*864e5).toISOString();id++;
 const mk=(me,op,x,mine)=>({id:'m'+id,date,year:2026,GW:x.GW,GL:x.GL,SW:x.SW,SL:x.SL,TB:x.TB,SETS:x.SETS,S1W:x.S1W,S1T:x.S1T,won:x.won,bo:3,surface:'',opp:op.name,oppRank:op.rank,myRank:me.rank,tour:'atp',sets:x.sets,ACE:mine?x.ACE:null,DF:mine?x.DF:null,BPW:x.BPW});
 const rb={GW:r.GL,GL:r.GW,SW:r.SL,SL:r.SW,TB:r.TB,SETS:r.SETS,S1W:r.S1T-r.S1W,S1T:r.S1T,won:!r.won,sets:r.sets.map(([a,b])=>[b,a]),BPW:null,ACE:null,DF:null};
 (by[A.name]||=[]).push(mk(A,B,r,true));(by[B.name]||=[]).push(mk(B,A,rb,false));}
for(const k in by)by[k].sort((x,y)=>y.date>x.date?1:-1);
const E={by,next:{}};const t0=Date.now();const TF=tennisFit(E);console.log('fit',TF.matches,'matches',Date.now()-t0,'ms');
const out={app:[],hist:[]};
for(let t=0;t<250;t++){const i=Math.floor(R()*NP),j=Math.min(NP-1,Math.max(0,i+Math.round(G()*25)));if(i===j)continue;const A=P[i],B=P[j];
 const info={rows:by[A.name]||[],next:{opp:B.name,myRank:A.rank,oppRank:B.rank,bo:3,surface:'',event:'ATP Test Open'}};if(info.rows.length<5)continue;
 const truth=[];for(let n=0;n<6000;n++)truth.push(tm(A,B));
 const S=tennisSim(TF,A.name,info);info.simWin=S.win;
 for(const st of ['Total Games','Games Won','1st Set Games Won']){const f=TENNIS_STATS[st];const tv=truth.map(f).sort((a,b)=>a-b);const line=Math.floor(tv[tv.length>>1]+G()*1.2)+0.5;
  const p={stat:st,line,player:A.name,sport:'tennis'};scoreTennis(p,{...info,simWin:undefined},60);if(p.sMore==null)continue;const h={m:p.sMore,l:p.sLess};
  const q={stat:st,line,player:A.name,sport:'tennis'};scoreTennis(q,info,60);applyTennisSim(q,S);
  const pt=tv.filter(v=>v>line).length/tv.length,pl=tv.filter(v=>v<line).length/tv.length;
  for(const [k,m,l] of [['app',q.sMore,q.sLess],['hist',h.m,h.l]]){const more=m>=l;out[k].push({st,e:more?m:l,tr:more?pt:pl,both:k==='app'?Math.min(more?q.oMore:q.oLess,more?q.hMore:q.hLess):null})}}}
for(const k of ['hist','app']){const x=out[k];console.log(`\n${k==='app'?'NEW (simulator + history)':'OLD (history only)'}: n=${x.length} MAE vs truth ${(100*x.reduce((a,p)=>a+Math.abs(p.e-p.tr),0)/x.length).toFixed(1)} pts`);
 for(const [a,b] of [[.5,.55],[.55,.6],[.6,.65],[.65,.7],[.7,1]]){const y=x.filter(p=>p.e>=a&&p.e<b);if(y.length)console.log(`  says ${a}-${b}: n=${String(y.length).padStart(4)}  says ${(100*y.reduce((s,p)=>s+p.e,0)/y.length).toFixed(1)}  TRUE ${(100*y.reduce((s,p)=>s+p.tr,0)/y.length).toFixed(1)}`)}
 const top=[...x].filter(p=>k!=='app'||p.both>=0.58).sort((a,b)=>(k==='app'?b.both-a.both:b.e-a.e)).slice(0,Math.ceil(x.length/12));
 console.log(`  best ~8%${k==='app'?' (both methods agree)':''}: n=${top.length} says ${(100*top.reduce((s,p)=>s+p.e,0)/top.length).toFixed(1)} TRUE ${(100*top.reduce((s,p)=>s+p.tr,0)/top.length).toFixed(1)}`)}
