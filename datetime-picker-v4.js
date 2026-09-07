(function(){
  const STYLE_ID='todoDateTimePickerV4Styles';
  let picker=null;
  let current=null;
  let chosenDate='';
  let chosenTime='';
  let calendarView=new Date();

  const pad=n=>String(n).padStart(2,'0');
  const toIso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  function parseDate(v){
    if(/^\d{4}-\d{2}-\d{2}$/.test(v||'')){
      const [y,m,d]=v.split('-').map(Number);
      return new Date(y,m-1,d);
    }
    return new Date();
  }
  function parseTime(v){
    const m=/^(\d{1,2}):(\d{2})$/.exec(v||'');
    let h=m?Number(m[1]):23;
    let min=m?Number(m[2]):59;
    h=Math.max(0,Math.min(23,h));
    min=Math.max(0,Math.min(59,min));
    return {h,min};
  }
  function dateLabel(v){
    const d=parseDate(v);
    return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.`;
  }
  function timeLabel(v){
    const {h,min}=parseTime(v);
    const ap=h<12?'오전':'오후';
    const hh=h%12||12;
    return `${ap} ${pad(hh)}:${pad(min)}`;
  }
  function to24(ap,h12,min){
    let h=Number(h12)%12;
    if(ap==='PM')h+=12;
    return `${pad(h)}:${pad(Number(min))}`;
  }

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .dtv4-native{display:none!important;pointer-events:none!important}
      .dtv4-ready{display:block!important}
      .dtv4-display-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;width:100%}
      .dtv4-display{
        min-width:0;height:42px;padding:0 12px;border:1px solid var(--line);border-radius:12px;background:#fff;
        color:var(--text);font:inherit;font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;
        cursor:pointer;touch-action:manipulation;transition:border-color .14s ease,box-shadow .14s ease,transform .12s ease;
      }
      .dtv4-display:hover{border-color:var(--accent);box-shadow:0 4px 14px var(--accent-shadow)}
      .dtv4-display:active{transform:scale(.985)}
      .dtv4-value{font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dtv4-icon{font-size:14px;opacity:.72;flex:none}

      .dtv4-backdrop{position:fixed;inset:0;z-index:100000;background:rgba(39,43,52,.26);backdrop-filter:blur(2px);display:grid;place-items:center;padding:18px}
      .dtv4-backdrop[hidden]{display:none!important}
      .dtv4-picker{width:min(430px,calc(100vw - 28px));max-height:min(720px,calc(100vh - 28px));overflow:auto;background:#fff;border:1px solid var(--line);border-radius:22px;box-shadow:0 24px 80px rgba(42,47,58,.22);padding:18px;color:var(--text);animation:dtv4in .16s ease-out}
      @keyframes dtv4in{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
      .dtv4-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
      .dtv4-head strong{font-size:17px}.dtv4-close{width:31px;height:31px;border:0;border-radius:50%;background:#f4f3f5;color:#999;font-size:19px;cursor:pointer}
      .dtv4-title{font-size:11px;font-weight:850;color:var(--accent-deep);margin:12px 2px 8px}
      .dtv4-cal-head{display:grid;grid-template-columns:34px 1fr 34px;align-items:center;margin-bottom:6px}
      .dtv4-cal-head strong{text-align:center;font-size:14px}.dtv4-nav{width:32px;height:32px;border:1px solid var(--line);border-radius:10px;background:#fff;color:#777;cursor:pointer;font-size:18px}
      .dtv4-week,.dtv4-days{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}.dtv4-week span{text-align:center;padding:4px 0;font-size:9px;font-weight:750;color:#aaa}
      .dtv4-day{height:34px;border:0;border-radius:10px;background:transparent;color:var(--text);font-size:11px;font-weight:700;cursor:pointer}
      .dtv4-day.out{opacity:.34}.dtv4-day.today{box-shadow:inset 0 0 0 1px var(--accent)}.dtv4-day.selected{background:var(--accent);color:#fff;box-shadow:0 5px 12px var(--accent-shadow)}
      .dtv4-preview{height:44px;border-radius:13px;background:var(--soft);display:flex;align-items:center;justify-content:center;color:var(--accent-deep);font-size:18px;font-weight:850;margin-bottom:8px}
      .dtv4-time-cols{display:grid;grid-template-columns:.82fr 1fr 1fr;gap:7px;height:188px}
      .dtv4-col{overflow:auto;border:1px solid var(--line);border-radius:13px;background:#fff;padding:5px;scrollbar-width:thin;overscroll-behavior:contain}
      .dtv4-option{width:100%;height:38px;border:0;border-radius:9px;background:transparent;color:var(--text);font-size:12px;font-weight:760;cursor:pointer}
      .dtv4-option.on{background:var(--accent);color:#fff;box-shadow:0 4px 10px var(--accent-shadow)}
      .dtv4-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:8px;margin-top:16px;position:sticky;bottom:-18px;background:#fff;padding-top:10px}
      .dtv4-cancel,.dtv4-confirm{height:43px;border-radius:13px;font-size:12px;font-weight:850;cursor:pointer}
      .dtv4-cancel{border:1px solid var(--line);background:#fff;color:#888}.dtv4-confirm{border:0;background:var(--accent);color:#fff;box-shadow:0 7px 16px var(--accent-shadow)}
      @media(max-width:800px){.dtv4-backdrop{align-items:end;padding:10px}.dtv4-picker{width:100%;max-height:88vh;border-radius:22px 22px 16px 16px;padding:16px}.dtv4-time-cols{height:210px}.dtv4-option{height:42px}}
    `;
    document.head.appendChild(style);
  }

  function ensurePicker(){
    if(picker)return picker;
    const back=document.createElement('div');
    back.className='dtv4-backdrop';
    back.hidden=true;
    back.innerHTML=`
      <div class="dtv4-picker" role="dialog" aria-modal="true" aria-label="날짜와 시간 선택">
        <div class="dtv4-head"><strong>날짜 · 시간 선택</strong><button class="dtv4-close" type="button" aria-label="닫기">×</button></div>
        <div class="dtv4-title">날짜</div>
        <div class="dtv4-cal-head"><button class="dtv4-nav prev" type="button">‹</button><strong class="dtv4-month"></strong><button class="dtv4-nav next" type="button">›</button></div>
        <div class="dtv4-week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
        <div class="dtv4-days"></div>
        <div class="dtv4-title">시간</div>
        <div class="dtv4-preview"></div>
        <div class="dtv4-time-cols"><div class="dtv4-col ap"></div><div class="dtv4-col hour"></div><div class="dtv4-col minute"></div></div>
        <div class="dtv4-actions"><button class="dtv4-cancel" type="button">취소</button><button class="dtv4-confirm" type="button">확인</button></div>
      </div>`;
    document.body.appendChild(back);
    picker=back;
    back.querySelector('.dtv4-close').onclick=closePicker;
    back.querySelector('.dtv4-cancel').onclick=closePicker;
    back.querySelector('.dtv4-confirm').onclick=confirmPicker;
    back.querySelector('.dtv4-nav.prev').onclick=()=>{calendarView=new Date(calendarView.getFullYear(),calendarView.getMonth()-1,1);renderCalendar()};
    back.querySelector('.dtv4-nav.next').onclick=()=>{calendarView=new Date(calendarView.getFullYear(),calendarView.getMonth()+1,1);renderCalendar()};
    back.addEventListener('click',e=>{if(e.target===back)closePicker()});
    return back;
  }

  function renderCalendar(){
    const p=ensurePicker();
    const y=calendarView.getFullYear(),m=calendarView.getMonth();
    p.querySelector('.dtv4-month').textContent=`${y}년 ${m+1}월`;
    const days=p.querySelector('.dtv4-days');days.innerHTML='';
    const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay()),today=toIso(new Date());
    for(let i=0;i<42;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);const key=toIso(d);
      const b=document.createElement('button');b.type='button';b.className='dtv4-day';b.textContent=d.getDate();
      if(d.getMonth()!==m)b.classList.add('out');if(key===today)b.classList.add('today');if(key===chosenDate)b.classList.add('selected');
      b.onclick=()=>{chosenDate=key;calendarView=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar()};days.appendChild(b);
    }
  }

  function renderTime(){
    const p=ensurePicker(),{h,min}=parseTime(chosenTime),ap=h<12?'AM':'PM',h12=h%12||12;
    p.querySelector('.dtv4-preview').textContent=timeLabel(chosenTime);
    const apCol=p.querySelector('.dtv4-col.ap'),hCol=p.querySelector('.dtv4-col.hour'),mCol=p.querySelector('.dtv4-col.minute');
    apCol.innerHTML='';hCol.innerHTML='';mCol.innerHTML='';
    [['AM','오전'],['PM','오후']].forEach(([v,label])=>{const b=document.createElement('button');b.type='button';b.className='dtv4-option'+(v===ap?' on':'');b.textContent=label;b.onclick=()=>{chosenTime=to24(v,h12,min);renderTime()};apCol.appendChild(b)});
    for(let n=1;n<=12;n++){const b=document.createElement('button');b.type='button';b.className='dtv4-option'+(n===h12?' on':'');b.textContent=pad(n);b.onclick=()=>{chosenTime=to24(ap,n,min);renderTime()};hCol.appendChild(b)}
    for(let n=0;n<60;n++){const b=document.createElement('button');b.type='button';b.className='dtv4-option'+(n===min?' on':'');b.textContent=pad(n);b.onclick=()=>{chosenTime=to24(ap,h12,n);renderTime()};mCol.appendChild(b)}
    requestAnimationFrame(()=>p.querySelectorAll('.dtv4-option.on').forEach(x=>x.scrollIntoView({block:'center'})));
  }

  function openPicker(dateInput,timeInput,refresh){
    current={dateInput,timeInput,refresh};
    chosenDate=dateInput.value||toIso(new Date());
    chosenTime=timeInput.value||((typeof activeMode!=='undefined'&&activeMode==='job')?'23:59':'10:00');
    const d=parseDate(chosenDate);calendarView=new Date(d.getFullYear(),d.getMonth(),1);
    const p=ensurePicker();renderCalendar();renderTime();p.hidden=false;document.body.style.overflow='hidden';
  }
  function closePicker(){if(!picker)return;picker.hidden=true;current=null;document.body.style.overflow=''}
  function confirmPicker(){
    if(!current)return;
    current.dateInput.value=chosenDate;current.timeInput.value=chosenTime;
    ['input','change'].forEach(type=>{current.dateInput.dispatchEvent(new Event(type,{bubbles:true}));current.timeInput.dispatchEvent(new Event(type,{bubbles:true}))});
    current.refresh?.();closePicker();
  }

  function enhanceRow(row,dateInput,timeInput){
    if(!row||!dateInput||!timeInput)return;
    if(row.dataset.dtv4Ready==='1'){row._dtv4Refresh?.();return}
    row.dataset.dtv4Ready='1';row.classList.add('dtv4-ready');
    dateInput.classList.add('dtv4-native');timeInput.classList.add('dtv4-native');
    [dateInput,timeInput].forEach(inp=>{
      ['pointerdown','mousedown','click','focus'].forEach(type=>inp.addEventListener(type,e=>{e.preventDefault();e.stopImmediatePropagation()},true));
      inp.tabIndex=-1;
    });
    const display=document.createElement('div');display.className='dtv4-display-row';
    const db=document.createElement('button');db.type='button';db.className='dtv4-display date';
    const tb=document.createElement('button');tb.type='button';tb.className='dtv4-display time';display.append(db,tb);row.appendChild(display);
    const refresh=()=>{
      db.innerHTML=`<span class="dtv4-value">${dateLabel(dateInput.value)}</span><span class="dtv4-icon">▣</span>`;
      tb.innerHTML=`<span class="dtv4-value">${timeLabel(timeInput.value)}</span><span class="dtv4-icon">◷</span>`;
    };
    row._dtv4Refresh=refresh;
    db.onclick=e=>{e.preventDefault();e.stopPropagation();openPicker(dateInput,timeInput,refresh)};
    tb.onclick=e=>{e.preventDefault();e.stopPropagation();openPicker(dateInput,timeInput,refresh)};
    dateInput.addEventListener('change',refresh);timeInput.addEventListener('change',refresh);refresh();
  }

  function enhanceAll(){
    injectStyles();
    const mainRow=document.querySelector('#deadlineForm .deadline-time-row');
    if(mainRow)enhanceRow(mainRow,mainRow.querySelector('input[type="date"]'),mainRow.querySelector('input[type="time"]'));
    document.querySelectorAll('.dm-edit-row').forEach(row=>{
      const date=row.querySelector('input[type="date"]'),time=row.querySelector('input[type="time"]');
      if(date&&time)enhanceRow(row,date,time);
    });
  }

  const obs=new MutationObserver(()=>requestAnimationFrame(enhanceAll));
  obs.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','data-mode']});
  document.addEventListener('click',e=>{if(e.target.closest('.mode-btn,.deadline-add-toggle,.dm-tools'))setTimeout(enhanceAll,20)},true);
  window.addEventListener('load',enhanceAll);
  setInterval(enhanceAll,700);
  setTimeout(enhanceAll,0);
})();
