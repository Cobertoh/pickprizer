// NBA 2H page on a simulated board: lines are half of the full-game lines; checks it rates sensibly and has no errors.
const {chromium}=require('playwright');const {makeWorld}=require('./simleague.js');const W=makeWorld(3,0,Date.now());
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:430,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.route('**/p?u=*',r=>{const t=new URL(r.request().url()).searchParams.get('u');if(t.includes('news.google'))return r.fulfill({body:'<rss/>'});
  if(/prizepicks\.com\/leagues/.test(t))return r.fulfill({body:JSON.stringify({data:[{id:'7',type:'league',attributes:{name:'NBA'}},{id:'84',type:'league',attributes:{name:'NBA2H'}}]}),contentType:'application/json'});
  if(/league_id=84/.test(t)){const m=W.mock(t.replace('league_id=84','league_id=7'));for(const d of m.data||[]){d.attributes.line_score=Math.round(d.attributes.line_score)/2;if(d.attributes.line_score%1===0)d.attributes.line_score+=0.5;if(d.relationships?.league?.data)d.relationships.league.data.id='84'}for(const x of m.included||[])if(x.type==='league'){x.id='84';x.attributes.name='NBA2H'}return r.fulfill({body:JSON.stringify(m),contentType:'application/json'})}
  const m=W.mock(t);r.fulfill({status:m.__status||200,body:JSON.stringify(m),contentType:'application/json'})});
 await pg.goto('http://127.0.0.1:47821/');await pg.evaluate(()=>{localStorage.clear();localStorage.setItem('pp_sport','nba2h');localStorage.setItem('pp_nodirect','1')});await pg.reload();
 await pg.waitForFunction(()=>/NBA 2H ·|NBA 2nd Half ·|·/.test(document.querySelector('#status').textContent)&&DATA.nba2h,null,{timeout:300000}).catch(()=>{});
 const r=await pg.evaluate(()=>{const d=DATA.nba2h;if(!d)return {status:document.querySelector('#status').textContent};const ps=d.picks.filter(p=>probOf(p)!=null);
  return {n:d.picks.length,rated:ps.length,sport:[...new Set(d.picks.map(p=>p.sport))],top:ps.filter(isGod).length,ex:ps.slice(0,4).map(p=>`${p.player} ${p.best} ${p.line} ${p.stat}: ${Math.round(100*probOf(p))}% proj ${p.proj}`),
   maxp:Math.max(...ps.map(probOf)),series:seriesFor(ps[0]).slice(0,3).map(x=>x.v),line0:ps[0].line,status:document.querySelector('#status').textContent}});
 console.log(JSON.stringify(r,null,1));await pg.evaluate(()=>goTab('board'));await pg.waitForTimeout(400);await pg.screenshot({path:'/tmp/shot_h2.png'});
 console.log('errors',errs.length?errs.slice(0,3):'none');await b.close()})();
