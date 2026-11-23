const files=process.argv.slice(2);const P=[];
for(const f of files){for(const d of JSON.parse(require('fs').readFileSync(f)))for(const p of d.picks){if(!p.t)continue;const e=p.best==='More'?p.pMore:p.pLess;if(e==null)continue;
 const tr=p.best==='More'?p.t.pOver:p.t.pUnder,m=p.best==='More'?p.mM:p.mL,s=p.best==='More'?p.sM:p.sL;P.push({e,tr,bs:m!=null&&s!=null?Math.min(m,s):null,type:p.k.split('|')[3]})}}
for(const w of [0,0.2,0.3,0.4,0.5]){let err=0,n=0;const out=[];
 for(const [a,b] of [[.55,.6],[.6,.65],[.65,.7],[.7,.8],[.8,1]]){const x=P.map(p=>({...p,e2:p.bs!=null&&p.bs<p.e?p.e-w*(p.e-p.bs):p.e})).filter(p=>p.e2>=a&&p.e2<b);if(!x.length)continue;
  const s=x.reduce((q,p)=>q+p.e2,0)/x.length,t=x.reduce((q,p)=>q+p.tr,0)/x.length;err+=Math.abs(s-t)*x.length;n+=x.length;out.push(`${a}:${(100*s).toFixed(1)}/${(100*t).toFixed(1)}`)}
 console.log('w',w,'avg |gap|',(100*err/n).toFixed(2),out.join('  '))}
for(const ty of ['goblin','standard','demon']){const x=P.filter(p=>p.type===ty&&p.e>=0.6);console.log(ty,'60%+ says',(100*x.reduce((q,p)=>q+p.e,0)/x.length).toFixed(1),'true',(100*x.reduce((q,p)=>q+p.tr,0)/x.length).toFixed(1),'n',x.length)}
