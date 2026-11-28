const {chromium}=require('playwright');const {makeWorld}=require('./simleague.js');const W=makeWorld(3,0,Date.now());
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:430,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 let change=null,out=null;
 await pg.route('**/p?u=*',r=>{const t=new URL(r.request().url()).searchParams.get('u');if(t.includes('news.google'))return r.fulfill({body:'<rss/>'});
  if(/injuries/.test(t)&&out)return r.fulfill({body:JSON.stringify({injuries:[{displayName:'X',injuries:[{athlete:{displayName:out,team:{displayName:''}},status:'Out',shortComment:'ankle'}]}]}),contentType:'application/json'});
  const m=JSON.parse(JSON.stringify(W.mock(t)));if(change&&/prizepicks/.test(t))for(const d of m.data||[]){const pl=(m.included||[]).find(x=>x.id===d.relationships?.new_player?.data?.id);if(pl&&pl.attributes.display_name===change.player&&d.attributes.stat_type===change.stat&&(d.attributes.odds_type||'standard')===change.type)d.attributes.line_score=change.line}
  r.fulfill({status:m.__status||200,body:JSON.stringify(m),contentType:'application/json'})});
 await pg.goto('http://127.0.0.1:47821/');await pg.evaluate(()=>{localStorage.clear();localStorage.setItem('pp_sport','nba');localStorage.setItem('pp_nodirect','1')});await pg.reload();
 await pg.waitForFunction(()=>/NBA ·/.test(document.querySelector('#status').textContent),null,{timeout:300000});
 await pg.evaluate(()=>goTab('coach'));await pg.click('[data-style=mid]');await pg.waitForTimeout(800);
 const legs=await pg.evaluate(()=>[...document.querySelector('#styleOut .lineup').querySelectorAll('.leg[data-pk]')].map(el=>{const p=ALL.find(q=>q.sport+'|'+q.id===el.dataset.pk);return {player:p.player,stat:p.stat,type:p.type,line:p.line,side:el.dataset.side}}));
 console.log('lineup:',legs.map(l=>`${l.player} ${l.side} ${l.line} ${l.stat}`).join(' | '));
 // clean check first
 await pg.click('#styleOut .lineup [data-precheck]');await pg.waitForFunction(()=>document.querySelector('.pcOut b')&&!/Checking/.test(document.querySelector('.pcOut').innerText),null,{timeout:60000});
 console.log('CLEAN:',await pg.evaluate(()=>document.querySelector('.pcOut').innerText.split('\n').slice(0,2).join(' / ')));
 change={...legs[0],line:legs[0].side==='More'?legs[0].line+2:legs[0].line-2};out=legs[1].player;
 await pg.evaluate(()=>{document.querySelector('.pcOut').remove()});await pg.click('#styleOut .lineup [data-precheck]');
 await pg.waitForFunction(()=>document.querySelector('.pcOut b')&&!/Checking/.test(document.querySelector('.pcOut').innerText),null,{timeout:60000});
 console.log('AFTER CHANGES:\n'+await pg.evaluate(()=>document.querySelector('.pcOut').innerText));
 await pg.evaluate(()=>document.querySelector('.pcOut').scrollIntoView());await pg.screenshot({path:'/tmp/shot_precheck.png'});
 console.log('errors',errs.length?errs:'none');await b.close()})();
