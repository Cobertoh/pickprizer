const {chromium}=require('playwright');const {makeWorld}=require('./simleague.js');const W=makeWorld(3,0,Date.now());
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:430,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.route('**/p?u=*',r=>{const t=new URL(r.request().url()).searchParams.get('u');if(t.includes('news.google'))return r.fulfill({body:'<rss/>'});const m=W.mock(t);r.fulfill({status:m.__status||200,body:JSON.stringify(m),contentType:'application/json'})});
 await pg.goto('http://127.0.0.1:47821/');await pg.evaluate(()=>{localStorage.clear();localStorage.setItem('pp_sport','nba');localStorage.setItem('pp_nodirect','1')});await pg.reload();
 await pg.waitForFunction(()=>/NBA ·/.test(document.querySelector('#status').textContent),null,{timeout:300000});
 await pg.evaluate(()=>{store.set('hpmode','one');goTab('coach')});await pg.click('#spGo');await pg.waitForTimeout(300);
 const first=await pg.evaluate(()=>{const R=spRanked();return R[0]&&R[0].player});console.log('first pick player:',first);
 await pg.click('[data-spx^="players|"]');await pg.waitForTimeout(400);
 const r=await pg.evaluate(f=>({stillThere:spRanked().some(p=>p.player===f),chip:!!document.querySelector('[data-spun]'),shown:document.querySelector('#spOut')?.innerText.slice(0,60)}),first);console.log('after skip:',JSON.stringify(r));
 await pg.click('[data-spun]');await pg.waitForTimeout(300);console.log('after unskip back:',await pg.evaluate(f=>spRanked().some(p=>p.player===f),first));
 // My lineup with same player twice: linked warning
 const w=await pg.evaluate(()=>{const ps=ALL.filter(p=>p.type==='standard'&&probOf(p)!=null);const pl=ps.find(p=>ps.filter(q=>q.player===p.player).length>=2);const two=ps.filter(q=>q.player===pl.player).slice(0,2);const others=ps.filter(q=>q.player!==pl.player&&q.team!==pl.team).slice(0,2);
   const L=[...two,...others].map(p=>({pk:p,side:p.best,p:probOf(p),pe:probOf(p),f:1,key:p.id}));const st=lineupStats(L,false,true);return {player:pl.player,stats:two.map(p=>p.stat),linked:(st.linked||[]).map(x=>x.src+' '+x.rho.toFixed(2))}});
 console.log('same-player link:',JSON.stringify(w));console.log('rho checks:',await pg.evaluate(()=>{const ps=ALL.filter(p=>p.type==='standard'&&probOf(p)!=null);const out=[];for(const p of ps){const q=ps.find(x=>x.player===p.player&&x!==p&&/\+/.test(x.stat+p.stat));if(q){const a={pk:p,side:'More'},b={pk:q,side:'More'};const r=pairRho(a,b);out.push(p.stat+' vs '+q.stat+': '+r.rho.toFixed(2)+' ('+r.src+')');if(out.length>=4)break}}return out}));console.log('errors',errs.length?errs:'none');await b.close()})();
