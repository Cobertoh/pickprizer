const fs=require('fs');const S=fs.readFileSync(__dirname+'/../src/app.html','utf8');
const code=S.slice(S.indexOf('const NFL_COLS = {'),S.indexOf('async function nflLog('));
const {parseNflGamelog,NFL_STATS}=new Function('oppAbbr','NFL_ALIASES',code+';return {parseNflGamelog,NFL_STATS};')(()=>'PHI',{});
// ESPN-style kicker log: kicking columns only
const kick={names:['fieldGoalsMade-fieldGoalAttempts','fieldGoalPct','longFieldGoalMade','extraPointsMade-extraPointAttempts','totalKickingPoints'],labels:['FG','PCT','LNG','XP','PTS'],categories:[{name:'kicking',count:5}],
 events:{a:{gameDate:'2026-11-22'},b:{gameDate:'2026-11-15'}},seasonTypes:[{displayName:'Regular Season',categories:[{events:[{eventId:'a',stats:['3-3','100','52','1-1','10']},{eventId:'b',stats:['2-3','66','47','5-5','11']}]}]}]};
const g=parseNflGamelog(kick);
for(const st of ['Fantasy Score','Kicking Points','FG Made','Rush Yards','Receptions'])console.log(st.padEnd(15),g.map(x=>NFL_STATS[st](x)));
// WR log without rushing columns
const wr={names:['receptions','receivingYards','receivingTouchdowns'],labels:['REC','YDS','TD'],categories:[{name:'receiving',count:3}],events:{a:{gameDate:'2026-11-22'}},seasonTypes:[{displayName:'Regular Season',categories:[{events:[{eventId:'a',stats:['6','88','1']}]}]}]};
const w=parseNflGamelog(wr);for(const st of ['Fantasy Score','Receiving Yards','Rush Yards','Rush+Rec Yds'])console.log('WR',st.padEnd(15),w.map(x=>NFL_STATS[st](x)));
