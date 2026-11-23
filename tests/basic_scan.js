// Basic plan: scan every visible text in Hit Picks (all styles + advanced panel) for per-pick percentages.
const {chromium}=require('playwright');const {makeWorld}=require('./simleague.js');const W=makeWorld(3,0,Date.now());
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:430,height:900}});
 await pg.route('**/p?u=*',r=>{const t=new URL(r.request().url()).searchParams.get('u');if(t.includes('news.google'))return r.fulfill({body:'<rss/>'});const m=W.mock(t);r.fulfill({status:m.__status||200,body:JSON.stringify(m),contentType:'application/json'})});
 await pg.route('**/auth/me',r=>r.fulfill({body:JSON.stringify({user:'Fan2',plan:'basic',role:'user',base:'basic'}),contentType:'application/json'}));
 await pg.route('**/auth/config',r=>r.fulfill({body:'{"pay":true}',contentType:'application/json'}));await pg.route('**/potd',r=>r.fulfill({body:'{"picks":{}}',contentType:'application/json'}));await pg.route('**/rated/**',r=>r.fulfill({status:404,body:'{}'}));
 await pg.goto('http://127.0.0.1:47821/');await pg.evaluate(()=>{localStorage.clear();localStorage.setItem('pp_sport','nba');localStorage.setItem('pp_nodirect','1');localStorage.setItem('pp_gatetest','1')});await pg.reload();
 await pg.waitForFunction(()=>/NBA ·/.test(document.querySelector('#status').textContent),null,{timeout:300000});
 await pg.evaluate(()=>goTab('coach'));
 for(const st of ['safe','mid','bold','big']){await pg.click(`[data-style=${st}]`);await pg.waitForTimeout(600);
  const leaks=await pg.evaluate(()=>{const legs=[...document.querySelectorAll('#styleOut .leg')].map(l=>l.dataset.pk);const ps=legs.map(k=>ALL.find(p=>p.sport+'|'+p.id===k));
   const pcts=new Set(ps.map(p=>Math.round(100*probOf(p))+'%'));const txt=document.querySelector('#styleOut').innerText;const found=[...txt.matchAll(/\d+%/g)].map(m=>m[0]).filter(x=>pcts.has(x));
   return {n:legs.length,found:[...new Set(found)],sample:txt.match(/[^\n]*\d+%[^\n]*/g)?.slice(0,6)}});
  console.log(st,'legs',leaks.n,'per-pick % matches visible:',leaks.found.join(',')||'none');if(leaks.found.length)console.log('   lines:',leaks.sample.join(' || '))}
 await pg.evaluate(()=>{const d=document.querySelector('.adv');d.open=true});await pg.waitForTimeout(300);await pg.screenshot({path:'/tmp/shot_basic_coach2.png',fullPage:false});
 await b.close()})();
