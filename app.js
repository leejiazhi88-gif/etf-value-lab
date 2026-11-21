'use strict';
const {assets, methods, policy, context, starCheck} = window.RESEARCH;
const get = id => document.getElementById(id);
const controls = ['period','fee','metric','asset','curveMetric'].map(get);
const [period,fee,metric,asset,curveMetric] = controls;
const colors = ['#b9c8c9','#9c9bf2','#63b6ff','#f2c773','#5cdac0','#e9976d','#db8bd0','#a2bf74','#ffffff'];
const shown = new Set([0,2,3,8]);
const pct = x => ((Math.abs(x)<0.00005?0:x)*100).toFixed(2)+'%';
const option = (label,i) => '<option value="'+i+'">'+label+'</option>';
period.innerHTML=assets[0].periods.map((p,i)=>option(p.label,i)).join('');
asset.innerHTML=assets.map((a,i)=>option(a.asset[0]+' · '+a.asset[2].split('.')[0],i)).join('');
get('policy').innerHTML=policy.map(p=>'<li><a href="'+p.url+'">'+p.date+' '+p.title+'</a></li>').join('');
const base='https://github.com/leejiazhi88-gif/';
const contextCard=(label,copy,repo)=>'<article><h3>'+label+'</h3><p>'+copy+' <a href="'+base+repo+'">查看项目</a></p></article>';
const [sh,sz]=context.broad;
get('context').innerHTML=[
  contextCard('项目 1 · 沪深市场',sh.date+'，沪市 PE '+sh.pe.toFixed(2)+'、深市 PE '+sz.pe.toFixed(2)+'。提供市场宽口径估值、周度换手、ETF 申赎、政策事件和国家队持有人报告。','1-BigA-total'),
  contextCard('项目 2 · 全市场个股分布',context.market.date+'，个股 PE 中位数 '+context.market.pe+'，用于观察市场估值背景。','2-BigAtotal2'),
  contextCard('项目 2.2 · 行业背景',context.industry.date+'，申万电子 PE '+context.industry.pe+'，用于对照成长板块的行业估值。','2.2-quanlantu'),
  contextCard('项目 6 · 成长指数',context.star.date+'，项目记录的科创50官方 PE 为 '+context.star.pe+'，与回测所用 Tushare PE(TTM) 属不同估值序列。项目同时提供创业板 PB 和创业板、科创50换手率。','6-Bili-xiaodeng')
].join('');
get('legend').innerHTML=methods.map((name,i)=>'<label><input type="checkbox" value="'+i+'" '+(shown.has(i)?'checked':'')+'><span style="color:'+colors[i]+'">'+name+'</span></label>').join('');
get('legend').addEventListener('change', e=>{
  const i=Number(e.target.value);
  if(e.target.checked) shown.add(i);
  else shown.delete(i);
  draw();
});
const chosen = () => assets[Number(asset.value)];
const currentPeriod = a => a.periods[Number(period.value)];
const currentResults = a => currentPeriod(a).rates[Number(fee.value)];
const labelFor = key => key==='drawdown' ? '最大回撤' : metric.selectedOptions[0].text;
function render(){
  const selected=chosen(), p=currentPeriod(selected), rs=currentResults(selected);
  const key=metric.value;
  get('window').textContent=(period.value==='3'?'起始日按 ETF 实盘行情与估值覆盖确定。不同区间的收益仅供各自比较。':p.start+' 至 '+p.end+'，各策略使用相同区间和成本。')+' 表中显示'+labelFor(key)+'。';
  get('matrix').innerHTML='<thead><tr><th scope="col">指数 / ETF</th>'+methods.map((m,i)=>'<th scope="col" class="'+(i===3?'primary':'')+'">'+m+'</th>').join('')+'</tr></thead><tbody>'+assets.map((a,i)=>
    '<tr><th scope="row"><button class="asset-link" data-asset="'+i+'">'+a.asset[0]+' <small>'+a.asset[2].split('.')[0]+'</small></button></th>'+currentResults(a).map((r,j)=>'<td class="'+(j===3?'primary ':'')+(['annual','total'].includes(key)?(r[key]>=0?'pos':'neg'):'')+'">'+pct(r[key])+'</td>').join('')+'</tr>').join('')+'</tbody>';
  const better = (from,to) => assets.filter(a=>currentResults(a)[to].annual>currentResults(a)[from].annual+0.000005).length;
  get('summary').textContent='当前设置下，PE/PB 年化超过买入持有的有 '+better(0,3)+' / 6 只，综合策略超过 PE/PB 的有 '+better(3,8)+' / 6 只。';
  const v=selected.latest;
  get('stats').innerHTML=[
    ['交易标的',selected.asset[2].split('.')[0]],
    ['估值日期',v.date],
    ['PE(TTM) / PB',v.pe.toFixed(2)+' / '+v.pb.toFixed(2)],
    ['PE/PB 平均分位',pct((v.peRank+v.pbRank)/2)],
    ['PE/PB 期末仓位',pct(rs[3].curve.at(-1)[2])],
    ['通过门槛的国家队披露次数',selected.nationalEvents]
  ].map(([label,value])=>'<div class="stat"><small>'+label+'</small><strong>'+value+'</strong></div>').join('');
  get('chartTitle').textContent=selected.asset[0]+' · '+(curveMetric.value==='1'?'净值':'ETF 仓位');
  get('details').innerHTML='<thead><tr>'+['策略','累计收益','年化收益','最大回撤','平均仓位','累计换手','成交次数','修正生效周'].map(x=>'<th scope="col">'+x+'</th>').join('')+'</tr></thead><tbody>'+rs.map((r,i)=>
    '<tr class="'+(i===3?'primary':'')+'"><th scope="row">'+methods[i]+'</th>'+['total','annual','drawdown','weight','turnover'].map(k=>'<td>'+pct(r[k])+'</td>').join('')+'<td>'+r.trades+'</td><td>'+r.modifiers+'</td></tr>').join('')+'</tbody>';
  get('starWindow').textContent=starCheck.start+' 至 '+starCheck.end+'。中证官网 PE 序列达到 240 个有效交易日后开始比较。仅替换 PE 数据源，使用相同 PB、成交窗口与成本。';
  get('starCheck').innerHTML='<thead><tr><th scope="col">策略</th><th scope="col">累计收益</th><th scope="col">最大回撤</th></tr></thead><tbody>'+starCheck.rates[Number(fee.value)].map((r,i)=>'<tr><th scope="row">'+['买入持有','Tushare PE / PB','中证官网 PE / PB'][i]+'</th><td>'+pct(r.total)+'</td><td>'+pct(r.drawdown)+'</td></tr>').join('')+'</tbody>';
  draw();
}
get('matrix').addEventListener('click',e=>{
  const button=e.target.closest('[data-asset]');
  if(!button) return;
  asset.value=button.dataset.asset;
  render();
  get('detail').scrollIntoView();
  asset.focus({preventScroll:true});
});
controls.forEach(el=>el.addEventListener('change',render));
const c=get('curve'), ctx=c.getContext('2d');
const axis=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2});
let frame;
function draw(hover){
  const rs=currentResults(chosen()), series=[...shown].map(i=>({i,curve:rs[i].curve}));
  const p=currentPeriod(chosen());
  const col=Number(curveMetric.value);
  const w=c.clientWidth,h=c.clientHeight,dpr=window.devicePixelRatio||1;
  if(!w||!h) return;
  c.width=w*dpr; c.height=h*dpr; ctx.scale(dpr,dpr);
  const left=48, right=w-14, top=18, bottom=h-27;
  const values=series.flatMap(s=>s.curve.map(x=>x[col]));
  const low=col===2 ? 0 : Math.min(1,...values)*.95, high=col===2 ? 1 : Math.max(1,...values)*1.05;
  const dates=rs[0].curve.map(r=>r[0]);
  const start=Date.parse(p.start), duration=Date.parse(p.end)-start;
  const x=date=>left+(Date.parse(date)-start)/duration*(right-left);
  const y=v=>bottom-(v-low)/(high-low)*(bottom-top);
  ctx.font='11px system-ui';
  ctx.fillStyle='#a6baba';ctx.strokeStyle='#304348';
  ctx.textAlign='right';
  for(let i=0;i<=4;i++){
    const v=low+(high-low)*i/4, yy=y(v);
    ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(right,yy);ctx.stroke();
    ctx.fillText(col===2?Math.round(v*100)+'%':axis.format(v),left-7,yy+4);
  }
  for(const i of w<600?[0,1,2]:[0,1,2,3,4]){
    const n=w<600?2:4;
    const d=dates[Math.round(i/n*(dates.length-1))];
    ctx.textAlign=i===0?'left':i===n?'right':'center';
    ctx.fillText(d.slice(0,7),x(d),bottom+17);
  }
  for(const {i,curve} of series){
    ctx.strokeStyle=colors[i];ctx.lineWidth=i===3?2.4:1.6;
    ctx.beginPath();
    curve.forEach((r,j)=>j?ctx.lineTo(x(r[0]),y(r[col])):ctx.moveTo(x(r[0]),y(r[col])));
    ctx.stroke();
  }
  const nearest=hover===undefined?null:dates.reduce((a,b)=>Math.abs(x(b)-hover)<Math.abs(x(a)-hover)?b:a);
  if(nearest){
    ctx.strokeStyle='#a6baba';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x(nearest),top);ctx.lineTo(x(nearest),bottom);ctx.stroke();
  }
  const d=nearest||p.end;
  get('chartReadout').textContent=series.length ? d+'　'+series.map(s=>{
    const v=s.curve.find(r=>r[0]===d)[col];
    return methods[s.i]+' '+(col===2?pct(v):v.toFixed(3));
  }).join('　') : '勾选策略查看曲线。';
}
c.addEventListener('pointermove',e=>{ cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>draw(e.offsetX)); });
c.addEventListener('pointerleave',()=>{cancelAnimationFrame(frame);draw();});
new ResizeObserver(()=>draw()).observe(c);
get('export').addEventListener('click',()=>{
  const rows=[['指数','ETF','起始日','截止日','单边成本','策略','累计收益','年化收益','最大回撤','平均仓位','累计换手','成交次数','修正生效周']];
  for(const a of assets){
    const p=currentPeriod(a);
    currentResults(a).forEach((r,i)=>rows.push([a.asset[0],a.asset[2],p.start,p.end,fee.selectedOptions[0].text,methods[i],pct(r.total),pct(r.annual),pct(r.drawdown),pct(r.weight),pct(r.turnover),r.trades,r.modifiers]));
  }
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='ETF-回测-'+period.selectedOptions[0].text+'.csv';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
render();
