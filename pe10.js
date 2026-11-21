'use strict';
const {assets,start,end,endExclusive,calendarDays}=window.PE10;
const el=id=>document.getElementById(id);
const pct=x=>(100*x).toFixed(2)+'%';
const fraction=(a,b)=>pct(a/b);
const offset=date=>((Date.parse(date)-Date.parse(start))/86400000)/calendarDays*100;
const code=a=>a.code.split('.')[0];
const title=a=>a.name+' <small>'+code(a)+'</small>';
const signed=x=>'<span class="'+(x>=0?'pos':'neg')+'">'+pct(x)+'</span>';
const header=fields=>'<thead><tr>'+fields.map(f=>'<th scope="col">'+f+'</th>').join('')+'</tr></thead>';
const table=(id,fields,rows)=>{el(id).innerHTML=header(fields)+'<tbody>'+rows.join('')+'</tbody>';};
const long=calendarDays>4000;
const ticks=[[Number(start.slice(0,4)),0],...(long?[2010,2014,2018,2022,2026]:[2019,2021,2023,2025,2026]).map(year=>[year,offset(year+'-01-01')])];
el('timeline').innerHTML='<div class="timeline-row" aria-hidden="true"><span></span><div class="axis">'+ticks.map(([y,x])=>'<span style="left:'+x+'%">'+y+'</span>').join('')+'</div></div>'+assets.map(a=>
  '<div class="timeline-row"><div><strong>'+title(a)+'</strong></div><div class="track cash"><span class="unavailable" style="width:'+offset(a.firstEligible)+'%"></span>'+
  ticks.map(([,x])=>'<span class="tick" style="left:'+x+'%"></span>').join('')+
  a.trades.map((t,i)=>{
    const left=offset(t.buy.date), right=offset(t.sell?.date||endExclusive);
    const label=a.name+'，'+t.buy.date+' 买入，'+(t.sell?t.sell.date+' 卖出':'期末仍持有')+'，'+t.duration+' 天';
    return '<button type="button" class="holding" data-key="'+code(a)+'-'+i+'" style="left:'+left+'%;width:'+(right-left)+'%" aria-label="'+label+'" title="'+label+'"></button>';
  }).join('')+'</div><span class="share">'+fraction(a.duration,calendarDays)+'</span></div>').join('');
table('summary',['指数 / ETF','满仓自然日',long?'占二十年':'占十年','占可执行期','完成轮次','期末仓位','策略累计收益','买入持有'],assets.map(a=>
  '<tr><th scope="row">'+title(a)+'</th><td>'+a.duration+'</td><td class="primary">'+fraction(a.duration,calendarDays)+'</td><td>'+fraction(a.duration,a.eligibleDays)+'</td><td>'+a.trades.filter(t=>t.sell).length+'</td><td>'+(a.currentPosition?'100%':'0%')+'</td><td>'+signed(a.total)+'</td><td>'+signed(a.hold)+'</td></tr>'));
table('coverage',['指数 / ETF','区间内首笔行情','策略可执行起点','可执行自然日','可执行交易日','满仓交易日'],assets.map(a=>
  '<tr><th scope="row">'+title(a)+'</th><td>'+a.firstTrading+'</td><td>'+a.firstEligible+'</td><td>'+a.eligibleDays+'</td><td>'+a.eligibleSessions+'</td><td>'+a.fullSessions+'</td></tr>'));
const filter=el('filter');
filter.insertAdjacentHTML('beforeend',assets.map(a=>'<option value="'+code(a)+'">'+a.name+' · '+code(a)+'</option>').join(''));
const picked=()=>assets.filter(a=>!filter.value||code(a)===filter.value);
const tradeCell=t=>t.date+'<span class="date-extra">信号 '+t.signal+' · PE '+t.pe.toFixed(2)+' · 分位 '+pct(t.rank)+'</span>'+
  (long?'<span class="date-extra">信号日收盘 '+t.signalClose.toFixed(2)+' 点 · 成交日指数开盘 '+t.indexOpen.toFixed(2)+' 点</span>':'')+
  '<span class="date-extra">ETF 开盘 '+t.open.toFixed(3)+' 元</span>';
function renderTrades(){
  const data=picked();
  table('tradeTable',['指数 / ETF','买入成交','卖出成交','满仓自然日','满仓交易日','本轮收益'],data.flatMap(a=>a.trades.map((t,i)=>
    '<tr id="trade-'+code(a)+'-'+i+'" tabindex="-1"><th scope="row">'+title(a)+'</th><td>'+tradeCell(t.buy)+'</td><td>'+(t.sell?tradeCell(t.sell):'<span class="pending">期末仍持有</span>')+'</td><td>'+t.duration+'</td><td>'+t.sessions+'</td><td>'+signed(t.total)+'</td></tr>')));
  const pending=data.filter(a=>a.pending).map(a=>a.name+' '+a.lastSignal.date+' 收盘分位 '+pct(a.lastSignal.rank)+'，出现'+a.pending+'信号，成交日在回测窗口之外。');
  el('status').textContent=pending.length?pending.join(' '):'成交日按开盘计算，未平仓一轮的收益按期末收盘价估值。';
}
filter.addEventListener('change',renderTrades);
el('timeline').addEventListener('click',e=>{
  const key=e.target.closest('button')?.dataset.key;
  if(!key) return;
  filter.value=key.split('-')[0];
  renderTrades();
  const row=el('trade-'+key);
  row.classList.add('trade-highlight');
  row.focus({preventScroll:true});
  row.scrollIntoView({block:'center'});
});
el('export').addEventListener('click',()=>{
  const fields=['ETF','指数',...['买入','卖出'].flatMap(side=>['信号日','分位','PE','成交日','开盘元',...(long?['信号日指数收盘点位','成交日指数开盘点位']:[])].map(field=>side+field)),'满仓自然日','满仓交易日','本轮收益','回测截止'];
  const values=t=>[...(t?[t.signal,pct(t.rank),t.pe,t.date,t.open]:['','','','期末仍持有','']),...(long?[t?.signalClose??'',t?.indexOpen??'']:[])];
  const rows=picked().flatMap(a=>a.trades.map(t=>[a.code,a.name,...values(t.buy),...values(t.sell),t.duration,t.sessions,pct(t.total),end]));
  const url=URL.createObjectURL(new Blob(['\uFEFF'+[fields,...rows].map(row=>row.join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='纯PE'+(long?'二十年':'十年')+'回测-买卖明细.csv';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
renderTrades();
