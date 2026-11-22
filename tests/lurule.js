// Offline lineup-rule test: build the best lineup per day per style under different leg scores, grade vs truth.
const POWER={2:3,3:5,4:10,5:20,6:37.5};const STY={safe25:{ns:[2,3],pay:2.5},safe28:{ns:[2,3],pay:2.8},safe30:{ns:[2,3],pay:3},mid:{ns:[3,4],pay:5},bold:{ns:[3,4,5],pay:8,max:15}};
const W={standard:0.6,goblin:0.6,demon:0.45};
function legsOf(d,score){return d.picks.filter(p=>p.t&&p.blk===null&&p.lf!=null).map(p=>{const e=p.best==='More'?p.pMore:p.pLess,o=p.best==='More'?p.mM:p.mL,h=p.best==='More'?p.sM:p.sL;
  const ty=p.k.split('|')[3];const m=ty==='standard'?0.5:null;return {pl:p.k.split('|')[0],team:p.k,e,o,h,lf:p.lf,ty,tr:p.best==='More'?p.t.pOver:p.t.pUnder,win:p.best==='More'?p.t.actual>p.t.line:p.t.actual<p.t.line,s:0}}).filter(l=>l.e!=null&&l.e>=0.55).map(l=>({...l,s:score(l)}))}
function best(legs,S){let B=null;
  for(const n of S.ns){const mx=Math.max(...legs.map(l=>l.lf)),reach=legs.filter(l=>POWER[n]*l.lf*Math.pow(mx,n-1)>=S.pay);const pool=[...new Set([...reach.slice().sort((a,b)=>b.s*b.lf-a.s*a.lf).slice(0,30),...reach.slice().sort((a,b)=>b.s-a.s).slice(0,30),...reach.filter(l=>l.lf>1).sort((a,b)=>b.lf*b.s-a.lf*a.s).slice(0,12)])].sort((a,b)=>b.s-a.s);const L=[];const rec=(st,ch,F)=>{if(L.length===n){const pay=POWER[n]*F;if(pay<S.pay||(S.max&&pay>S.max))return;if(!B||ch>B.ch)B={L:[...L],ch,pay,n};return}
    for(let i=st;i<pool.length;i++){const l=pool[i];if(B&&ch*Math.pow(l.s,n-L.length)<=B.ch)break;if(L.some(x=>x.pl===l.pl))continue;L.push(l);rec(i+1,ch*l.s,F*l.lf);L.pop()}};rec(0,1,1)}return B}
const rules0={
 'current (blended chance)':l=>l.e,
 'cautious: min(both methods), anchored':l=>{if(l.o==null||l.h==null)return l.e;const raw=Math.min(l.o,l.h);const lf=l.lf;return Math.min(l.e,0.5+0.6*(raw-0.5)+(l.ty==='standard'?0:(l.e-0.5-0.6*(Math.min(l.o,l.h)-0.5))*0))},
 'blended minus disagreement/2':l=>l.o!=null&&l.h!=null?l.e-Math.abs(l.o-l.h)/2:l.e,
 'shrink extra 30% toward 50%':l=>0.5+0.7*(l.e-0.5),
};
for(const f of process.argv.slice(2)){const R=JSON.parse(require('fs').readFileSync(f));console.log('\n=== '+f);
 for(const [nm,sc] of Object.entries({'shrunk legs (app)':l=>{const m=l.ty==='standard'?0.5:null;return m==null?l.e:m+0.7*(l.e-m)}})){const out=[];for(const [k,S] of Object.entries(STY)){let n=0,said=0,tr=0,won=0,ev=0;for(const d of R){const b=best(legsOf(d,sc),S);if(!b)continue;n++;said+=b.ch;const t=b.L.reduce((a,l)=>a*l.tr,1);tr+=t;won+=b.L.every(l=>l.win);ev+=t*b.pay}
   out.push(`${k}: says ${(100*said/n).toFixed(1)} TRUE ${(100*tr/n).toFixed(1)} EV ${(ev/n).toFixed(2)}`)}console.log(nm.padEnd(40),out.join(' | '))}}
