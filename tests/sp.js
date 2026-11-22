const {chromium}=require('playwright');const {makeWorld}=require('./simleague.js');
(async()=>{const W=makeWorld(10,3);const b=await chromium.launch();const pg=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});pg.on('pageerror',e=>console.log('PAGEERR',e.message));
await pg.route('**/p?u=*',r=>{const t=new URL(r.request().url()).searchParams.get('u');if(t.includes('news.google'))return r.fulfill({body:'<rss/>'});const m=W.mock(t);r.fulfill({status:m.__status||200,body:JSON.stringify(m),contentType:'application/json'})});
await pg.goto('http://127.0.0.1:47821/');await pg.evaluate(()=>{localStorage.clear();localStorage.setItem('pp_sport','nba');localStorage.setItem('pp_nodirect','1')});await pg.reload();
await pg.waitForFunction(()=>/NBA ·/.test(document.querySelector('#status').textContent),null,{timeout:900000});
await pg.evaluate(()=>goTab('coach'));await pg.click('[data-hpmode=one]');await pg.waitForTimeout(300);
for(const t of ['standard','demon','goblin']){await pg.click(`[data-sptype=${t}]`);await pg.waitForTimeout(200);await pg.click('#spGo');await pg.waitForTimeout(300);
 console.log(t,'->',await pg.evaluate(()=>document.querySelector('.spcard')?document.querySelector('.sphead').innerText.replace(/\s+/g,' ')+' | '+document.querySelector('.spline2').innerText+' | '+document.querySelector('.spnums').innerText.replace(/\s+/g,' ').slice(0,60):document.querySelector('#spOut').innerText.slice(0,120)));}
await pg.click('[data-sptype=standard]');await pg.waitForTimeout(200);await pg.click('#spGo');await pg.waitForTimeout(200);await pg.click('#spGo2');await pg.waitForTimeout(200);
console.log('after next:',await pg.evaluate(()=>document.querySelector('.sphead').innerText.replace(/\s+/g,' ')));
await pg.evaluate(()=>document.querySelector('.spcard').scrollIntoView());await pg.screenshot({path:'/tmp/sp.png'});
await b.close();})();
