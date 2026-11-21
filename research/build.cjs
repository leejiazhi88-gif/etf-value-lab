const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = (name) => JSON.parse(fs.readFileSync('work/' + name + '.json', 'utf8').replace(/^\uFEFF/, ''));
const assets = [
  ['上证50','000016.SH','510050.SH','华夏上证50ETF'],
  ['沪深300','000300.SH','510300.SH','华泰柏瑞沪深300ETF'],
  ['中证500','000905.SH','510500.SH','南方中证500ETF'],
  ['中证1000','000852.SH','159845.SZ','南方中证1000ETF'],
  ['创业板指','399006.SZ','159915.SZ','易方达创业板ETF'],
  ['科创50','000688.SH','588000.SH','华夏科创50ETF'],
];
const methods = ['买入持有','恒定50%','仅PE','PE/PB','加情绪','加资金','加政策','加国家队','综合'];
const history = (prefix, code, years) => years.flatMap(y => read(prefix+'-'+code+'-'+y)).sort((a,b)=>a.trade_date.localeCompare(b.trade_date));
const date = s => s.includes('-') ? s : s.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
const ms = s => Date.parse(s+'T00:00:00Z');
const days = (a,b) => (ms(a)-ms(b))/86400000;
const week = s => Math.floor((ms(s)/86400000+3)/7);
const quantile = (value, values) => values.length && Number.isFinite(value) ? (values.filter(x=>x<value).length + values.filter(x=>x===value).length/2)/values.length : null;
const sort = (rows) => [...rows].sort((a,b)=>a.date.localeCompare(b.date));
const last = (rows,d) => rows.findLast(x=>x.date<=d);
const rp = read('p0-retail_sentiment_data');
const growth = read('p3-retail_index_metrics');
const broad = read('p0-valuation_data');
const growVal = read('p3-valuation_data');
const pbGrowth = new Map(growVal.sh.map(x=>[x.date,x.pb]));
const star = read('p3-star_official_history');
const flow = sort(read('p0-etf_flow_data').series);
const reports = read('p0-national_team_etf_history').reports;
const archived = Object.values(read('p0-official_sentiment_events').quarters).flat();
const policy = [
  ['2023-08-27','印花税减半','印花税减半','https://www.mof.gov.cn/caizhengshipin/caizhengxinwen2/202308/t20230828_3904230.htm'],
  ['2024-04-12','国九条','新国九条','https://www.csrc.gov.cn/csrc/c100028/c7473584/content.shtml'],
  ['2024-09-24','政策组合','9月24日金融政策组合','https://www.csrc.gov.cn/csrc/c106311/c7508374/content.shtml'],
].map(([date,needle,title,url])=>{
  assert(archived.some(x=>x.title.includes(needle)));
  return {date,title,url};
});
const clamp = (x, min, max) => Math.max(min,Math.min(max,x));
const round = x => Number(x.toFixed(6));
function nationalEvents(code) {
  const dated = new Map();
  for (const r of reports.filter(r=>r.code===code && r.table_disclosed && r.announced && !r.issues?.length && Array.isArray(r.holders))) {
    if (!dated.has(r.period) || r.announced < dated.get(r.period).announced) dated.set(r.period,r);
  }
  const rows = [...dated.values()].sort((a,b)=>a.announced.localeCompare(b.announced));
  const sums = r => [r.holders.reduce((n,h)=>n+h.units,0),r.holders.reduce((n,h)=>n+h.ratio_pct,0)];
  return rows.flatMap((r,i)=>{
    const prev = rows.slice(0,i).findLast(p=>p.period<r.period);
    if (!prev || days(date(r.period),date(prev.period))>400) return [];
    const [units, pct] = sums(r), [oldUnits, oldPct] = sums(prev);
    const direction = Math.abs(pct-oldPct)>=0.1 && Math.abs(units-oldUnits)>=0.01*Math.max(units,oldUnits)
      && Math.sign(pct-oldPct)===Math.sign(units-oldUnits) ? Math.sign(units-oldUnits) : 0;
    return [{date:r.announced, direction}];
  });
}
function input(asset) {
  const [name,idx,code] = asset;
  const e = history('fund_daily',code,[2018,2021,2024]);
  const adj = new Map(history('fund_adj',code,[2018,2021,2024]).map(r=>[r.trade_date,r.adj_factor]));
  const quotes = e.filter(r=>r.open>0 && r.close>0).map(r=>{
    const factor = adj.get(r.trade_date);
    assert(factor>0,code+' '+r.trade_date+' missing adjustment');
    return {date:date(r.trade_date),open:r.open*factor,close:r.close*factor};
  });
  assert.equal(new Set(quotes.map(x=>x.date)).size,quotes.length);
  assert.equal(quotes.at(-1).date,'2026-11-20');
  const val = history('val',idx,[2015,2019,2023]).map(r=>({date:date(r.trade_date),pe:r.pe_ttm,pb:pbGrowth.get(date(r.trade_date))>0 && name==='创业板指' ? pbGrowth.get(date(r.trade_date)) : r.pb})).filter(x=>x.pe>0&&x.pb>0);
  const mood = name==='创业板指' ? growth.sh : name==='科创50' ? growth.k50 : rp.series;
  const moodSeries = sort(mood.filter(x=>x.turnover>0));
  const moneyCode = code==='159845.SZ' ? '512100.SH' : code;
  const national = nationalEvents(code.slice(0,6));
  const signals = new Map();
  for(const [i,v] of val.entries()){
    const cutoff = new Date(ms(v.date));
    cutoff.setUTCFullYear(cutoff.getUTCFullYear()-3);
    const hist = val.slice(0,i).filter(x=>x.date>=cutoff.toISOString().slice(0,10));
    if(hist.length<240) continue;
    const pe = quantile(v.pe,hist.map(x=>x.pe));
    const pb = quantile(v.pb,hist.map(x=>x.pb));
    const m = last(moodSeries,v.date);
    const mPast = m ? moodSeries.filter(x=>x.date<m.date && days(m.date,x.date)<=365) : [];
    const sentiment = m && days(v.date,m.date)<=10 && mPast.length>=30 ? quantile(m.turnover,mPast.map(x=>x.turnover)) : null;
    const priorQuotes = flow.filter(x=>x.date<v.date).slice(-20);
    const money = priorQuotes.length===20 && days(v.date,priorQuotes.at(-1).date)<=12 && priorQuotes.every(x=>Number.isFinite(x.flows[moneyCode]))
      ? Math.sign(priorQuotes.reduce((s,x)=>s+x.flows[moneyCode],0)) : null;
    const n = last(national,v.date);
    signals.set(v.date,{pe,pb, sentiment,money,policy:policy.some(x=>days(v.date,x.date)>=0&&days(v.date,x.date)<28),national:n&&days(v.date,n.date)<56?n.direction:0});
  }
  const latestVal=val.at(-1);
  const ranks=signals.get(latestVal.date);
  return {quotes,signals,val,first:quotes.find((x,i)=>i && signals.has(quotes[i-1].date)).date,latest:{...latestVal,peRank:ranks.pe,pbRank:ranks.pb}, nationalEvents:national.filter(x=>x.direction!==0).length};
}
function simulate(quotes, signals, start, end, method, fee) {
  const first = quotes.findIndex(x=>x.date>=start);
  const lastIndex = quotes.findLastIndex(x=>x.date<=end);
  let cash=1, shares=0, peak=1, drawdown=0, turnover=0, weights=0, trades=0, modifiers=0;
  const curve=[];
  for(let i=first;i<=lastIndex;i++){
    const q=quotes[i], prev=quotes[i-1], opening=cash+shares*q.open;
    const w=shares*q.open/opening;
    let target=w;
    if(i===first) target=method===0?1:0.5;
    else if(week(q.date)!==week(prev.date) && method!==0){
      const signal=signals.get(prev.date);
      if(method===1) target=0.5;
      else if(signal){
        const p=method===2 ? signal.pe : (signal.pe+signal.pb)/2;
        const cap=p<=0.2?0.9:p<=0.35?0.7:p>=0.8?0.1:p>=0.65?0.3:null;
        if(cap!==null){
          const buy=p<=0.35;
          let step=0.1;
          if((method===4||method===8) && signal.sentiment!==null && (buy?signal.sentiment<0.2:signal.sentiment>0.8)) step+=0.05;
          if((method===5||method===8) && signal.money) step+=0.05*signal.money*(buy?1:-1);
          if((method===6||method===8) && signal.policy) step+=buy?0.05:-0.05;
          if((method===7||method===8) && signal.national) step+=0.05*signal.national*(buy?1:-1);
          const boundedStep=clamp(step,0,0.2);
          const gap=buy ? Math.max(0,cap-w) : Math.max(0,w-cap);
          const size=Math.min(gap,boundedStep);
          if(Math.abs(size-Math.min(gap,0.1))>1e-8) modifiers++;
          target = w+(buy?size:-size);
        }
      }
    }
    const delta = target-w;
    if(Math.abs(delta)>1e-8){
      const trade=opening*delta/(1+Math.sign(delta)*target*fee);
      shares+=trade/q.open;
      cash-=trade+Math.abs(trade)*fee;
      assert(cash>=-1e-9&&shares>=-1e-9);
      turnover+=Math.abs(trade)/opening;
      trades++;
    }
    const nav=cash+shares*q.close;
    weights+=shares*q.close/nav;
    peak=Math.max(peak,nav);
    drawdown=Math.max(drawdown,1-nav/peak);
    if(i===first || i===lastIndex || quotes[i+1].date.slice(0,7)!==q.date.slice(0,7)) curve.push([q.date,round(nav),round(shares*q.close/nav)]);
  }
  const total=curve.at(-1)[1]-1;
  return {total,annual:round((1+total)**(365.25/Math.max(1,days(quotes[lastIndex].date,quotes[first].date)))-1),drawdown:round(drawdown),weight:round(weights/(lastIndex-first+1)),turnover:round(turnover),trades,modifiers,curve};
}
const market=read('p1-market_modules_data');
const industry=read('p2-data-manifest').valuationAlignment.latest;
const data={methods,policy,context:{broad:[broad.sh.at(-1),broad.sz.at(-1)].map(({date,pe,pb,equityBondSpread})=>({date,pe,pb,equityBondSpread})),market:{date:date(market.latestDates.peMedian),pe:market.latest.peMedian,pb:market.latest.pbMedian},industry:{date:date(industry.valuationDate),pe:industry.pe},star:{...star.rows.at(-1),source:star.meta.source,field:star.meta.field}},assets:[]};
for(const asset of assets){
  const {quotes,signals,val,first,latest,nationalEvents}=input(asset);
  assert(first<='2021-08-02');
  const periods=[
    ['共同区间','2021-08-02','2026-11-20'],['前段','2021-08-02','2023-12-29'],
    ['后段','2024-01-02','2026-11-20'],['各自最长',first,'2026-11-20']
  ].map(([label,start,end])=>({
    label,start:quotes.find(x=>x.date>=start).date,end:quotes.findLast(x=>x.date<=end).date,
    rates:[0.0005,0.0015].map(fee=>methods.map((_,i)=>simulate(quotes,signals,start,end,i,fee)))
  }));
  if(asset[0]==='科创50'){
    const mainPE=new Map(val.map(x=>[x.date,x.pe]));
    const official=sort(star.rows.filter(x=>x.pe>0&&mainPE.has(x.date)));
    const alternative=new Map(official.slice(240).flatMap((r,i)=>{
      const original=signals.get(r.date);
      if(!original) return [];
      return [[r.date,{...original,pe:quantile(r.pe,official.slice(0,i+240).map(x=>x.pe))}]];
    }));
    const start=quotes.find((q,i)=>i&&alternative.has(quotes[i-1].date)).date;
    const end=quotes.at(-1).date;
    const aligned=new Map(official.slice(240).filter(r=>alternative.has(r.date)).map((r,i)=>
      [r.date,{...signals.get(r.date),pe:quantile(mainPE.get(r.date),official.slice(0,i+240).map(x=>mainPE.get(x.date)))}]
    ));
    data.starCheck={start,end,rates:[0.0005,0.0015].map(fee=>[
      simulate(quotes,signals,start,end,0,fee),
      simulate(quotes,aligned,start,end,3,fee),
      simulate(quotes,alternative,start,end,3,fee),
    ].map(({total,drawdown})=>({total,drawdown})))};
  }
  data.assets.push({asset,latest,periods,nationalEvents});
}
fs.writeFileSync('work/site/results.js','window.RESEARCH = '+JSON.stringify(data)+';\n');
fs.writeFileSync('work/results.json',JSON.stringify(data));
for(const {asset,periods,latest,nationalEvents} of data.assets) console.log(asset[0],latest.date,periods[3].start,nationalEvents,periods[0].rates[0].map(x=>[+(x.annual*100).toFixed(2),+(x.drawdown*100).toFixed(2),x.modifiers]));
