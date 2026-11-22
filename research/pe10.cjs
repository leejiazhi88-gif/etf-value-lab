const fs = require('node:fs');
const assert = require('node:assert/strict');
const longWindow = process.argv.includes('--20');
const start = longWindow ? '2006-11-21' : '2016-11-21';
const end = '2026-11-20';
const endExclusive = '2026-11-21';
const cost = 0.0005;
const days = (a,b) => (Date.parse(a)-Date.parse(b))/86400000;
const iso = date => date.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
const files = fs.readdirSync('work');
const series = (key,code) => files.filter(f=>{
  const primary=key+'-'+code+'-';
  const extended='pe20-'+(key==='val'?'index_dailybasic':key)+'-'+code+'-';
  return f.endsWith('.json')&&(f.startsWith(primary)||(longWindow&&f.startsWith(extended)));
})
  .flatMap(f=>JSON.parse(fs.readFileSync('work/'+f,'utf8')))
  .sort((a,b)=>a.trade_date.localeCompare(b.trade_date));
const assets = [
  ['上证50','000016.SH','510050.SH'],
  ['沪深300','000300.SH','510300.SH'],
  ['中证500','000905.SH','510500.SH'],
  ['中证1000','000852.SH','159845.SZ'],
  ['创业板指','399006.SZ','159915.SZ'],
  ['科创50','000688.SH','588000.SH'],
];
function rollingRank(valuations, years, minimum) {
  let left=0;
  return valuations.map((v,i)=>{
    const from=new Date(v.date+'T00:00:00Z');
    from.setUTCFullYear(from.getUTCFullYear()-years);
    const cutoff=from.toISOString().slice(0,10);
    while(valuations[left].date<cutoff) left++;
    const observations=i-left;
    let lower=0,tied=0;
    for(let j=left;j<i;j++){
      const previous=valuations[j].pe;
      if(previous<v.pe) lower++;
      if(previous===v.pe) tied++;
    }
    return {rank:observations>=minimum?(lower+tied/2)/observations:null, partial:valuations[0].date>cutoff};
  });
}
function run([name,index,code]) {
  const factors = new Map(series('fund_adj',code).map(r=>[r.trade_date,r.adj_factor]));
  const quotes = series('fund_daily',code).filter(r=>r.open>0&&r.close>0&&iso(r.trade_date)>=start&&iso(r.trade_date)<=end).map(r=>{
    const factor=factors.get(r.trade_date);
    assert(factor>0,code+' '+r.trade_date);
    return {date:iso(r.trade_date),open:r.open,close:r.close,adjOpen:r.open*factor,adjClose:r.close*factor};
  });
  assert.equal(quotes.length,new Set(quotes.map(q=>q.date)).size);
  assert.equal(quotes.at(-1).date,end);
  const valuationByDay = new Map();
  for(const r of series('val',index).filter(r=>r.pe_ttm>0&&iso(r.trade_date)<=end)){
    const d=iso(r.trade_date);
    assert(!valuationByDay.has(d)||valuationByDay.get(d).pe===r.pe_ttm,'Conflicting PE '+index+' '+d);
    valuationByDay.set(d,{date:d,pe:r.pe_ttm});
  }
  const valuations = [...valuationByDay.values()];
  const indexDays = new Map(series('index_daily',index).map(r=>[iso(r.trade_date),r]));
  assert.equal(valuations.length,new Set(valuations.map(q=>q.date)).size);
  const ranks3=rollingRank(valuations,3,240);
  const signals=valuations.map((v,i)=>({...v,rank:ranks3[i].rank}));
  const ranks10=longWindow?rollingRank(valuations,10,240):[];
  const rankByDate=new Map(ranks10.map((r,i)=>[valuations[i].date,r]));
  const trades=[];
  let cursor=-1, firstEligible=null, position=null, capital=1, fullSessions=0, eligibleSessions=0, lastProcessed=null;
  function closePeriod(mark,exit) {
    const duration=days(exit?exit.date:endExclusive,position.buy.date);
    assert(duration>0);
    const tradeReturn=mark*(exit?1-cost:1)/(position.price*(1+cost))-1;
    trades.push({buy:position.buy,sell:exit,duration,sessions:position.sessions,total:tradeReturn});
    capital*=1+tradeReturn;
    position=null;
  }
  for(const q of quotes){
    while(signals[cursor+1]?.date < q.date) cursor++;
    const signal=signals[cursor];
    if(!firstEligible&&signal?.rank!=null) firstEligible=q.date;
    if(firstEligible) eligibleSessions++;
    const fresh=signal?.rank!=null&&signal.date!==lastProcessed;
    const execution=()=>{
      const signalClose=indexDays.get(signal.date)?.close;
      const indexOpen=indexDays.get(q.date)?.open;
      if(longWindow) assert(signalClose>0&&indexOpen>0,'Index point missing '+index+' '+q.date);
      return {signal:signal.date,pe:signal.pe,rank:signal.rank,date:q.date,open:q.open,signalClose,indexOpen};
    };
    if(fresh){
      if(!position&&signal.rank<=0.2) position={buy:execution(),price:q.adjOpen,sessions:0};
      else if(position&&signal.rank>=0.8) closePeriod(q.adjOpen,execution());
      lastProcessed=signal.date;
    }
    if(position){
      position.sessions++;
      fullSessions++;
    }
  }
  const currentPosition=Boolean(position);
  const lastSignal=signals.at(-1);
  const pending=lastSignal.date!==lastProcessed&&lastSignal.rank!==null
    &&(currentPosition?lastSignal.rank>=0.8:lastSignal.rank<=0.2)?(currentPosition?'卖出':'买入'):null;
  const last=quotes.at(-1);
  if(position) closePeriod(last.adjClose,null);
  const duration=trades.reduce((sum,t)=>sum+t.duration,0);
  assert.equal(trades.reduce((sum,t)=>sum+t.sessions,0),fullSessions);
  assert(duration<=days(endExclusive,firstEligible));
  assert(eligibleSessions<=quotes.length);
  const weekly = new Map();
  for(const [date,row] of indexDays){
    if(date<start||date>end||!(row.close>0)) continue;
    const w=Math.floor((Date.parse(date)/86400000+3)/7);
    const percentile=rankByDate.get(date);
    weekly.set(w,[date,Number(row.close.toFixed(2)),valuationByDay.get(date)?.pe??null,percentile?.rank??null,percentile?.partial??null]);
  }
  return {
    name,index,code, firstTrading:quotes[0].date,firstEligible,lastTrading:last.date,
    availableDays:days(endExclusive,quotes[0].date), eligibleDays:days(endExclusive,firstEligible),
    sessions:quotes.length,eligibleSessions,fullSessions,duration,trades,currentPosition,pending,lastSignal,
    total:capital-1, hold:last.adjClose/(quotes[0].adjOpen*(1+cost))-1, weekly:[...weekly.values()]
  };
}
const result={start,end,endExclusive,cost,calendarDays:days(endExclusive,start),assets:assets.map(run)};
const slug=longWindow?'pe20':'pe10';
fs.writeFileSync('work/site/'+slug+'-data.js','window.PE10 = '+JSON.stringify(result)+';\n');
fs.writeFileSync('work/'+slug+'.json',JSON.stringify(result,null,2));
for(const a of result.assets) console.log(a.name,a.firstTrading,a.firstEligible,a.duration,a.fullSessions,a.trades.map(t=>[t.buy.date,t.sell?.date,t.duration]),a.pending);
