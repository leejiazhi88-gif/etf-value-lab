'use strict';
(() => {
  const {assets,start,end,endExclusive}=window.PE10;
  const get=id=>document.getElementById(id);
  const select=get('chartAsset');
  const range=get('chartRange');
  const canvases=[get('pointsChart'),get('peChart')];
  const fmt=new Intl.NumberFormat('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
  select.innerHTML=assets.map((a,i)=>'<option value="'+i+'">'+a.name+' · '+a.code.split('.')[0]+'</option>').join('');
  const asset=()=>assets[Number(select.value)];
  const markers=()=>asset().trades.flatMap((t,i)=>[
    {trade:t.buy,buy:true,round:i},...(t.sell?[{trade:t.sell,buy:false,round:i}]:[])
  ]);
  const tag=m=>m.buy?'买':'卖';
  const paint=m=>m.buy?'#79d8b0':'#f59a93';
  let picked=0;
  let hitPoints=[];
  function draw(canvas,metric){
    const ctx=canvas.getContext('2d'), a=asset(), sigs=markers();
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(!w||!h) return;
    const dpr=window.devicePixelRatio||1;
    canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);
    const begin=range.value==='active'?(sigs[0]?.trade.signal<a.firstEligible?sigs[0].trade.signal:a.firstEligible):start;
    const t0=Date.parse(begin),t1=Date.parse(endExclusive);
    const left=56,right=w-14,top=14,bottom=h-30;
    const x=d=>left+(Date.parse(d)-t0)/(t1-t0)*(right-left);
    const line=a.weekly.filter(r=>r[0]>=begin);
    const values=line.map(r=>r[metric]).filter(Number.isFinite);
    const markerValue=m=>metric===1?m.trade.signalClose:m.trade.pe;
    const min=Math.min(...values,...sigs.map(markerValue)),max=Math.max(...values,...sigs.map(markerValue));
    const lo=Math.max(0,min-(max-min)*.09),hi=max+(max-min)*.12;
    const y=n=>bottom-(n-lo)/(hi-lo)*(bottom-top);
    ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
    ctx.fillStyle='#293135';
    if(a.firstEligible>begin) ctx.fillRect(left,top,x(a.firstEligible)-left,bottom-top);
    ctx.fillStyle='#25443c';
    for(const t of a.trades) ctx.fillRect(x(t.buy.date),top,x(t.sell?.date||endExclusive)-x(t.buy.date),bottom-top);
    ctx.restore();
    ctx.font='11px system-ui';
    ctx.fillStyle='#a6baba';ctx.strokeStyle='#3b4c51';ctx.textAlign='right';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const n=lo+(hi-lo)*i/4, yy=y(n);
      ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(right,yy);ctx.stroke();
      ctx.fillText(Math.round(n).toLocaleString('zh-CN'),left-7,yy+4);
    }
    const startYear=Number(begin.slice(0,4));
    const endYear=Number(end.slice(0,4));
    const increment=Math.ceil((endYear-startYear+1)/(w<600?4:8));
    ctx.textAlign='center';
    for(let yr=startYear;yr<=endYear;yr+=increment) {
      const d=yr===startYear?begin:yr+'-01-01';
      ctx.fillText(String(yr),x(d),bottom+18);
    }
    ctx.strokeStyle=metric===1?'#f2c773':'#8fc4d7';ctx.lineWidth=1.45;
    ctx.beginPath();
    let penDown=false;
    for(const r of line){
      if(!Number.isFinite(r[metric])) {penDown=false;continue;}
      if(penDown) ctx.lineTo(x(r[0]),y(r[metric]));
      else ctx.moveTo(x(r[0]),y(r[metric]));
      penDown=true;
    }
    ctx.stroke();
    const points=sigs.map((m,i)=>{
      const px=x(m.trade.signal),py=y(markerValue(m));
      ctx.beginPath();
      if(m.buy) ctx.arc(px,py,5,0,2*Math.PI);
      else {ctx.moveTo(px,py-6);ctx.lineTo(px+6,py);ctx.lineTo(px,py+6);ctx.lineTo(px-6,py);ctx.closePath();}
      ctx.fillStyle=paint(m);ctx.fill();
      ctx.strokeStyle=i===picked?'#fff4d4':'#132125';ctx.lineWidth=i===picked?2.5:1;ctx.stroke();
      return {px,py};
    });
    hitPoints[metric-1]=points;
  }
  function render(){
    const list=markers(), m=list[picked];
    get('markerChoices').innerHTML=list.map((s,i)=>'<button type="button" data-marker="'+i+'" aria-pressed="'+(i===picked)+'">'+tag(s)+' '+s.trade.signal+'</button>').join('');
    if(m){
      const t=m.trade;
      const key=asset().code.split('.')[0]+'-'+m.round;
      get('markerInfo').innerHTML='<strong style="color:'+paint(m)+'">'+(m.buy?'买入':'卖出')+'信号 '+t.signal+'</strong> · 指数收盘 '+fmt.format(t.signalClose)+' 点 · PE '+fmt.format(t.pe)+' 倍 · 分位 '+fmt.format(t.rank*100)+'%<br>成交 '+t.date+' · 指数开盘 '+fmt.format(t.indexOpen)+' 点 · ETF 开盘 '+t.open.toFixed(3)+' 元 · <a href="#trades" data-trade="'+key+'">查看本轮明细</a>';
    }
    canvases.forEach((c,i)=>draw(c,i+1));
  }
  select.addEventListener('change',()=>{picked=0;render();});
  range.addEventListener('change',render);
  get('markerChoices').addEventListener('click',e=>{
    const btn=e.target.closest('button');
    if(!btn) return;
    picked=Number(btn.dataset.marker);
    render();
    get('markerChoices').children[picked].focus({preventScroll:true});
  });
  get('markerInfo').addEventListener('click',e=>{
    const link=e.target.closest('[data-trade]');
    if(!link) return;
    e.preventDefault();
    const key=link.dataset.trade;
    const filter=get('filter');
    filter.value=key.split('-')[0];
    filter.dispatchEvent(new Event('change'));
    const row=get('trade-'+key);
    row.classList.add('trade-highlight');
    row.focus({preventScroll:true});
    row.scrollIntoView({block:'center'});
  });
  canvases.forEach((c,i)=>{
    c.addEventListener('click',e=>{
      let closest=15,index=-1;
      hitPoints[i].forEach((p,j)=>{
        const delta=Math.hypot(e.offsetX-p.px,e.offsetY-p.py);
        if(delta<closest){closest=delta;index=j;}
      });
      if(index>=0){picked=index;render();}
    });
    new ResizeObserver(()=>draw(c,i+1)).observe(c);
  });
  render();
})();
