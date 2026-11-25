import w from '../public/_worker.js';
const store=new Map();const KV={get:async k=>store.get(k)?.v??null,put:async(k,v,o)=>{store.set(k,{v,m:o?.metadata})},getWithMetadata:async k=>({value:store.get(k)?.v??null,metadata:store.get(k)?.m??null})};
globalThis.caches={default:{match:async()=>undefined,put:async()=>{}}};const env={KV};const ctx={waitUntil:()=>{}};
let r=await w.fetch(new Request('https://x.test/sc'),env,ctx);let t=await r.text();console.log('sc has leagues url:',t.includes('/leagues'),'| has 84:',t.includes('league_id=84'));
r=await w.fetch(new Request('https://x.test/board',{method:'POST',body:JSON.stringify({data:[{id:'7',type:'league',attributes:{name:'NBA'}},{id:'84',type:'league',attributes:{name:'NBA2H'}}]})}),env,ctx);console.log('post leagues',await r.text());
r=await w.fetch(new Request('https://x.test/sc'),env,ctx);t=await r.text();console.log('sc now has 84:',t.includes('league_id=84'));
r=await w.fetch(new Request('https://x.test/leagues'),env,ctx);console.log('GET /leagues',r.status);
// board posted for an unknown league whose included league name is NBA4Q -> learned
const b={data:[{id:'1',type:'projection',attributes:{},relationships:{league:{data:{id:'192',type:'league'}}}}],included:[{type:'league',id:'192',attributes:{name:'NBA4Q'}}]};
r=await w.fetch(new Request('https://x.test/board',{method:'POST',body:JSON.stringify(b)}),env,ctx);console.log('post 4Q board',r.status,await r.text());
r=await w.fetch(new Request('https://x.test/sc'),env,ctx);t=await r.text();console.log('sc now has 192:',t.includes('league_id=192'));
