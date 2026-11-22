// Simulated NBA league with KNOWN true odds, served through the same ESPN / PrizePicks URLs the app reads.
// Truth model: minutes (with variance, blowouts, a star out -> teammates get minutes+shots), shot-based scoring,
// overdispersed counting stats, slow random form drift (real but small), injuries. Lines = sharp market median + noise.
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const TEAMS=['LAL','BOS','DEN','PHX','MIL','MIA','DAL','OKC','CHI','ATL'];
const FIRST=['Jalen','Marcus','Tyrese','Darius','Cole','Evan','Isaiah','Jordan','Malik','Andre','Devin','Keegan','Trey','Caleb','Noah','Bryce','Amen','Ausar','Cam','Dereck'];
const LAST=['Walker','Hayes','Brooks','Carter','Mitchell','Porter','Reed','Sims','Grant','Holmes','Bell','Wright','Ford','Price','Banks','Lyons','Moss','Nash','Pope','Quinn','Rhodes','Stone','Tate','Vaughn','Wells'];
function pois(r,l){if(l<=0)return 0;if(l>40){const g=Math.round(l+Math.sqrt(l)*gauss(r));return Math.max(0,g)}let L=Math.exp(-l),k=0,p=1;do{k++;p*=r()}while(p>L);return k-1}
function gauss(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function binom(r,n,p){let k=0;for(let i=0;i<n;i++)if(r()<p)k++;return k}
function gam(r,shape){ // mean 1 multiplicative noise
  if(shape<1){return gam(r,shape+1)*Math.pow(r(),1/shape)}const d=shape-1/3,c=1/Math.sqrt(9*d);for(;;){let x,v;do{x=gauss(r);v=1+c*x}while(v<=0);v=v*v*v;const u=r();if(u<1-0.0331*x*x*x*x||Math.log(u)<0.5*x*x+d*(1-v+Math.log(v)))return d*v/shape}}

function makeLeague(seed){
  const r=mulberry(seed);const players=[];let id=1000;const used=new Set();
  for(const t of TEAMS){
    for(let j=0;j<9;j++){
      let name;do{name=FIRST[Math.floor(r()*FIRST.length)]+' '+LAST[Math.floor(r()*LAST.length)]}while(used.has(name));used.add(name);
      const star=j<2, starter=j<5;
      const min=star?33+r()*3:starter?26+r()*6:12+r()*12;
      const big=j===4||j===8||r()<0.15;
      players.push({id:String(id++),name,team:t,j,star,starter,big,
        min,minSd:star?3.5:starter?4.5:6,
        fga:(star?0.55:starter?0.36:0.30)*(0.85+r()*0.3),       // FGA per minute
        p3s:big?0.12+r()*0.15:0.35+r()*0.25, p3:0.33+r()*0.07, p2:big?0.56+r()*0.08:0.47+r()*0.07,
        fta:(star?0.17:0.08)*(0.7+r()*0.6), pft:big?0.62+r()*0.15:0.78+r()*0.12,
        reb:(big?0.33:0.15)*(0.8+r()*0.4), ast:(star?0.20:big?0.07:0.11)*(0.7+r()*0.6),
        stl:0.028+r()*0.02, blk:big?0.035+r()*0.03:0.008+r()*0.01, tov:(star?0.095:0.05)*(0.8+r()*0.4), pf:0.06+r()*0.03,
        injP:0.03+r()*0.04});
    }
  }
  return players;
}
// play every slot: 5 games per slot, rotating pairings. Returns per-slot box + context
function playSeason(seed,players,S){
  const r=mulberry(seed*7+1),slots=[];const form={},outLeft={};for(const p of players){form[p.id]=1;outLeft[p.id]=0}
  const str={};for(const t of TEAMS)str[t]=gauss(r)*4;
  // team defenses (only when DEF=1, so earlier runs stay comparable): ~±4% on what opponents produce
  const dr=mulberry(seed*31+5),DEFS={};for(const t of TEAMS)DEFS[t]=process.env.DEF==='1'?{PTS:Math.exp(0.04*gauss(dr)),REB:Math.exp(0.035*gauss(dr)),AST:Math.exp(0.04*gauss(dr)),FG3:Math.exp(0.05*gauss(dr))}:{PTS:1,REB:1,AST:1,FG3:1};
  for(let s=0;s<S;s++){
    const pairs=[];const order=[...TEAMS];const k=s%9;const rot=[order[0],...order.slice(1).slice(k),...order.slice(1).slice(0,k)];
    for(let i=0;i<5;i++)pairs.push([rot[i],rot[9-i]]);
    // pre-game known info: who is out, today's true form
    const out=new Set();
    for(const p of players){form[p.id]=1+0.85*(form[p.id]-1)+0.025*gauss(r);if(outLeft[p.id]>0){outLeft[p.id]--;out.add(p.id)}else if(r()<p.injP){outLeft[p.id]=Math.floor(r()*4);out.add(p.id)}}
    const ctx={pairs,out:new Set(out),form:{...form},spread:{},oppDef:{}};
    for(const [a,b] of pairs){ctx.spread[a]=str[a]-str[b];ctx.spread[b]=str[b]-str[a];ctx.oppDef[a]=DEFS[b];ctx.oppDef[b]=DEFS[a]}
    ctx.box=simSlot(r,players,ctx);slots.push(ctx);
  }
  return slots;
}
function teamAdj(players,ctx,t){ // how much a team's missing stars shift minutes/usage to the rest
  const roster=players.filter(p=>p.team===t);const missingMin=roster.filter(p=>ctx.out.has(p.id)).reduce((a,p)=>a+p.min,0);
  const missStarShots=roster.filter(p=>ctx.out.has(p.id)&&p.star).reduce((a,p)=>a+p.fga*p.min,0);
  const live=roster.filter(p=>!ctx.out.has(p.id));const liveShots=live.reduce((a,p)=>a+p.fga*p.min,0)||1;
  return {minBoost:missingMin/Math.max(1,live.length),useBoost:1+0.6*missStarShots/liveShots};
}
function oneGame(r,p,ctx,adj){
  const blow=Math.abs(ctx.spread[p.team]||0)>6&&r()<0.35||r()<0.08;
  let m=p.min+Math.min(6,adj.minBoost*0.8)+p.minSd*gauss(r);if(blow&&p.starter)m-=6+r()*4;if(blow&&!p.starter)m+=4;
  m=Math.max(0,Math.min(44,m));const f=ctx.form[p.id];const D=(ctx.oppDef&&ctx.oppDef[p.team])||{PTS:1,REB:1,AST:1,FG3:1};
  const use=adj.useBoost*f;
  const FGA=pois(r,p.fga*m*use*D.PTS*gam(r,8)),A3=binom(r,FGA,Math.min(0.95,p.p3s*D.FG3)),M3=binom(r,A3,p.p3),M2=binom(r,FGA-A3,p.p2),FTA=pois(r,p.fta*m*use*D.PTS*gam(r,4)),FTM=binom(r,FTA,p.pft);
  const REB=pois(r,p.reb*m*f*D.REB*gam(r,6)),AST=pois(r,p.ast*m*(0.5+0.5*use)*D.AST*gam(r,6)),STL=pois(r,p.stl*m),BLK=pois(r,p.blk*m),TOV=pois(r,p.tov*m*use),PF=pois(r,p.pf*m);
  return {MIN:Math.round(m),FGM:M2+M3,FGA,FG3M:M3,FG3A:A3,FTM,FTA,REB,AST,STL,BLK,TOV,PF,PTS:2*M2+3*M3+FTM};
}
function simSlot(r,players,ctx){const box={};const adj={};for(const t of TEAMS)adj[t]=teamAdj(players,ctx,t);
  for(const p of players)if(!ctx.out.has(p.id))box[p.id]=oneGame(r,p,ctx,adj[p.team]);return box}
const STATF={'Points':g=>g.PTS,'Rebounds':g=>g.REB,'Assists':g=>g.AST,'Pts+Rebs+Asts':g=>g.PTS+g.REB+g.AST,'Pts+Rebs':g=>g.PTS+g.REB,'Pts+Asts':g=>g.PTS+g.AST,'Rebs+Asts':g=>g.REB+g.AST,
  '3-PT Made':g=>g.FG3M,'FG Attempted':g=>g.FGA,'Steals':g=>g.STL,'Blocked Shots':g=>g.BLK,'Turnovers':g=>g.TOV,'Free Throws Made':g=>g.FTM};

function makeWorld(seed,day,nowOverride){
  const HIST=60,S=HIST+day+1;const players=makeLeague(seed);const slots=playSeason(seed,players,S);const T=S-1,today=slots[T];
  const now=nowOverride||Date.now(),slotDate=s=>new Date(now-(T-s)*2*864e5-3*3600e3).toISOString(),start=new Date(now+3*3600e3).toISOString();
  const opp=t=>{const g=today.pairs.find(x=>x.includes(t));return g?g[0]===t?g[1]:g[0]:null};
  // truth: Monte Carlo of today's game from the TRUE model with today's known context
  const rr=mulberry(seed*13+day),adj={};for(const t of TEAMS)adj[t]=teamAdj(players,today,t);
  const N=3000,samples={};
  for(const p of players){if(today.out.has(p.id))continue;const a=[];for(let i=0;i<N;i++)a.push(oneGame(rr,p,today,adj[p.team]));samples[p.id]=a}
  const lr=mulberry(seed*17+day*3),truth={},data=[],included=[{type:'league',id:'7',attributes:{name:'NBA'}}];
  const q=(arr,x)=>arr.filter(v=>v>x).length/arr.length;
  for(const p of players){if(today.out.has(p.id))continue;const pid='np'+p.id;included.push({type:'new_player',id:pid,attributes:{display_name:p.name,team:p.team}});
    const smp=samples[p.id],add=(type,stat,line)=>{const k=p.name+'|'+stat+'|'+line+'|'+type;if(truth[k])return;
      const v=smp.map(STATF[stat]);truth[k]={pOver:q(v,line),pUnder:v.filter(x=>x<line).length/v.length,actual:STATF[stat](today.box[p.id]),player:p.name,stat,line,type};
      data.push({id:'x'+data.length,attributes:{odds_type:type,stat_type:stat,line_score:line,description:opp(p.team),start_time:start,trending_count:Math.round(lr()*3000)},relationships:{new_player:{data:{id:pid}},league:{data:{id:'7'}}}})};
    for(const stat of Object.keys(STATF)){
      const v=smp.map(STATF[stat]).sort((a,b)=>a-b),med=v[Math.floor(v.length/2)],mean=v.reduce((a,x)=>a+x,0)/v.length;
      if(mean<0.3)continue;
      const lowCount=['Steals','Blocked Shots','Turnovers','3-PT Made','Free Throws Made'].includes(stat);
      if(lowCount&&!['3-PT Made','Turnovers'].includes(stat)&&lr()<0.5)continue;
      const NZ=+(process.env.NOISE||0.05);const noise=lowCount?gauss(lr)*0.35*(NZ/0.05):gauss(lr)*NZ*mean;            // sharp market: ~5% of the mean off
      let line=Math.max(0.5,Math.floor(mean+noise)+0.5);if(lowCount)line=Math.max(0.5,Math.round(med+noise)-0.5);
      add('standard',stat,line);
      if(mean>=8&&!lowCount){const sc=Math.max(1,Math.round(mean*0.15));add('goblin',stat,Math.max(0.5,line-sc));add('goblin',stat,Math.max(0.5,line-2*sc));add('demon',stat,line+Math.round(sc*1.3))}
    }
  }
  const injuries=TEAMS.map(t=>({displayName:t,injuries:players.filter(p=>p.team===t&&today.out.has(p.id)).map(p=>({status:'Out',athlete:{displayName:p.name},shortComment:'injury'}))}));
  function gamelog(p,yr){ // 2027 = last 20 slots, 2026 = the 40 before
    const lo=yr===2027?T-20:T-HIST,hi=yr===2027?T:T-20;if(yr<2026)return {labels:[],seasonTypes:[]};
    const ev={},events=[];
    for(let s=hi-1;s>=lo;s--){const c=slots[s],g=c.box[p.id];if(!g)continue;const o=c.pairs.find(x=>x.includes(p.team));const op=o[0]===p.team?o[1]:o[0];const eid=p.team+'_'+s;
      ev[eid]={gameDate:slotDate(s),atVs:s%2?'@':'vs',opponent:{abbreviation:op}};
      events.push({eventId:eid,stats:[String(g.MIN),g.FGM+'-'+g.FGA,'',g.FG3M+'-'+g.FG3A,'',g.FTM+'-'+g.FTA,'',String(g.REB),String(g.AST),String(g.BLK),String(g.STL),String(g.PF),String(g.TOV),String(g.PTS)]})}
    return {labels:['MIN','FG','FG%','3PT','3P%','FT','FT%','REB','AST','BLK','STL','PF','TO','PTS'],events:ev,seasonTypes:[{displayName:'Regular Season',categories:[{events}]}]};
  }
  const byId={};for(const p of players)byId[p.id]=p;
  function mock(url){const u=new URL(url);
    if(url.includes('/trending/'))return {data:{}};
    if(url.includes('prizepicks'))return {data,included};
    if(u.pathname.endsWith('/nba/injuries'))return {injuries};
    if(u.pathname.endsWith('/nba/news'))return {articles:[]};
    let m=u.pathname.match(/nba\/teams\/(\w+)\/roster/);if(m){const ab=m[1].toUpperCase();return {athletes:players.filter(p=>p.team===ab).map(p=>({id:p.id,fullName:p.name}))}}
    m=u.pathname.match(/nba\/athletes\/(\d+)\/gamelog/);if(m){const p=byId[m[1]];if(!p)return {__status:404};return gamelog(p,+u.searchParams.get('season'))}
    if(url.includes('reddit.com'))return {data:{children:[]}};
    return {__status:404,message:'not mocked'}}
  return {mock,truth,players,today};
}
module.exports={makeWorld};
