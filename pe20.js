'use strict';
(() => {
  const {assets,start,end,endExclusive}=window.PE10;
  const get=id=>document.getElementById(id);
  const select=get('chartAsset');
  const range=get('chartRange');
  const canvases=[get('pointsChart'),get('peChart'),get('rankChart')];
  const fmt=new Intl.NumberFormat('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
  select.innerHTML=assets.map((a,i)=>'<option value="'+i+'">'+a.name+' · '+a.code.split('.')[0]+'</option>').join('');
  const asset=()=>assets[Number(select.value)];
  const markers=()=>asset().trades.flatMap((t,i)=>[
    {trade:t.buy,buy:true,round:i},...(t.sell?[{trade:t.sell,buy:false,round:i}]:[])
  ]);
  const tag=m=>m.buy?'买':'卖';
  const paint=m=>m.buy?'#79d8b0':'#f59a93';
  let picked=0;
  let begin=start, visible=[], cursor=0, frame;
  const hitPoints=[];
  const timeScale=[];
  function draw(canvas,metric){
    const ctx=canvas.getContext('2d'), a=asset(), sigs=markers();
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(!w||!h) return;
    const dpr=window.devicePixelRatio||1;
    canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);
    const t0=Date.parse(begin),t1=Date.parse(endExclusive);
    const left=56,right=w-14,top=14,bottom=h-30;
    const x=d=>left+(Date.parse(d)-t0)/(t1-t0)*(right-left);
    timeScale[metric-1]=px=>t0+(px-left)/(right-left)*(t1-t0);
    const rankPlot=metric===3;
    const values=visible.map(r=>r[metric]).filter(Number.isFinite);
    const markerValue=m=>metric===1?m.trade.signalClose:m.trade.pe;
    const lo=rankPlot?0:Math.max(0,Math.min(...values,...sigs.map(markerValue))*.91);
    const hi=rankPlot?1:Math.max(...values,...sigs.map(markerValue))*1.12;
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
      ctx.fillText(rankPlot?Math.round(n*100)+'%':Math.round(n).toLocaleString('zh-CN'),left-7,yy+4);
    }
    const startYear=Number(begin.slice(0,4));
    const endYear=Number(end.slice(0,4));
    const increment=Math.ceil((endYear-startYear+1)/(w<600?4:8));
    ctx.textAlign='center';
    for(let yr=startYear;yr<=endYear;yr+=increment) {
      const d=yr===startYear?begin:yr+'-01-01';
      ctx.fillText(String(yr),x(d),bottom+18);
    }
    const lineColor=['#f2c773','#8fc4d7','#bbabec'][metric-1];
    ctx.strokeStyle=lineColor;ctx.lineWidth=1.45;
    for(const partial of rankPlot?[true,false]:[false]){
      ctx.setLineDash(partial?[4,3]:[]);
      ctx.beginPath();
      let previous, penDown=false;
      for(const r of visible){
        if(previous&&Number.isFinite(r[metric])&&(!rankPlot||r[4]===partial)){
          if(!penDown) ctx.moveTo(x(previous[0]),y(previous[metric]));
          ctx.lineTo(x(r[0]),y(r[metric]));
          penDown=true;
        } else penDown=false;
        previous=Number.isFinite(r[metric])?r:undefined;
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const points=(rankPlot?[]:sigs).map((m,i)=>{
      const px=x(m.trade.signal),py=y(markerValue(m));
      ctx.beginPath();
      if(m.buy) ctx.arc(px,py,5,0,2*Math.PI);
      else {ctx.moveTo(px,py-6);ctx.lineTo(px+6,py);ctx.lineTo(px,py+6);ctx.lineTo(px-6,py);ctx.closePath();}
      ctx.fillStyle=paint(m);ctx.fill();
      ctx.strokeStyle=i===picked?'#fff4d4':'#132125';ctx.lineWidth=i===picked?2.5:1;ctx.stroke();
      return {px,py};
    });
    hitPoints[metric-1]=points;
    const row=visible[cursor];
    if(!row) return;
    const xx=x(row[0]);
    ctx.strokeStyle='#becbcb';ctx.lineWidth=1;
    ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,bottom);ctx.stroke();ctx.setLineDash([]);
    if(Number.isFinite(row[metric])){
      ctx.fillStyle=lineColor;ctx.beginPath();ctx.arc(xx,y(row[metric]),3.6,0,2*Math.PI);ctx.fill();
    }
  }
  function renderCursor(){
    const [date,points,pe,rank,partial]=visible[cursor];
    const time=get('cursorDate');
    time.dateTime=date;time.textContent=date;
    get('cursorPoints').textContent=fmt.format(points)+' 点';
    get('cursorPe').textContent=pe===null?'暂无数据':fmt.format(pe)+' 倍';
    get('cursorRank').textContent=rank===null?'样本不足':fmt.format(rank*100)+'%'+(partial?'（历史不足十年）':'');
    canvases.forEach((c,i)=>draw(c,i+1));
  }
  function setCursor(i){
    if(i===cursor) return;
    cursor=i;
    renderCursor();
  }
  function moveCursor(canvas,px){
    if(!timeScale[canvas]) return;
    const time=timeScale[canvas](px);
    let start=0,end=visible.length-1;
    while(start<end){
      const mid=Math.floor((start+end)/2);
      if(Date.parse(visible[mid][0])<time) start=mid+1;
      else end=mid;
    }
    const earlier=start>0&&time-Date.parse(visible[start-1][0])<Date.parse(visible[start][0])-time;
    setCursor(earlier?start-1:start);
  }
  function renderMarkers(){
    const list=markers(), m=list[picked];
    get('markerChoices').innerHTML=list.map((s,i)=>'<button type="button" data-marker="'+i+'" aria-pressed="'+(i===picked)+'">'+tag(s)+' '+s.trade.signal+'</button>').join('');
    if(m){
      const t=m.trade;
      const key=asset().code.split('.')[0]+'-'+m.round;
      get('markerInfo').innerHTML='<strong style="color:'+paint(m)+'">'+(m.buy?'买入':'卖出')+'信号 '+t.signal+'</strong> · 指数收盘 '+fmt.format(t.signalClose)+' 点 · PE '+fmt.format(t.pe)+' 倍 · 三年分位 '+fmt.format(t.rank*100)+'%<br>成交 '+t.date+' · 指数开盘 '+fmt.format(t.indexOpen)+' 点 · ETF 开盘 '+t.open.toFixed(3)+' 元 · <a href="#trades" data-trade="'+key+'">查看本轮明细</a>';
    }
    canvases.forEach((c,i)=>draw(c,i+1));
  }
  function render(){
    cancelAnimationFrame(frame);
    const a=asset(), firstSignal=markers()[0]?.trade.signal;
    begin=range.value==='active'?(firstSignal<a.firstEligible?firstSignal:a.firstEligible):start;
    visible=a.weekly.filter(r=>r[0]>=begin);
    cursor=visible.length-1;
    renderMarkers();
    renderCursor();
  }
  select.addEventListener('change',()=>{picked=0;render();});
  range.addEventListener('change',render);
  get('markerChoices').addEventListener('click',e=>{
    const btn=e.target.closest('button');
    if(!btn) return;
    picked=Number(btn.dataset.marker);
    renderMarkers();
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
    c.addEventListener('pointermove',e=>{
      const x=e.offsetX;
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>moveCursor(i,x));
    });
    c.addEventListener('pointerleave',e=>{
      if(e.pointerType==='touch') return;
      cancelAnimationFrame(frame);
      setCursor(visible.length-1);
    });
    c.addEventListener('keydown',e=>{
      if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight') return;
      e.preventDefault();
      setCursor(Math.min(visible.length-1,Math.max(0,cursor+(e.key==='ArrowLeft'?-1:1))));
    });
    c.addEventListener('click',e=>{
      moveCursor(i,e.offsetX);
      let closest=15,index=-1;
      hitPoints[i].forEach((p,j)=>{
        const delta=Math.hypot(e.offsetX-p.px,e.offsetY-p.py);
        if(delta<closest){closest=delta;index=j;}
      });
      if(index>=0){picked=index;renderMarkers();}
    });
    new ResizeObserver(()=>draw(c,i+1)).observe(c);
  });
  render();
})();
