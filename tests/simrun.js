// Runs the real app against simulated days and dumps engine vs truth for every pick and lineup.
// usage: node simrun.js <seed> <dayFrom> <dayTo> <engine nov20|nov21> <out.json>
const {chromium}=require('playwright');const {makeWorld}=require('./simleague.js');const fs=require('fs');
const [seed,d0,d1,engine,out]=[+process.argv[2]||1,+process.argv[3]||0,+process.argv[4]||0,process.argv[5]||'nov20',process.argv[6]||'/tmp/sim.json'];
(async()=>{const b=await chromium.launch();const KEEP=!!process.env.KEEP,BASE=Date.now();const ctx=KEEP?await b.newContext():null;const res=fs.existsSync(out)?JSON.parse(fs.readFileSync(out)):[];
 for(let day=d0;day<=d1;day++){
  const NOW=KEEP?BASE+day*2*864e5:Date.now();const W=makeWorld(seed,day,NOW),t0=Date.now();
  const pg=KEEP?await ctx.newPage():await b.newPage();if(KEEP){await pg.addInitScript(off=>{const D=Date,RN=D.now.bind(D);class FD extends D{constructor(...a){a.length?super(...a):super(RN()+off)}static now(){return RN()+off}}window.Date=FD},NOW-Date.now())}pg.on('pageerror',e=>console.log('PAGEERR',e.message));
  await pg.route('**/p?u=*',r=>{const t=new URL(r.request().url()).searchParams.get('u');if(t.includes('news.google'))return r.fulfill({body:'<rss/>'});const m=W.mock(t);r.fulfill({status:m.__status||200,body:JSON.stringify(m),contentType:'application/json'})});
  await pg.goto('http://127.0.0.1:47821/');await pg.evaluate(([e,mw,clr])=>{if(clr)localStorage.clear();localStorage.setItem('pp_sport','nba');localStorage.setItem('pp_engine',e);localStorage.setItem('pp_nodirect','1');if(mw)localStorage.setItem('pp_mw',mw)},[engine,process.env.MW||'',!KEEP||day===d0]);await pg.reload();
  await pg.waitForFunction(()=>/NBA ·/.test(document.querySelector('#status').textContent),null,{timeout:900000});
  const got=await pg.evaluate(()=>{const A=window.__dbg().ALL;
    const picks=A.map(p=>({k:p.player+'|'+p.stat+'|'+p.line+'|'+p.type,best:p.best,pMore:p.pMore,pLess:p.pLess,god:isGod(p),val:isValuePick(p),call:p.verdict?callOf(p).lab:null,vc:p.verdict?.c,games:p.games,proj:p.proj,swingy:isSwingy(p),lf:legFactor(p),blk:p.verdict?godBlock(p):null,vcls:p.verdict?.c,mM:p.oMore,sM:p.hMore,mL:p.oLess,sL:p.hLess,rs:p.realityShift||0,cv:p.minCv??null,ms:p.mktShift||0}));
    const legs=styleLegs(),lus={};
    for(const k of Object.keys(STYLES)){const S=k==='safe'&&ENGINE()!=='nov20'?{...STYLES[k],pay:2,minEV:1.02}:STYLES[k];const avoid=new Set(),o=[];
      for(let i=0;i<3;i++){const x=bestForStyle(S,legs,avoid)||(S.minEV?bestForStyle({...S,minEV:0},legs,avoid):null);if(!x)break;o.push({legs:x.L.map(l=>({k:l.pk.player+'|'+l.pk.stat+'|'+l.pk.line+'|'+l.pk.type,side:l.side,p:l.p,pe:l.pe})),ch:x.ch,pay:x.pay,n:x.n});x.L.forEach(l=>avoid.add(l.pk.player))}
      lus[k]=o}
    const rows=trackLoad('nba'),gr=rows.filter(r=>r[6]!=null);const tail=t=>ENGINE()==='nov20'?'':'|'+t;
    return {picks,lus,trk:{rows:rows.length,graded:gr.length,gapMg:segGap('nba','side|M'+tail('goblin')),gapMs:segGap('nba','side|M'+tail('standard')),gapL:segGap('nba','side|L'+tail('standard')),top:A.filter(isGod).length}}});
  res.push({seed,day,engine,trk:got.trk,picks:got.picks.map(p=>({...p,t:W.truth[p.k]})),lus:Object.fromEntries(Object.entries(got.lus).map(([k,o])=>[k,o.map(lu=>({...lu,legs:lu.legs.map(l=>({...l,t:W.truth[l.k]}))}))]))});
  fs.writeFileSync(out,JSON.stringify(res));
  console.log(`day ${day} ${engine}: ${got.picks.length} picks, ${Math.round((Date.now()-t0)/1000)}s, track ${got.trk.graded}/${got.trk.rows} graded, gap goblinM ${got.trk.gapMg.toFixed(3)} stdM ${got.trk.gapMs.toFixed(3)} L ${got.trk.gapL.toFixed(3)}, top ${got.trk.top}`);
  await pg.close();
 }
 await b.close();})();
