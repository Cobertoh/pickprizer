// Within each day's Top picks (ranked as the app ranks them), are the first few truly stronger?
const files=process.argv.slice(2);const rows=[];
for(const f of files)for(const d of JSON.parse(require('fs').readFileSync(f))){
 const tp=d.picks.filter(p=>p.god&&p.t).map(p=>{const e=p.best==='More'?p.pMore:p.pLess,tr=p.best==='More'?p.t.pOver:p.t.pUnder,m=p.best==='More'?p.mM:p.mL,s=p.best==='More'?p.sM:p.sL;const bs=m!=null&&s!=null?Math.min(m,s):e;return {e,tr,trust:bs*p.lf,bs,lf:p.lf,type:p.k.split('|')[3]}}).sort((a,b)=>b.trust-a.trust);
 tp.forEach((p,i)=>rows.push({...p,rank:i+1}))}
const show=(name,x)=>console.log(name.padEnd(30),'n',String(x.length).padStart(3),' says',(100*x.reduce((s,p)=>s+p.e,0)/x.length).toFixed(1),' TRUE',(100*x.reduce((s,p)=>s+p.tr,0)/x.length).toFixed(1),' true x pay',(100*x.reduce((s,p)=>s+p.tr*p.lf,0)/x.length).toFixed(1));
show('all Top picks',rows);show('rank 1-3 by trust',rows.filter(p=>p.rank<=3));show('rank 4-8',rows.filter(p=>p.rank>3));
const byP=[...rows].sort((a,b)=>b.bs-a.bs);show('highest cautious chance (top 3/day)',rows.filter(p=>p.bs>=0.66));
for(const t of ['goblin','standard','demon']){const x=rows.filter(p=>p.type===t);if(x.length)show('  '+t,x)}
