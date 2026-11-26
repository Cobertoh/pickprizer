// Calibration of Over vs Under picks (standard lines) against TRUE odds in the simulated leagues.
const files=process.argv.slice(2);const P=[];
for(const f of files)for(const d of JSON.parse(require('fs').readFileSync(f)))for(const p of d.picks){if(!p.t)continue;const type=p.k.split('|')[3];if(type!=='standard')continue;
 for(const side of ['More','Less']){const e=side==='More'?p.pMore:p.pLess;if(e==null)continue;const tr=side==='More'?p.t.pOver:p.t.pUnder;const m=side==='More'?p.mM:p.mL,s=side==='More'?p.sM:p.sL;P.push({side,e,tr,best:p.best===side,clean:p.blk===null,both:m!=null&&s!=null?Math.min(m,s):null,day:f+d.day})}}
for(const side of ['More','Less']){const x=P.filter(p=>p.side===side&&p.best);console.log(`\n${side} (best side) n=${x.length}`);
 for(const [a,b] of [[.5,.55],[.55,.6],[.6,.65],[.65,.7],[.7,.8],[.8,1]]){const y=x.filter(p=>p.e>=a&&p.e<b);if(y.length>20)console.log(`  says ${a}-${b}: n=${String(y.length).padStart(5)}  says ${(100*y.reduce((s,p)=>s+p.e,0)/y.length).toFixed(1)}  TRUE ${(100*y.reduce((s,p)=>s+p.tr,0)/y.length).toFixed(1)}`)}}
