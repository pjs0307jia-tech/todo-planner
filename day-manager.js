let dayManagerOpen=false;
let dayManagerEditing=null;

function dayManagerEvents(){return state.events?.[dateKey(selected)]||[]}
function dayManagerPalette(){
  if(typeof altPalette==='function')return altPalette();
  return (typeof COLORS!=='undefined'?COLORS:[]).map((c,i)=>({id:String(i+1),hex:c.hex,label:c.id}));
}
function dayManagerNormalizeColor(id){
  if(typeof normalizeAltColor==='function')return normalizeAltColor(id);
  const legacy={pink:'1',peach:'2',yellow:'3',mint:'4',lilac:'5'};
  return String(legacy[id]||id||'1');
}
function dayManagerDateLabel(){
  const w=['일','월','화','수','목','금','토'][selected.getDay()];
  return `${selected.getMonth()+1}월 ${selected.getDate()}일 ${w}요일`;
}
function positionDayManager(){
  const panel=$('selectedDeadlines');
  const day=document.querySelector('#grid .day.selected');
  if(!panel||panel.hidden||!day)return;
  const r=day.getBoundingClientRect();
  const pw=panel.offsetWidth||286,ph=panel.offsetHeight||360;
  let left=r.right+10;
  let top=r.top-6;
  if(left+pw>window.innerWidth-12)left=Math.max(12,window.innerWidth-pw-12);
  if(top+ph>window.innerHeight-12)top=Math.max(12,window.innerHeight-ph-12);
  top=Math.max(12,top);
  panel.style.left=`${left}px`;
  panel.style.top=`${top}px`;
}
function closeDayManager(){
  dayManagerOpen=false;dayManagerEditing=null;selectedDeadlinePopupOpen=false;
  const panel=$('selectedDeadlines');if(panel)panel.hidden=true;
}
function saveEventEdit(id,input,colorId){
  const arr=dayManagerEvents();const ev=arr.find(x=>x.id===id);if(!ev)return;
  const text=input.trim();if(text)ev.text=text;
  ev.color=colorId||ev.color;
  dayManagerEditing=null;queueSave();renderAll();
}
function renderDeadlineEdit(row,item){
  const wrap=document.createElement('div');wrap.className='dm-edit';
  const company=document.createElement('input');company.className='dm-edit-input';company.value=item.company;company.maxLength=36;company.placeholder='기업명 / 공고명';
  const duo=document.createElement('div');duo.className='dm-edit-row';
  const date=document.createElement('input');date.type='date';date.className='dm-edit-input';date.value=item.date;
  const time=document.createElement('input');time.type='time';time.className='dm-edit-input';time.value=item.time||'23:59';duo.append(date,time);
  const url=document.createElement('input');url.className='dm-edit-input';url.value=item.url||'';url.placeholder='노션 URL (선택)';
  const actions=document.createElement('div');actions.className='dm-edit-actions';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='dm-edit-cancel';cancel.textContent='취소';cancel.onclick=()=>{dayManagerEditing=null;renderDayManager()};
  const save=document.createElement('button');save.type='button';save.className='dm-edit-save';save.textContent='저장';save.onclick=()=>{
    const name=company.value.trim();if(!name||!date.value)return;
    item.company=name;item.date=date.value;item.time=time.value||'23:59';item.url=normalizeDeadlineUrl(url.value);
    applicationDeadlines.sort(deadlineSort);dayManagerEditing=null;persistDeadlines();renderAll();
  };
  actions.append(cancel,save);wrap.append(company,duo,url,actions);row.append(wrap);
  setTimeout(()=>company.focus(),0);
}
function renderDeadlineRow(item){
  const row=document.createElement('div');row.className='dm-row';
  if(dayManagerEditing?.type==='deadline'&&dayManagerEditing.id===item.id){renderDeadlineEdit(row,item);return row}
  const top=document.createElement('div');top.className='dm-row-top';
  const main=document.createElement('div');main.className='dm-row-main';
  const title=document.createElement('div');title.className='dm-row-title';
  if(item.url){const a=document.createElement('a');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=item.company+' ↗';title.append(a)}else title.textContent=item.company;
  const meta=document.createElement('div');meta.className='dm-row-meta';
  const dday=document.createElement('span');dday.className='dm-dday';dday.textContent=ddayText(item);
  const when=document.createElement('span');when.textContent=item.time||'23:59';meta.append(dday,when);main.append(title,meta);
  const tools=document.createElement('div');tools.className='dm-tools';
  if(item.url){const link=document.createElement('a');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.title='노션 열기';link.textContent='↗';tools.append(link)}
  const edit=document.createElement('button');edit.type='button';edit.title='수정';edit.textContent='✎';edit.onclick=()=>{dayManagerEditing={type:'deadline',id:item.id};renderDayManager()};
  const del=document.createElement('button');del.type='button';del.title='삭제';del.textContent='×';del.onclick=()=>{deleteDeadline(item.id);setTimeout(()=>renderDayManager(),0)};
  tools.append(edit,del);top.append(main,tools);row.append(top);return row;
}
function renderEventEdit(row,ev){
  const wrap=document.createElement('div');wrap.className='dm-edit';
  const input=document.createElement('input');input.className='dm-edit-input';input.value=ev.text;input.maxLength=42;
  let chosen=dayManagerNormalizeColor(ev.color);
  const colors=document.createElement('div');colors.className='dm-color-row';
  dayManagerPalette().forEach(c=>{const b=document.createElement('button');b.type='button';b.className='dm-color-btn'+(String(c.id)===chosen?' on':'');b.style.background=c.hex;b.title=c.label||'';b.onclick=()=>{chosen=String(c.id);colors.querySelectorAll('.dm-color-btn').forEach(x=>x.classList.remove('on'));b.classList.add('on')};colors.append(b)});
  const actions=document.createElement('div');actions.className='dm-edit-actions';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='dm-edit-cancel';cancel.textContent='취소';cancel.onclick=()=>{dayManagerEditing=null;renderDayManager()};
  const save=document.createElement('button');save.type='button';save.className='dm-edit-save';save.textContent='저장';save.onclick=()=>saveEventEdit(ev.id,input.value,chosen);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();save.click()}else if(e.key==='Escape'){e.preventDefault();cancel.click()}});
  actions.append(cancel,save);wrap.append(input,colors,actions);row.append(wrap);setTimeout(()=>input.focus(),0);
}
function renderEventRow(ev){
  const row=document.createElement('div');row.className='dm-row';
  if(dayManagerEditing?.type==='event'&&dayManagerEditing.id===ev.id){renderEventEdit(row,ev);return row}
  const top=document.createElement('div');top.className='dm-row-top';
  const dot=document.createElement('span');dot.className='dm-event-dot';dot.style.background=colorHex(ev.color);
  const main=document.createElement('div');main.className='dm-row-main';
  const title=document.createElement('div');title.className='dm-row-title';title.textContent=ev.text;main.append(title);
  const tools=document.createElement('div');tools.className='dm-tools';
  const edit=document.createElement('button');edit.type='button';edit.title='수정';edit.textContent='✎';edit.onclick=()=>{dayManagerEditing={type:'event',id:ev.id};renderDayManager()};
  const del=document.createElement('button');del.type='button';del.title='삭제';del.textContent='×';del.onclick=()=>{
    const k=dateKey(selected);state.events[k]=(state.events[k]||[]).filter(x=>x.id!==ev.id);if(!state.events[k].length)delete state.events[k];queueSave();renderAll();
  };
  tools.append(edit,del);top.append(dot,main,tools);row.append(top);return row;
}
function renderDayManager(forceOpen=false){
  const panel=$('selectedDeadlines');if(!panel)return;
  if(activeMode!=='job'){closeDayManager();return}
  if(forceOpen){dayManagerOpen=true;selectedDeadlinePopupOpen=true}
  if(!dayManagerOpen){panel.hidden=true;return}
  const deadlines=deadlinesForDate(dateKey(selected));const events=dayManagerEvents();
  panel.className='selected-deadlines day-manager-panel';panel.hidden=false;panel.innerHTML='';
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-label',`${dayManagerDateLabel()} 일정 관리`);
  const head=document.createElement('div');head.className='day-manager-head';
  const copy=document.createElement('div');const kicker=document.createElement('div');kicker.className='day-manager-kicker';kicker.textContent='DAY PLAN';
  const date=document.createElement('div');date.className='day-manager-date';date.textContent=dayManagerDateLabel();
  const summary=document.createElement('div');summary.className='day-manager-summary';summary.textContent=`원서 ${deadlines.length} · 일정 ${events.length}`;copy.append(kicker,date,summary);
  const close=document.createElement('button');close.type='button';close.className='day-manager-close';close.textContent='×';close.setAttribute('aria-label','닫기');close.onclick=e=>{e.stopPropagation();closeDayManager()};head.append(copy,close);
  const scroll=document.createElement('div');scroll.className='day-manager-scroll';
  const deadlineSec=document.createElement('section');deadlineSec.className='day-manager-section';
  const dh=document.createElement('div');dh.className='day-manager-section-head';dh.innerHTML=`<strong>원서 마감</strong><span>${deadlines.length}건</span>`;deadlineSec.append(dh);
  if(deadlines.length)deadlines.forEach(x=>deadlineSec.append(renderDeadlineRow(x)));else{const empty=document.createElement('div');empty.className='day-manager-empty';empty.textContent='이 날 마감 원서는 없어요.';deadlineSec.append(empty)}
  const eventSec=document.createElement('section');eventSec.className='day-manager-section';
  const eh=document.createElement('div');eh.className='day-manager-section-head';eh.innerHTML=`<strong>캘린더 일정</strong><span>${events.length}개</span>`;eventSec.append(eh);
  if(events.length)events.forEach(x=>eventSec.append(renderEventRow(x)));else{const empty=document.createElement('div');empty.className='day-manager-empty';empty.textContent='등록된 캘린더 일정이 없어요.';eventSec.append(empty)}
  scroll.append(deadlineSec,eventSec);panel.append(head,scroll);
  requestAnimationFrame(positionDayManager);
}

renderSelectedDeadlines=function(forceOpen=false){renderDayManager(forceOpen)};
openSelectedDeadlinePopup=function(){renderDayManager(true)};
closeSelectedDeadlinePopup=function(){closeDayManager()};

$('grid')?.addEventListener('click',e=>{
  if(!e.target.closest('.day'))return;
  setTimeout(()=>{if(activeMode==='job'){dayManagerEditing=null;renderDayManager(true)}},0);
});
window.addEventListener('resize',()=>{if(dayManagerOpen)positionDayManager()});
window.addEventListener('scroll',()=>{if(dayManagerOpen)positionDayManager()},{passive:true});
