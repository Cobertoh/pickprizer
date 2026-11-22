// Grade engine vs truth from simrun output. usage: node simgrade.js file.json [label]
const fs=require('fs');const R=JSON.parse(fs.readFileSync(process.argv[2]));const lab=process.argv[3]||'';
const P=[];for(const d of R)for(const p of d.picks){if(!p.t)continue;const e=p.best==='More'?p.pMore:p.pLess;if(e==null)continue;const tr=p.best==='More'?p.t.pOver:p.t.pUnder;
  const act=p.t.actual;const hit=act===p.t.line?null:(p.best==='More'?act>p.t.line:act<p.t.line)?1:0;P.push({...p,e,tr,hit,type:p.k.split('|')[3],stat:p.k.split('|')[1],day:d.day})}
const f=x=>(100*x).toFixed(1).padStart(5);
function table(rows,title){console.log('\n'+title);console.log('  said      n    engine  TRUE   actual   gap(eng-true)');
  for(const [a,b] of [[0.5,0.6],[0.6,0.7],[0.7,0.8],[0.8,0.9],[0.9,1.01]]){const x=rows.filter(p=>p.e>=a&&p.e<b);if(!x.length)continue;const h=x.filter(p=>p.hit!=null);
   const me=x.reduce((s,p)=>s+p.e,0)/x.length,mt=x.reduce((s,p)=>s+p.tr,0)/x.length,ma=h.reduce((s,p)=>s+p.hit,0)/h.length;
   console.log(`  ${(a*100).toFixed(0)}-${(b*100).toFixed(0)}%  ${String(x.length).padStart(6)}  ${f(me)}  ${f(mt)}  ${f(ma)}   ${(100*(me-mt)).toFixed(1).padStart(6)}`)}}
console.log(`=== ${lab} ${R.length} days, ${P.length} picks ===`);
table(P,'ALL picks (best side)');
for(const t of ['standard','goblin','demon'])table(P.filter(p=>p.type===t),t.toUpperCase());
table(P.filter(p=>p.best==='Less'),'UNDERS');
table(P.filter(p=>/\+/.test(p.stat)),'COMBO stats');
// sharpness: how much the engine's chance tracks the truth (correlation), and mean abs error
const corr=(a,b)=>{const n=a.length,ma=a.reduce((s,x)=>s+x,0)/n,mb=b.reduce((s,x)=>s+x,0)/n;let c=0,va=0,vb=0;for(let i=0;i<n;i++){c+=(a[i]-ma)*(b[i]-mb);va+=(a[i]-ma)**2;vb+=(b[i]-mb)**2}return c/Math.sqrt(va*vb)};
const st=P.filter(p=>p.type==='standard');
console.log(`\nStandard picks: corr(engine,true)=${corr(st.map(p=>p.e),st.map(p=>p.tr)).toFixed(3)}  MAE=${(100*st.reduce((s,p)=>s+Math.abs(p.e-p.tr),0)/st.length).toFixed(1)} pts`);
// Top picks / calls
const G=P.filter(p=>p.god),gh=G.filter(p=>p.hit!=null);
console.log(`\nTOP PICKS: ${G.length} over ${R.length} days (${(G.length/R.length).toFixed(1)}/day)  engine ${f(G.reduce((s,p)=>s+p.e,0)/G.length||0)}  TRUE ${f(G.reduce((s,p)=>s+p.tr,0)/G.length||0)}  actual ${f(gh.reduce((s,p)=>s+p.hit,0)/gh.length||0)}`);
console.log('  by type:',['standard','goblin','demon'].map(t=>{const x=G.filter(p=>p.type===t);return `${t} ${x.length}`}).join(' · '));
for(const c of ['BET','LEAN BET','SAFE LEG','SMALL PLAY','PASS']){const x=P.filter(p=>p.call===c),h=x.filter(p=>p.hit!=null);if(!x.length)continue;
  console.log(`  ${c.padEnd(10)} n=${String(x.length).padStart(6)} engine ${f(x.reduce((s,p)=>s+p.e,0)/x.length)} TRUE ${f(x.reduce((s,p)=>s+p.tr,0)/x.length)} actual ${f(h.reduce((s,p)=>s+p.hit,0)/h.length)}`)}
// lineups
console.log('\nHIT PICKS lineups (top lineup per style per day):');
for(const k of ['safe','mid','bold','big']){const L=R.map(d=>d.lus[k]&&d.lus[k][0]).filter(Boolean);if(!L.length)continue;
  let pe=0,tr=0,won=0,ret=0,pay=0;for(const lu of L){pe+=lu.ch;const t=lu.legs.reduce((s,l)=>s*(l.side==='More'?l.t.pOver:l.t.pUnder),1);tr+=t;const w=lu.legs.every(l=>l.side==='More'?l.t.actual>l.t.line:l.t.actual<l.t.line);won+=w;ret+=w?lu.pay:0;pay+=lu.pay}
  console.log(`  ${k.padEnd(5)} ${L.length} days · avg pays ${(pay/L.length).toFixed(1)}x · engine says ${f(pe/L.length)}% · TRUE ${f(tr/L.length)}% · won ${won}/${L.length} · $${L.length} in -> $${ret.toFixed(1)} back · true EV/$ ${(L.reduce((s,lu)=>s+lu.pay*lu.legs.reduce((a,l)=>a*(l.side==='More'?l.t.pOver:l.t.pUnder),1),0)/L.length).toFixed(2)}`)}
