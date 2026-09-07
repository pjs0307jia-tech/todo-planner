(function(){
  const STYLE_ID='workDateTimePickerStyles';
  let picker=null;
  let currentTarget=null;
  let chosenDate='';
  let chosenTime='10:00';
  let calendarView=null;

  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  function parseDate(v){
    if(/^\d{4}-\d{2}-\d{2}$/.test(v||'')){
      const [y,m,d]=v.split('-').map(Number);
      return new Date(y,m-1,d);
    }
    return new Date();
  }
  function parseTime(v){
    const m=/^(\d{1,2}):(\d{2})$/.exec(v||'');
    let h=m?Number(m[1]):10, min=m?Number(m[2]):0;
    h=Math.max(0,Math.min(23,h));min=Math.max(0,Math.min(59,min));
    return {h,min};
  }
  function dateLabel(v){
    const d=parseDate(v);
    return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}`;
  }
  function timeLabel(v){
    const {h,min}=parseTime(v);
    const ap=h<12?'오전':'오후';
    const hh=h%12||12;
    return `${ap} ${hh}:${pad(min)}`;
  }
  function to24(ap,h12,min){
    let h=Number(h12)%12;
    if(ap==='PM')h+=12;
    return `${pad(h)}:${pad(Number(min))}`;
  }

  function addStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
      .work-dt-native-hidden{display:none!important}
      .work-dt-display-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;width:100%}
      .work-dt-display{
        min-width:0;height:42px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--text);
        display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px;font:inherit;font-size:12px;
        cursor:pointer;transition:border-color .14s ease,box-shadow .14s ease,transform .12s ease;
      }
      .work-dt-display:hover{border-color:var(--accent);box-shadow:0 4px 12px var(--accent-shadow)}
      .work-dt-display:active{transform:scale(.985)}
      .work-dt-display .work-dt-icon{font-size:13px;opacity:.72;flex:none}
      .work-dt-display .work-dt-value{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
      .deadline-time-row.work-dt-enhanced,.dm-edit-row.work-dt-enhanced{display:block!important}

      .work-dt-backdrop{position:fixed;inset:0;z-index:99990;background:rgba(41,47,58,.22);backdrop-filter:blur(2px);display:grid;place-items:center;padding:18px}
      .work-dt-picker{width:min(430px,calc(100vw - 28px));max-height:min(720px,calc(100vh - 32px));overflow:auto;background:#fff;border:1px solid #dbe7f4;border-radius:22px;box-shadow:0 24px 70px rgba(48,67,93,.22);padding:18px;color:#3f4650;animation:workDtIn .18s ease-out}
      @keyframes workDtIn{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
      .work-dt-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
      .work-dt-head strong{font-size:17px}.work-dt-close{width:30px;height:30px;border:0;border-radius:50%;background:#f4f7fb;color:#8995a5;font-size:19px;cursor:pointer}
      .work-dt-section-title{font-size:11px;font-weight:800;color:#6c87aa;margin:12px 2px 8px;text-transform:uppercase;letter-spacing:.04em}
      .work-dt-cal-head{display:grid;grid-template-columns:34px 1fr 34px;align-items:center;margin-bottom:7px}
      .work-dt-cal-head strong{text-align:center;font-size:14px}
      .work-dt-nav{width:32px;height:32px;border:1px solid #e2eaf4;border-radius:10px;background:#fff;color:#6c7d91;cursor:pointer;font-size:18px}
      .work-dt-week,.work-dt-days{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
      .work-dt-week span{text-align:center;font-size:9px;color:#a0abb9;font-weight:700;padding:4px 0}
      .work-dt-day{height:34px;border:0;border-radius:10px;background:transparent;color:#46505c;font-weight:650;font-size:11px;cursor:pointer}
      .work-dt-day.out{color:#c6ced8}.work-dt-day.today{box-shadow:inset 0 0 0 1px #b7cce5}.work-dt-day.selected{background:var(--accent);color:#fff;box-shadow:0 5px 12px var(--accent-shadow)}
      .work-dt-time-preview{display:flex;align-items:center;justify-content:center;height:44px;border-radius:13px;background:#f3f7fc;color:#4d6f99;font-size:18px;font-weight:850;margin-bottom:8px}
      .work-dt-time-cols{display:grid;grid-template-columns:.82fr 1fr 1fr;gap:7px;height:188px}
      .work-dt-col{overflow:auto;border:1px solid #e2eaf4;border-radius:13px;background:#fbfcfe;padding:5px;scrollbar-width:thin;overscroll-behavior:contain}
      .work-dt-option{width:100%;height:38px;border:0;border-radius:9px;background:transparent;color:#55606d;font-weight:750;cursor:pointer;font-size:12px}
      .work-dt-option.on{background:var(--accent);color:#fff;box-shadow:0 4px 10px var(--accent-shadow)}
      .work-dt-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:8px;margin-top:16px;position:sticky;bottom:-18px;background:#fff;padding:10px 0 0}
      .work-dt-cancel,.work-dt-confirm{height:43px;border-radius:13px;font-weight:850;cursor:pointer;font-size:12px}
      .work-dt-cancel{border:1px solid #e1e8f1;background:#fff;color:#8792a0}.work-dt-confirm{border:0;background:var(--accent);color:#fff;box-shadow:0 7px 16px var(--accent-shadow)}
      @media(max-width:800px){
        .work-dt-backdrop{align-items:end;padding:10px}
        .work-dt-picker{width:100%;max-height:88vh;border-radius:22px 22px 16px 16px;padding:16px}
        .work-dt-time-cols{height:210px}.work-dt-option{height:42px}
      }
    `;
    document.head.appendChild(s);
  }

  function ensurePicker(){
    if(picker)return picker;
    const back=document.createElement('div');
    back.className='work-dt-backdrop';
    back.hidden=true;
    back.innerHTML=`
      <div class="work-dt-picker" role="dialog" aria-modal="true" aria-label="업무 날짜와 시간 선택">
        <div class="work-dt-head"><strong>날짜 · 시간 선택</strong><button type="button" class="work-dt-close" aria-label="닫기">×</button></div>
        <div class="work-dt-section-title">날짜</div>
        <div class="work-dt-cal-head"><button type="button" class="work-dt-nav prev">‹</button><strong class="work-dt-month"></strong><button type="button" class="work-dt-nav next">›</button></div>
        <div class="work-dt-week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
        <div class="work-dt-days"></div>
        <div class="work-dt-section-title">시간</div>
        <div class="work-dt-time-preview"></div>
        <div class="work-dt-time-cols">
          <div class="work-dt-col ap"></div><div class="work-dt-col hour"></div><div class="work-dt-col minute"></div>
        </div>
        <div class="work-dt-actions"><button type="button" class="work-dt-cancel">취소</button><button type="button" class="work-dt-confirm">확인</button></div>
      </div>`;
    document.body.appendChild(back);
    picker=back;

    back.querySelector('.work-dt-close').onclick=closePicker;
    back.querySelector('.work-dt-cancel').onclick=closePicker;
    back.addEventListener('click',e=>{if(e.target===back)closePicker()});
    back.querySelector('.work-dt-nav.prev').onclick=()=>{calendarView=new Date(calendarView.getFullYear(),calendarView.getMonth()-1,1);renderCalendar()};
    back.querySelector('.work-dt-nav.next').onclick=()=>{calendarView=new Date(calendarView.getFullYear(),calendarView.getMonth()+1,1);renderCalendar()};
    back.querySelector('.work-dt-confirm').onclick=confirmPicker;
    return back;
  }

  function renderCalendar(){
    const p=ensurePicker();
    const month=p.querySelector('.work-dt-month');
    const days=p.querySelector('.work-dt-days');
    const y=calendarView.getFullYear(),m=calendarView.getMonth();
    month.textContent=`${y}년 ${m+1}월`;
    days.innerHTML='';
    const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());
    const today=iso(new Date());
    for(let i=0;i<42;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);
      const key=iso(d);
      const b=document.createElement('button');b.type='button';b.className='work-dt-day';b.textContent=d.getDate();
      if(d.getMonth()!==m)b.classList.add('out');
      if(key===today)b.classList.add('today');
      if(key===chosenDate)b.classList.add('selected');
      b.onclick=()=>{chosenDate=key;calendarView=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar()};
      days.appendChild(b);
    }
  }

  function renderTime(){
    const p=ensurePicker();
    const {h,min}=parseTime(chosenTime);
    const ap=h<12?'AM':'PM',h12=h%12||12;
    p.querySelector('.work-dt-time-preview').textContent=timeLabel(chosenTime);
    const apCol=p.querySelector('.work-dt-col.ap'),hCol=p.querySelector('.work-dt-col.hour'),mCol=p.querySelector('.work-dt-col.minute');
    apCol.innerHTML='';hCol.innerHTML='';mCol.innerHTML='';
    [['AM','오전'],['PM','오후']].forEach(([v,label])=>{
      const b=document.createElement('button');b.type='button';b.className='work-dt-option'+(v===ap?' on':'');b.textContent=label;
      b.onclick=()=>{chosenTime=to24(v,h12,min);renderTime()};apCol.appendChild(b);
    });
    for(let n=1;n<=12;n++){
      const b=document.createElement('button');b.type='button';b.className='work-dt-option'+(n===h12?' on':'');b.textContent=pad(n);
      b.onclick=()=>{chosenTime=to24(ap,n,min);renderTime()};hCol.appendChild(b);
    }
    for(let n=0;n<60;n++){
      const b=document.createElement('button');b.type='button';b.className='work-dt-option'+(n===min?' on':'');b.textContent=pad(n);
      b.onclick=()=>{chosenTime=to24(ap,h12,n);renderTime()};mCol.appendChild(b);
    }
    requestAnimationFrame(()=>p.querySelectorAll('.work-dt-option.on').forEach(x=>x.scrollIntoView({block:'center'})));
  }

  function openPicker(dateInput,timeInput,refresh){
    currentTarget={dateInput,timeInput,refresh};
    chosenDate=dateInput.value||iso(new Date());
    chosenTime=timeInput.value||'10:00';
    const d=parseDate(chosenDate);calendarView=new Date(d.getFullYear(),d.getMonth(),1);
    const p=ensurePicker();renderCalendar();renderTime();p.hidden=false;document.body.style.overflow='hidden';
  }
  function closePicker(){
    if(!picker)return;picker.hidden=true;currentTarget=null;document.body.style.overflow='';
  }
  function confirmPicker(){
    if(!currentTarget)return;
    currentTarget.dateInput.value=chosenDate;
    currentTarget.timeInput.value=chosenTime;
    ['input','change'].forEach(type=>{
      currentTarget.dateInput.dispatchEvent(new Event(type,{bubbles:true}));
      currentTarget.timeInput.dispatchEvent(new Event(type,{bubbles:true}));
    });
    currentTarget.refresh?.();
    closePicker();
  }

  function removeOldConfirm(row){
    row?.querySelectorAll('.work-datetime-confirm').forEach(x=>x.remove());
    const next=row?.nextElementSibling;
    if(next?.classList.contains('work-datetime-summary'))next.remove();
  }

  function enhanceRow(row,dateInput,timeInput,key){
    if(!row||!dateInput||!timeInput)return;
    removeOldConfirm(row);
    if(row.dataset.workPickerReady==='1'){
      row._workPickerRefresh?.();return;
    }
    row.dataset.workPickerReady='1';row.classList.add('work-dt-enhanced');
    dateInput.classList.add('work-dt-native-hidden');timeInput.classList.add('work-dt-native-hidden');

    const display=document.createElement('div');display.className='work-dt-display-row';display.dataset.scope=key||'';
    const db=document.createElement('button');db.type='button';db.className='work-dt-display date';
    const tb=document.createElement('button');tb.type='button';tb.className='work-dt-display time';
    display.append(db,tb);row.append(display);

    const refresh=()=>{
      db.innerHTML=`<span class="work-dt-value">${dateLabel(dateInput.value)}</span><span class="work-dt-icon">▣</span>`;
      tb.innerHTML=`<span class="work-dt-value">${timeLabel(timeInput.value)}</span><span class="work-dt-icon">◷</span>`;
    };
    row._workPickerRefresh=refresh;
    db.onclick=e=>{e.preventDefault();e.stopPropagation();openPicker(dateInput,timeInput,refresh)};
    tb.onclick=e=>{e.preventDefault();e.stopPropagation();openPicker(dateInput,timeInput,refresh)};
    refresh();
  }

  function cleanupMainWhenJob(){
    if(typeof activeMode==='undefined'||activeMode==='work')return;
    const row=document.querySelector('#deadlineForm .deadline-time-row');if(!row)return;
    row.querySelector('.work-dt-display-row')?.remove();
    row.querySelectorAll('.work-dt-native-hidden').forEach(x=>x.classList.remove('work-dt-native-hidden'));
    row.classList.remove('work-dt-enhanced');delete row.dataset.workPickerReady;delete row._workPickerRefresh;
    removeOldConfirm(row);
  }

  function enhanceMain(){
    if(typeof activeMode==='undefined'||activeMode!=='work')return;
    const row=document.querySelector('#deadlineForm .deadline-time-row');
    enhanceRow(row,document.getElementById('deadlineDate'),document.getElementById('deadlineTime'),'main');
  }
  function enhanceInline(){
    document.querySelectorAll('.work-dm-row .dm-edit').forEach((edit,i)=>{
      const row=edit.querySelector('.dm-edit-row');if(!row)return;
      enhanceRow(row,row.querySelector('input[type="date"]'),row.querySelector('input[type="time"]'),`inline-${i}`);
    });
  }
  function enhanceAll(){addStyles();cleanupMainWhenJob();enhanceMain();enhanceInline()}

  const obs=new MutationObserver(()=>requestAnimationFrame(enhanceAll));
  obs.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','data-mode']});
  document.addEventListener('click',e=>{
    if(e.target.closest('.mode-btn,.deadline-add-toggle,.dm-tools'))setTimeout(enhanceAll,20);
  },true);
  window.addEventListener('load',enhanceAll);
  setInterval(()=>{if(typeof activeMode!=='undefined'&&activeMode==='work')enhanceAll()},700);
  setTimeout(enhanceAll,0);
})();
