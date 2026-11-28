import w from '../public/_worker.js';
const store=new Map();const KV={get:async k=>store.get(k)?.v??null,put:async(k,v,o)=>{store.set(k,{v,m:o?.metadata})},getWithMetadata:async k=>({value:store.get(k)?.v??null,metadata:store.get(k)?.m??null})};
globalThis.caches={default:{match:async()=>undefined,put:async()=>{}}};const waits=[];const ctx={waitUntil:p=>waits.push(p)};
const b={data:[{id:'1',type:'projection',attributes:{},relationships:{league:{data:{id:'7',type:'league'}}}}],included:[]};
const r=await w.fetch(new Request('https://x.test/board',{method:'POST',body:JSON.stringify(b)}),{KV},ctx);await Promise.all(waits);
console.log('NBA board post:',r.status,'| keys:',[...store.keys()].join(', '));
