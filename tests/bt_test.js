const {chromium}=require('playwright');const {makeWorld}=require('./simleague.js');
(async()=>{const b=await chromium.launch();for(const seed of [3,5]){const W=makeWorld(seed,0,Date.now());const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.route('**/p?u=*',r=>{const t=new URL(r.request().url()).searchParams.get('u');if(t.includes('news.google'))return r.fulfill({body:'<rss/>'});const m=W.mock(t);r.fulfill({status:m.__status||200,body:JSON.stringify(m),contentType:'application/json'})});
 await pg.goto('http://127.0.0.1:47821/');await pg.evaluate(()=>{localStorage.clear();localStorage.setItem('pp_sport','nba');localStorage.setItem('pp_nodirect','1')});await pg.reload();
 await pg.waitForFunction(()=>typeof BT!=='undefined'&&BT.nba,null,{timeout:400000});
 const r=await pg.evaluate(()=>{const x=BT.nba;const f=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,v.ll.toFixed(4)]));const c=bs=>bs.filter(b=>b.n>30).map(b=>`${Math.round(100*b.a)}%: said ${(100*b.pred).toFixed(1)} hit ${(100*b.act).toFixed(1)} (n${b.n})`);return {n:x.n,players:x.players,logloss:f(x.cmp),overs:c(x.sides.More),unders:c(x.sides.Less),demon:c(x.types.demon)}});
 console.log('league',seed,JSON.stringify(r,null,1));if(seed===3){await pg.evaluate(()=>{goTab('home')});}console.log('errors',errs.length?errs:'none');await pg.close()}await b.close()})();
