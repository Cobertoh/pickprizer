// Server sportsbook feed with a fake Odds API: once-a-day caching, credit floor, de-vig + consensus, members only.
const _now=Date.now.bind(Date);const H=new Date(_now()-5*3600e3).getUTCHours();Date.now=()=>_now()+((15-H+24)%24)*3600e3;
import w from '../public/_worker.js';
const store=new Map();const KV={get:async k=>store.get(k)?.v??null,put:async(k,v,o)=>{store.set(k,{v,m:o?.metadata})},getWithMetadata:async k=>({value:store.get(k)?.v??null,metadata:store.get(k)?.m??null})};
globalThis.caches={default:{match:async()=>undefined,put:async()=>{}}};
let calls=0,left=500;const soon=new Date(Date.now()+3*3600e3).toISOString();
globalThis.fetch=async(u)=>{u=String(u);if(!u.includes('the-odds-api'))return new Response('{}');
 if(u.includes('/events?'))return new Response(JSON.stringify([{id:'e1',commence_time:soon},{id:'e2',commence_time:soon}]));
 calls++;left-=4;const ev={bookmakers:[{key:'dk',markets:[{key:'player_points',outcomes:[{name:'Over',description:'Jalen Walker',point:24.5,price:1.83},{name:'Under',description:'Jalen Walker',point:24.5,price:1.95}]}]},
  {key:'fd',markets:[{key:'player_points',outcomes:[{name:'Over',description:'Jalen Walker',point:24.5,price:1.90},{name:'Under',description:'Jalen Walker',point:24.5,price:1.90}]}]}]};
 return new Response(JSON.stringify(ev),{headers:{'x-requests-remaining':String(left)}})};
const env={KV,ODDS_API_KEY:'secret-test'};const ctx={waitUntil:()=>{}};
// member session cookie: sign up then use cookie
let jar='';const call=async(p,o={})=>{const r=await w.fetch(new Request('https://x.test'+p,{...o,headers:{cookie:jar,'content-type':'application/json'}}),env,ctx);const sc=r.headers.get('set-cookie');if(sc)jar=sc.split(';')[0];return {s:r.status,j:await r.json().catch(()=>null)}};
let r=await call('/odds/nba');console.log('guest:',r.s);
await call('/auth/signup',{method:'POST',body:JSON.stringify({username:'oddsfan',password:'longenough1'})});
const u=JSON.parse(store.get('user/oddsfan').v);u.plan='pro';store.set('user/oddsfan',{v:JSON.stringify(u)});await call('/auth/me');
const hour=new Date(Date.now()-5*3600e3).getUTCHours();
r=await call('/odds/nba');console.log('pro member (ET hour',hour+'):',r.s,'lines',r.j.lines.length,JSON.stringify(r.j.lines[0]||null),'remaining',r.j.remaining,'note',r.j.note,'| paid calls',calls);
r=await call('/odds/nba');console.log('second request same day -> cached, paid calls still',calls,'lines',r.j.lines.length);
store.delete('odds/nba');const m=JSON.parse(store.get('odds/meta').v);m.remaining=30;store.set('odds/meta',{v:JSON.stringify(m)});
r=await call('/odds/nba');console.log('credits at 30:',r.j.note,'| paid calls',calls);
console.log('stored keys:',[...store.keys()].join(', '));console.log('key ever in a response?',JSON.stringify([...store.values()]).includes('secret-test'));
