const {chromium}=require('playwright');const {makeWorld}=require('./simleague.js');
(async()=>{const W=makeWorld(10,3);const b=await chromium.launch();
for(const [nm,vp] of [['m',{width:390,height:844}],['d',{width:1280,height:860}]]){
const pg=await b.newPage({viewport:vp,deviceScaleFactor:nm==='m'?2:1});pg.on('pageerror',e=>console.log('PAGEERR',e.message));
await pg.route('**/p?u=*',r=>{const t=new URL(r.request().url()).searchParams.get('u');if(t.includes('news.google'))return r.fulfill({body:'<rss/>'});const m=W.mock(t);r.fulfill({status:m.__status||200,body:JSON.stringify(m),contentType:'application/json'})});
await pg.goto('http://127.0.0.1:47821/');await pg.evaluate(()=>{localStorage.clear();localStorage.setItem('pp_sport','nba');localStorage.setItem('pp_nodirect','1')});await pg.reload();
await pg.waitForFunction(()=>/NBA ·/.test(document.querySelector('#status').textContent),null,{timeout:900000});
await pg.evaluate(()=>{goTab('home');scrollTo(0,0);document.querySelectorAll('.rv').forEach(e=>e.classList.add('in'))});await pg.waitForTimeout(600);
await pg.screenshot({path:`/tmp/lp_${nm}1.png`});
if(nm==='m'){for(const [i,y] of [[2,820],[3,1640],[4,2460],[5,3300]]){await pg.evaluate(y=>scrollTo(0,y),y);await pg.waitForTimeout(300);await pg.screenshot({path:`/tmp/lp_m${i}.png`})}}
else{await pg.evaluate(()=>scrollTo(0,800));await pg.waitForTimeout(300);await pg.screenshot({path:'/tmp/lp_d2.png'})}
console.log(nm,'height',await pg.evaluate(()=>document.body.scrollHeight));await pg.close()}
await b.close();})();
