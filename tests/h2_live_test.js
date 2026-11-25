// NBA 2H with games IN PROGRESS, board pasted by hand (the user's path), league number unknown.
const {chromium}=require('playwright');const {makeWorld}=require('./simleague.js');const W=makeWorld(3,0,Date.now());
const board=JSON.parse(JSON.stringify(W.mock('https://api.prizepicks.com/projections?league_id=7')));
for(const d of board.data){const a=d.attributes;a.line_score=Math.round(a.line_score)/2;if(a.line_score%1===0)a.line_score+=0.5;a.start_time=new Date(Date.now()-90*60e3).toISOString();a.status='in_game';a.stat_type=a.stat_type+' (2H)';d.relationships.league.data.id='84'}
board.included=board.included.filter(x=>x.type!=='league');board.included.push({type:'league',id:'84',attributes:{name:'NBA2H'}});
const events=W.today.pairs.map(([h,a],i)=>({id:'g'+i,competitions:[{competitors:[{homeAway:'home',score:'60',team:{abbreviation:h}},{homeAway:'away',score:i===0?'35':'55',team:{abbreviation:a}}],status:{period:2,displayClock:'0:00',type:{state:'in'}},odds:[]}],status:{period:2,displayClock:'0:00',type:{state:'in'}}}));
const summary=id=>{const i=+id.slice(1),[h,a]=W.today.pairs[i];const ath=W.players.filter(p=>p.team===h||p.team===a).map((p,k)=>({athlete:{displayName:p.name},didNotPlay:false,stats:[String(10+k%12),String(k%5===0?4:1),String(k%15)]}));
 return {header:{competitions:[{competitors:[{score:'60'},{score:i===0?'35':'55'}],status:{period:2,displayClock:'0:00'}}]},boxscore:{players:[{statistics:[{labels:['MIN','PF','PTS'],athletes:ath}]}]}}};
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:430,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text().slice(0,200))});
 await pg.route('**/p?u=*',r=>{const t=new URL(r.request().url()).searchParams.get('u');if(t.includes('news.google'))return r.fulfill({body:'<rss/>'});
  if(/scoreboard/.test(t))return r.fulfill({body:JSON.stringify({events}),contentType:'application/json'});
  const sm=t.match(/summary\?event=(g\d+)/);if(sm)return r.fulfill({body:JSON.stringify(summary(sm[1])),contentType:'application/json'});
  if(/prizepicks/.test(t))return r.fulfill({status:403,body:'{}'});
  const m=W.mock(t);r.fulfill({status:m.__status||200,body:JSON.stringify(m),contentType:'application/json'})});
 await pg.goto('http://127.0.0.1:47821/');await pg.evaluate(()=>{localStorage.clear();localStorage.setItem("pp_sport","nba");localStorage.setItem('pp_nodirect','1')});await pg.reload();await pg.waitForTimeout(4000);
 console.log('status before paste:',await pg.evaluate(()=>document.querySelector('#status').textContent));
 await pg.evaluate(js=>{$("#pasteBox").value=js;$("#pasteGo").click()},JSON.stringify(board));
 for(let i=0;i<60;i++){await pg.waitForTimeout(3000);const st=await pg.evaluate(()=>[document.querySelector('#status').textContent,!!DATA.nba2h]);if(st[1]){console.log('done:',st[0]);break}if(i%5===0)console.log('  ...',st[0])}
 const r=await pg.evaluate(()=>{const d=DATA.nba2h;if(!d)return null;const ps=d.picks.filter(p=>probOf(p)!=null);return {n:d.picks.length,rated:ps.length,live:ps.filter(p=>p.live).length,top:ps.filter(isGod).length,h1:ps.filter(p=>p.h1).length,risk:ps.filter(p=>p.h2risk).map(p=>p.player+': '+p.h2risk).slice(0,3)}});
 console.log(JSON.stringify(r));console.log('errors',errs.length?errs.slice(0,5):'none');await pg.screenshot({path:'/tmp/shot_h2live.png'});await b.close()})();
