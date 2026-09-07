(function(){
  'use strict';
  const STYLE_ID='workDtPickerV3Styles';
  let modal=null,target=null,chosenDate='',chosenTime='10:00',monthView=null;
  const pad=n=>String(n).padStart(2,'0');
  const isWork=()=>typeof activeMode!=='undefined'&&activeMode==='work';
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseDate=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v||'');return m?new Date(+m[1],+m[2]-1,+m[3]):new Date()};
  const parseTime=v=>{const m=/^(\d{1,2}):(\d{2})$/.exec(v||'');return {h:m?Math.max(0,Math.min(23,+m[1])):10,min:m?Math.max(0,Math.min(59,+m[2])):0}};
  const dateText=v=>{const d=parseDate(v);return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}`};
  const timeText=v=>{const {h,min}=parseTime(v);return `${h<12?'오전':'오후'} ${h%12||12}:${pad(min)}`};
  const to24=(ap,h12,min)=>{let h=(+h12)%12;if(ap==='PM')h+=12;return `${pad(h)}:${pad(+min)}`};

  function styles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .work-dt-v3-native{display:none!important}
      .work-dt-v3-row{display:grid!important;grid-template-columns:1fr 1fr;gap:8px!important}
      .work-dt-v3-btn{height:42px;border:1px solid #d7e4f2;border-radius:12px;background:#fff;color:#45505d;padding:0 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;font:inherit;font-size:12px;font-weight:750;cursor:pointer;min-width:0}
      .work-dt-v3-btn:hover{border-color:#94b8df;box-shadow:0 4px 12px rgba(75,122,176,.12)}
      .work-dt-v3-btn span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.work-dt-v3-ico{opacity:.65;flex:none}
      .work-dt-v3-backdrop[hidden]{display:none!important}.work-dt-v3-backdrop{position:fixed;inset:0;z-index:2147483000;background:rgba(35,45,60,.28);display:grid;place-items:center;padding:18px;backdrop-filter:blur(2px)}
      .work-dt-v3-modal{width:min(420px,calc(100vw - 28px));max-height:calc(100vh - 32px);overflow:auto;background:#fff;border:1px solid #d9e5f2;border-radius:22px;box-shadow:0 28px 80px rgba(28,48,74,.24);padding:18px;color:#414a56;animation:workdtv3in .16s ease-out}
      @keyframes workdtv3in{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
      .work-dt-v3-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:13px}.work-dt-v3-head strong{font-size:17px}.work-dt-v3-x{width:31px;height:31px;border:0;border-radius:50%;background:#f2f6fb;color:#8190a2;font-size:19px}
      .work-dt-v3-label{font-size:10px;font-weight:850;color:#5f82ab;margin:12px 2px 8px;letter-spacing:.04em}
      .work-dt-v3-calhead{display:grid;grid-template-columns:34px 1fr 34px;align-items:center;margin-bottom:7px}.work-dt-v3-calhead strong{text-align:center;font-size:14px}.work-dt-v3-nav{width:32px;height:32px;border:1px solid #e1e9f3;border-radius:10px;background:#fff;color:#6c7e94;font-size:18px}
      .work-dt-v3-week,.work-dt-v3-days{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}.work-dt-v3-week span{text-align:center;font-size:9px;color:#9ea9b7;padding:4px 0}.work-dt-v3-day{height:34px;border:0;border-radius:10px;background:transparent;color:#49535f;font-size:11px;font-weight:700}.work-dt-v3-day.out{color:#c6ced8}.work-dt-v3-day.today{box-shadow:inset 0 0 0 1px #aec7e2}.work-dt-v3-day.sel{background:#76a7d8;color:#fff}
      .work-dt-v3-preview{height:44px;border-radius:13px;background:#f2f7fc;color:#4d729e;display:grid;place-items:center;font-size:18px;font-weight:850;margin-bottom:8px}.work-dt-v3-cols{height:184px;display:grid;grid-template-columns:.8fr 1fr 1fr;gap:7px}.work-dt-v3-col{overflow:auto;border:1px solid #e2eaf3;border-radius:13px;background:#fbfcfe;padding:5px;overscroll-behavior:contain;scrollbar-width:thin}.work-dt-v3-opt{width:100%;height:38px;border:0;border-radius:9px;background:transparent;color:#566271;font-size:12px;font-weight:750}.work-dt-v3-opt.on{background:#76a7d8;color:#fff}
      .work-dt-v3-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:8px;margin-top:16px;position:sticky;bottom:-18px;background:#fff;padding-top:10px}.work-dt-v3-cancel,.work-dt-v3-ok{height:43px;border-radius:13px;font-size:12px;font-weight:850}.work-dt-v3-cancel{border:1px solid #e0e8f1;background:#fff;color:#8591a0}.work-dt-v3-ok{border:0;background:#76a7d8;color:#fff;box-shadow:0 7px 16px rgba(75,122,176,.18)}
      @media(max-width:800px){.work-dt-v3-backdrop{align-items:end;padding:10px}.work-dt-v3-modal{width:100%;max-height:88vh;border-radius:22px 22px 16px 16px;padding:16px}.work-dt-v3-cols{height:205px}.work-dt-v3-opt{height:42px}}
    `;document.head.appendChild(s);
  }

  function ensureModal(){
    if(modal)return modal;
    const b=document.createElement('div');b.className='work-dt-v3-backdrop';b.hidden=true;b.innerHTML=`
      <div class="work-dt-v3-modal" role="dialog" aria-modal="true" aria-label="업무 날짜와 시간 선택">
        <div class="work-dt-v3-head"><strong>날짜 · 시간 선택</strong><button type="button" class="work-dt-v3-x">×</button></div>
        <div class="work-dt-v3-label">날짜</div>
        <div class="work-dt-v3-calhead"><button type="button" class="work-dt-v3-nav prev">‹</button><strong class="work-dt-v3-month"></strong><button type="button" class="work-dt-v3-nav next">›</button></div>
        <div class="work-dt-v3-week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="work-dt-v3-days"></div>
        <div class="work-dt-v3-label">시간</div><div class="work-dt-v3-preview"></div>
        <div class="work-dt-v3-cols"><div class="work-dt-v3-col ap"></div><div class="work-dt-v3-col hour"></div><div class="work-dt-v3-col minute"></div></div>
        <div class="work-dt-v3-actions"><button type="button" class="work-dt-v3-cancel">취소</button><button type="button" class="work-dt-v3-ok">확인</button></div>
      </div>`;
    document.body.appendChild(b);modal=b;
    b.querySelector('.work-dt-v3-x').onclick=close;b.querySelector('.work-dt-v3-cancel').onclick=close;b.querySelector('.work-dt-v3-ok').onclick=confirm;
    b.addEventListener('click',e=>{if(e.target===b)close()});
    b.querySelector('.prev').onclick=()=>{monthView=new Date(monthView.getFullYear(),monthView.getMonth()-1,1);drawCalendar()};
    b.querySelector('.next').onclick=()=>{monthView=new Date(monthView.getFullYear(),monthView.getMonth()+1,1);drawCalendar()};
    return b;
  }

  function drawCalendar(){
    const m=ensureModal(),y=monthView.getFullYear(),mo=monthView.getMonth();m.querySelector('.work-dt-v3-month').textContent=`${y}년 ${mo+1}월`;
    const box=m.querySelector('.work-dt-v3-days');box.innerHTML='';const first=new Date(y,mo,1),start=new Date(y,mo,1-first.getDay()),today=iso(new Date());
    for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const k=iso(d),btn=document.createElement('button');btn.type='button';btn.className='work-dt-v3-day';btn.textContent=d.getDate();if(d.getMonth()!==mo)btn.classList.add('out');if(k===today)btn.classList.add('today');if(k===chosenDate)btn.classList.add('sel');btn.onclick=()=>{chosenDate=k;monthView=new Date(d.getFullYear(),d.getMonth(),1);drawCalendar()};box.append(btn)}
  }
  function drawTime(){
    const m=ensureModal(),{h,min}=parseTime(chosenTime),ap=h<12?'AM':'PM',h12=h%12||12;m.querySelector('.work-dt-v3-preview').textContent=timeText(chosenTime);
    const apc=m.querySelector('.ap'),hc=m.querySelector('.hour'),mc=m.querySelector('.minute');apc.innerHTML='';hc.innerHTML='';mc.innerHTML='';
    [['AM','오전'],['PM','오후']].forEach(([v,l])=>{const b=document.createElement('button');b.type='button';b.className='work-dt-v3-opt'+(v===ap?' on':'');b.textContent=l;b.onclick=()=>{chosenTime=to24(v,h12,min);drawTime()};apc.append(b)});
    for(let n=1;n<=12;n++){const b=document.createElement('button');b.type='button';b.className='work-dt-v3-opt'+(n===h12?' on':'');b.textContent=pad(n);b.onclick=()=>{chosenTime=to24(ap,n,min);drawTime()};hc.append(b)}
    for(let n=0;n<60;n++){const b=document.createElement('button');b.type='button';b.className='work-dt-v3-opt'+(n===min?' on':'');b.textContent=pad(n);b.onclick=()=>{chosenTime=to24(ap,h12,n);drawTime()};mc.append(b)}
    requestAnimationFrame(()=>m.querySelectorAll('.work-dt-v3-opt.on').forEach(x=>x.scrollIntoView({block:'center'})));
  }
  function open(dateInput,timeInput,refresh){target={dateInput,timeInput,refresh};chosenDate=dateInput.value||iso(new Date());chosenTime=timeInput.value||'10:00';const d=parseDate(chosenDate);monthView=new Date(d.getFullYear(),d.getMonth(),1);drawCalendar();drawTime();ensureModal().hidden=false;document.body.style.overflow='hidden'}
  function close(){if(modal)modal.hidden=true;target=null;document.body.style.overflow=''}
  function confirm(){if(!target)return;target.dateInput.value=chosenDate;target.timeInput.value=chosenTime;['input','change'].forEach(t=>{target.dateInput.dispatchEvent(new Event(t,{bubbles:true}));target.timeInput.dispatchEvent(new Event(t,{bubbles:true}))});target.refresh?.();close()}

  function pairFor(input){const row=input.closest('.deadline-time-row,.dm-edit-row');if(!row)return null;const date=row.querySelector('input[type="date"],input[data-work-date]');const time=row.querySelector('input[type="time"],input[data-work-time]');return date&&time?{row,date,time}:null}
  function enhanceRow(row,date,time){
    if(!row||!date||!time||row.dataset.workDtV3==='1')return;row.dataset.workDtV3='1';row.classList.add('work-dt-v3-row');date.dataset.workDate='1';time.dataset.workTime='1';date.classList.add('work-dt-v3-native');time.classList.add('work-dt-v3-native');
    const db=document.createElement('button'),tb=document.createElement('button');db.type=tb.type='button';db.className=tb.className='work-dt-v3-btn';
    const refresh=()=>{db.innerHTML=`<span>${dateText(date.value)}</span><span class="work-dt-v3-ico">▣</span>`;tb.innerHTML=`<span>${timeText(time.value)}</span><span class="work-dt-v3-ico">◷</span>`};
    db.onclick=e=>{e.preventDefault();e.stopPropagation();open(date,time,refresh)};tb.onclick=e=>{e.preventDefault();e.stopPropagation();open(date,time,refresh)};row.append(db,tb);row._workDtV3Refresh=refresh;refresh();
  }
  function cleanupMain(){const row=document.querySelector('#deadlineForm .deadline-time-row');if(!row)return;row.querySelectorAll('.work-dt-v3-btn').forEach(x=>x.remove());row.querySelectorAll('.work-dt-v3-native').forEach(x=>x.classList.remove('work-dt-v3-native'));row.classList.remove('work-dt-v3-row');delete row.dataset.workDtV3;delete row._workDtV3Refresh}
  function enhance(){styles();if(!isWork()){cleanupMain();return}const row=document.querySelector('#deadlineForm .deadline-time-row');if(row)enhanceRow(row,document.getElementById('deadlineDate'),document.getElementById('deadlineTime'));document.querySelectorAll('.work-dm-row .dm-edit-row').forEach(r=>enhanceRow(r,r.querySelector('input[type="date"],input[data-work-date]'),r.querySelector('input[type="time"],input[data-work-time]')))}

  // Native pickers are blocked in work mode even during the tiny gap before enhancement.
  ['pointerdown','mousedown','click'].forEach(type=>document.addEventListener(type,e=>{if(!isWork())return;const i=e.target.closest?.('#deadlineDate,#deadlineTime,.work-dm-row input[type="date"],.work-dm-row input[type="time"]');if(!i)return;const p=pairFor(i);if(!p)return;e.preventDefault();e.stopImmediatePropagation();if(type==='click')open(p.date,p.time,p.row._workDtV3Refresh)},true));

  const obs=new MutationObserver(()=>requestAnimationFrame(enhance));obs.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','data-mode']});
  document.addEventListener('click',e=>{if(e.target.closest?.('.mode-btn,.deadline-add-toggle,.dm-tools'))setTimeout(enhance,10)},true);
  window.addEventListener('load',enhance);setInterval(enhance,500);setTimeout(enhance,0);
})();