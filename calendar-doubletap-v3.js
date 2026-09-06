(function(){
  const grid=document.getElementById('grid');
  if(!grid)return;

  let lastTapAt=0;
  let lastTapKey='';
  const DOUBLE_TAP_MS=460;

  function dateForDay(day){
    const days=[...grid.querySelectorAll('.day')];
    const index=days.indexOf(day);
    if(index<0)return null;
    const y=view.getFullYear(),m=view.getMonth();
    const first=new Date(y,m,1);
    const start=new Date(y,m,1-first.getDay());
    const d=new Date(start);
    d.setDate(start.getDate()+index);
    d.setHours(0,0,0,0);
    return d;
  }

  function selectDateOnly(d){
    selected=new Date(d);
    if(d.getMonth()!==view.getMonth()||d.getFullYear()!==view.getFullYear()){
      view=new Date(d.getFullYear(),d.getMonth(),1);
    }
    if(typeof closeDayManager==='function')closeDayManager();
    renderAll();
  }

  function openManagerFor(d){
    selected=new Date(d);
    if(d.getMonth()!==view.getMonth()||d.getFullYear()!==view.getFullYear()){
      view=new Date(d.getFullYear(),d.getMonth(),1);
    }
    if(typeof closeDayManager==='function')closeDayManager();
    renderAll();
    requestAnimationFrame(()=>{
      if(typeof dayManagerEditing!=='undefined')dayManagerEditing=null;
      if(typeof renderDayManager==='function')renderDayManager(true);
    });
  }

  // This capture listener is registered before deadline/day-manager listeners.
  // It is the single authority for calendar day taps on every device.
  grid.addEventListener('click',e=>{
    const day=e.target.closest('.day');
    if(!day||!grid.contains(day))return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const d=dateForDay(day);
    if(!d)return;
    const key=dateKey(d);
    const now=Date.now();
    const isDouble=lastTapKey===key && (now-lastTapAt)<=DOUBLE_TAP_MS;

    if(isDouble){
      lastTapAt=0;
      lastTapKey='';
      openManagerFor(d);
    }else{
      lastTapAt=now;
      lastTapKey=key;
      selectDateOnly(d);
    }
  },true);

  // Desktop native double-click fallback. Mobile uses the click-pair detector above.
  grid.addEventListener('dblclick',e=>{
    const day=e.target.closest('.day');
    if(!day||!grid.contains(day))return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    lastTapAt=0;
    lastTapKey='';
    const d=dateForDay(day);
    if(d)openManagerFor(d);
  },true);

  const style=document.createElement('style');
  style.textContent='#grid .day{touch-action:manipulation;-webkit-tap-highlight-color:transparent}';
  document.head.appendChild(style);
})();
