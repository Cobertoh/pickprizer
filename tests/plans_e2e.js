// Browser test of what each plan sees (guest, free, basic, pro, developer previewing basic), on a simulated NBA board.
const {chromium}=require('playwright');const {makeWorld}=require('./simleague.js');
const W=makeWorld(3,0,Date.now());
const ME={guest:{user:null},free:{user:'Fan1',plan:'free',role:'user',base:'free'},basic:{user:'Fan2',plan:'basic',role:'user',base:'basic'},pro:{user:'Fan3',plan:'pro',role:'user',base:'pro'},dev:{user:'PickHitDev',plan:'pro',role:'dev',base:'pro'}};
const POTD={day:'x',picks:{nba:{player:'Jalen Walker',stat:'Points',line:22.5,side:'More',type:'standard',prob:0.63,grade:'A',call:'BET',opp:'BOS',why:['Averages 27 over his last 10'],t:Date.now()}}};
const ok=(c,m)=>{console.log((c?'PASS':'FAIL')+'  '+m);if(!c)process.exitCode=1};
(async()=>{const b=await chromium.launch();
 for(const who of ['guest','free','basic','pro','dev']){
  const pg=await b.newPage({viewport:{width:430,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));let pcalls=0;
  await pg.route('**/p?u=*',r=>{pcalls++;const t=new URL(r.request().url()).searchParams.get('u');if(t.includes('news.google'))return r.fulfill({body:'<rss/>'});const m=W.mock(t);r.fulfill({status:m.__status||200,body:JSON.stringify(m),contentType:'application/json'})});
  await pg.route('**/auth/me',r=>r.fulfill({body:JSON.stringify(ME[who]),contentType:'application/json'}));
  await pg.route('**/auth/config',r=>r.fulfill({body:JSON.stringify({google:null,pay:true}),contentType:'application/json'}));
  await pg.route('**/potd',r=>r.fulfill({body:JSON.stringify(POTD),contentType:'application/json'}));
  await pg.route('**/rated/**',r=>r.fulfill({status:404,body:'{}'}));
  await pg.goto('http://127.0.0.1:47821/');await pg.evaluate(w=>{localStorage.clear();localStorage.setItem('pp_sport','nba');localStorage.setItem('pp_nodirect','1');localStorage.setItem('pp_gatetest','1');if(w==='dev')localStorage.setItem('pp_viewplan','basic')},who);await pg.reload();
  const member=['basic','pro','dev'].includes(who);
  if(member)await pg.waitForFunction(()=>/NBA ·/.test(document.querySelector('#status').textContent),null,{timeout:300000});else await pg.waitForTimeout(2500);
  console.log(`\n== ${who.toUpperCase()}`);
  const home=await pg.evaluate(()=>({potd:!!document.querySelector('#potdSec .potd .pn'),name:document.querySelector('#potdSec .pn')?.textContent,plans:document.querySelectorAll('#homeView .plan').length,acct:document.querySelector('#acctBtn').textContent,welcome:!!document.querySelector('#modal:not(.hide) #authForm')}));
  ok(home.potd,`homepage shows a pick of the day (${home.name})`);ok(home.plans>=2,'pricing plans shown');ok(home.welcome===(who==='guest'),`welcome sign-up sheet ${who==='guest'?'shown to a first-time guest':'not shown'}`);
  if(who==='guest')await pg.screenshot({path:'/tmp/shot_guest_welcome.png'});
  await pg.evaluate(()=>closePick());
  if(!member){ok(pcalls===0,'no engine data requests made');for(const t of ['board','coach','mine']){await pg.evaluate(t=>goTab(t),t);ok(await pg.evaluate(()=>!document.querySelector('#lockView').classList.contains('hide')&&document.querySelectorAll('#lockView .plan').length>0),`${t} tab locked with plans`)}
    if(who==='free'){await pg.evaluate(()=>goTab('board'));await pg.screenshot({path:'/tmp/shot_free_lock.png'})}}
  else{
   await pg.evaluate(()=>goTab('board'));await pg.waitForTimeout(300);
   const bd=await pg.evaluate(()=>({cards:document.querySelectorAll('#out .pick').length,pct:[...document.querySelectorAll('#out .pick .pct')].slice(0,5).map(x=>x.textContent.trim()),top:!!document.querySelector('#out .god, #out .godsec, #out .hgod, #out [class*=god]'),bshow:!document.querySelector('#bShow').classList.contains('hide'),calls:document.querySelectorAll('#out .callrow').length,body:document.body.classList.contains('vb')}));
   const basicView=who==='basic'||who==='dev';
   ok(bd.cards>50,`board shows ${bd.cards} picks`);
   if(basicView){ok(!bd.pct.some(t=>/%/.test(t)),'no per-pick percentages ('+bd.pct[0]+')');ok(bd.calls===0,'no BET/PASS calls');ok(!bd.bshow,'Top/value filters hidden');
     // secret order: displayed order matches engine ranking
     const ord=await pg.evaluate(()=>{const ids=[...document.querySelectorAll('#out .pick')].slice(0,40).map(e=>e.dataset.pk);const ps=ids.map(k=>ALL.find(p=>p.sport+'|'+p.id===k));let inv=0;for(let i=1;i<ps.length;i++)if((probOf(ps[i])??0)>(probOf(ps[i-1])??0)+1e-9)inv++;return inv});ok(ord===0,'picks secretly sorted most likely first');
     await pg.click('#out .pick');await pg.waitForTimeout(200);const md=await pg.evaluate(()=>({tiles:document.querySelectorAll('#modal .rsrch div').length,pct:/\d+%/.test(document.querySelector('#modal .mbox').innerText.replace(/\d+%\s*(fewer|more)/g,'')),call:!!document.querySelector('#modal .callbox')}));
     ok(md.tiles>=6&&!md.call,'pick detail shows research tiles, no call');ok(!md.pct,'pick detail has no chance %');await pg.screenshot({path:`/tmp/shot_${who}_detail.png`});await pg.evaluate(()=>closePick());
     await pg.screenshot({path:`/tmp/shot_${who}_board.png`});
     await pg.evaluate(()=>goTab('coach'));await pg.click('[data-style=mid]');await pg.waitForTimeout(800);
     const lu=await pg.evaluate(()=>{const L=document.querySelector('#styleOut .lineup');if(!L)return null;const vis=e=>e&&getComputedStyle(e).display!=='none';return {legs:L.querySelectorAll('.leg').length,legPctVisible:[...L.querySelectorAll('.leg .p')].some(vis),entry:L.innerText.match(/(\d+)%/)?.[0]}});
     ok(lu&&lu.legs>=3,'Hit Picks builds a lineup');ok(lu&&!lu.legPctVisible,'lineup legs hide their own chance');ok(lu&&!!lu.entry,'lineup chance shown ('+(lu&&lu.entry)+')');await pg.screenshot({path:`/tmp/shot_${who}_coach.png`});
     await pg.click('[data-hpmode=one]');await pg.waitForTimeout(200);ok(await pg.evaluate(()=>!!document.querySelector('#modal:not(.hide) .plan')),'Single pick asks to upgrade');await pg.evaluate(()=>closePick());
     await pg.evaluate(()=>goTab('mine'));ok(await pg.evaluate(()=>!document.querySelector('#lockView').classList.contains('hide')),'My lineup locked');
   } else {ok(bd.pct.some(t=>/%/.test(t)),'percentages shown ('+bd.pct[0]+')');ok(bd.calls>0,'calls shown');await pg.evaluate(()=>goTab('mine'));ok(await pg.evaluate(()=>document.querySelector('#lockView').classList.contains('hide')),'My lineup open');}
   if(who==='dev'){await pg.evaluate(()=>acctModal());ok(await pg.evaluate(()=>!!document.querySelector('#viewPlan')),'developer sees plan switcher');await pg.screenshot({path:'/tmp/shot_dev_menu.png'});
     await pg.selectOption('#viewPlan','pro');await pg.waitForTimeout(300);await pg.evaluate(()=>goTab('board'));ok(await pg.evaluate(()=>[...document.querySelectorAll('#out .pick .pct')].some(x=>/%/.test(x.textContent))),'switching preview to Pro shows ratings again')}
  }
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  if(who==='pro'){await pg.evaluate(()=>goTab('home'));await pg.evaluate(()=>document.querySelector('#potdSec').scrollIntoView());await pg.waitForTimeout(700);await pg.screenshot({path:'/tmp/shot_pro_potd.png'});await pg.evaluate(()=>document.querySelector('.plans').scrollIntoView());await pg.waitForTimeout(700);await pg.screenshot({path:'/tmp/shot_pricing.png'})}
  await pg.close();}
 await b.close()})();
