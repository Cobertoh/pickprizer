import w from '../public/_worker.js';
const store=new Map();const KV={get:async k=>store.get(k)?.v??null,put:async(k,v,o)=>{store.set(k,{v,m:o?.metadata})},getWithMetadata:async k=>({value:store.get(k)?.v??null,metadata:store.get(k)?.m??null})};
globalThis.caches={default:{match:async()=>undefined,put:async()=>{}}};const env={KV};const ctx={waitUntil:()=>{}};
let r=await w.fetch(new Request('https://x.test/sc'),env,ctx);let t=await r.text();console.log('sc has leagues url:',t.includes('/leagues'),'| has 84:',t.includes('league_id=84'));
r=await w.fetch(new Request('https://x.test/board',{method:'POST',body:JSON.stringify({data:[{id:'7',type:'league',attributes:{name:'NBA'}},{id:'84',type:'league',attributes:{name:'NBA2H'}}]})}),env,ctx);console.log('post leagues',await r.text());
r=await w.fetch(new Request('https://x.test/sc'),env,ctx);t=await r.text();console.log('sc now has 84:',t.includes('league_id=84'));
r=await w.fetch(new Request('https://x.test/leagues'),env,ctx);console.log('GET /leagues',r.status);
