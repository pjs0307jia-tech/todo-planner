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
function dayManagerPrimaryItems(){
  if(activeMode==='job')return typeof deadlinesForDate==='function'?deadlinesForDate(dateKey(selected)):[];
  return typeof workItemsForDate==='function'?workItemsForDate(dateKey(selected)):[];
}
function positionDayManager(){
  const panel=$('selectedDeadlines');
  const day=document.querySelector('#grid .day.selected');
  if(!panel||panel.hidden||!day)return;
  const r=day.getBoundingClientRect();
  const pw=panel.offsetWidth||286,ph=panel.offsetHeight||360;
  let left=r.right+10,top=r.top-6;
  if(left+pw>window.innerWidth-12)left=Math.max(12,r.left-pw-10);
  if(left<12)left=12;
  if(top+ph>window.innerHeight-12)top=Math.max(12,window.innerHeight-ph-12);
  top=Math.max(12,top);
  panel.style.left=`${left}px`;panel.style.top=`${top}px`;
}
function closeDayManager(){
  dayManagerOpen=false;dayManagerEditing=null;
  if(typeof selectedDeadlinePopupOpen!=='undefined')selectedDeadlinePopupOpen=false;
  const panel=$('selectedDeadlines');if(panel)panel.hidden=true;
}
function saveEventEdit(id,input,colorId){
  const arr=dayManagerEvents(),ev=arr.find(x=>x.id===id);if(!ev)return;
  const text=input.trim();if(text)ev.text=text;ev.color=colorId||ev.color;
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
  actions.append(cancel,save);wrap.append(company,duo,url,actions);row.append(wrap);setTimeout(()=>company.focus(),0);
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
  const main=document.createElement('div');main.className='dm-row-main';const title=document.createElement('div');title.className='dm-row-title';title.textContent=ev.text;main.append(title);
  const tools=document.createElement('div');tools.className='dm-tools';
  const edit=document.createElement('button');edit.type='button';edit.title='수정';edit.textContent='✎';edit.onclick=()=>{dayManagerEditing={type:'event',id:ev.id};renderDayManager()};
  const del=document.createElement('button');del.type='button';del.title='삭제';del.textContent='×';del.onclick=()=>{
    const k=dateKey(selected);state.events[k]=(state.events[k]||[]).filter(x=>x.id!==ev.id);if(!state.events[k].length)delete state.events[k];queueSave();renderAll();
  };
  tools.append(edit,del);top.append(dot,main,tools);row.append(top);return row;
}
function renderDayManager(forceOpen=false){
  const panel=$('selectedDeadlines');if(!panel)return;
  if(forceOpen){dayManagerOpen=true;if(typeof selectedDeadlinePopupOpen!=='undefined')selectedDeadlinePopupOpen=true}
  if(!dayManagerOpen){panel.hidden=true;return}
  const primary=dayManagerPrimaryItems(),events=dayManagerEvents();
  panel.className='selected-deadlines day-manager-panel';panel.hidden=false;panel.innerHTML='';
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-label',`${dayManagerDateLabel()} 일정 관리`);
  const head=document.createElement('div');head.className='day-manager-head';
  const copy=document.createElement('div');const kicker=document.createElement('div');kicker.className='day-manager-kicker';kicker.textContent=activeMode==='job'?'JOB DAY':'WORK DAY';
  const date=document.createElement('div');date.className='day-manager-date';date.textContent=dayManagerDateLabel();
  const summary=document.createElement('div');summary.className='day-manager-summary';summary.textContent=activeMode==='job'?`원서 ${primary.length} · 일정 ${events.length}`:`업무 ${primary.length} · 일정 ${events.length}`;copy.append(kicker,date,summary);
  const close=document.createElement('button');close.type='button';close.className='day-manager-close';close.textContent='×';close.setAttribute('aria-label','닫기');close.onclick=e=>{e.stopPropagation();closeDayManager()};head.append(copy,close);
  const scroll=document.createElement('div');scroll.className='day-manager-scroll';
  const primarySec=document.createElement('section');primarySec.className='day-manager-section';
  const ph=document.createElement('div');ph.className='day-manager-section-head';ph.innerHTML=activeMode==='job'?`<strong>원서 마감</strong><span>${primary.length}건</span>`:`<strong>업무 일정</strong><span>${primary.length}건</span>`;primarySec.append(ph);
  if(primary.length){
    if(activeMode==='job')primary.forEach(x=>primarySec.append(renderDeadlineRow(x)));
    else if(typeof renderWorkRow==='function')primary.forEach(x=>primarySec.append(renderWorkRow(x)));
  }else{const empty=document.createElement('div');empty.className='day-manager-empty';empty.textContent=activeMode==='job'?'이 날 마감 원서는 없어요.':'이 날 미팅이나 Due는 없어요.';primarySec.append(empty)}
  const eventSec=document.createElement('section');eventSec.className='day-manager-section';
  const eh=document.createElement('div');eh.className='day-manager-section-head';eh.innerHTML=`<strong>캘린더 일정</strong><span>${events.length}개</span>`;eventSec.append(eh);
  if(events.length)events.forEach(x=>eventSec.append(renderEventRow(x)));else{const empty=document.createElement('div');empty.className='day-manager-empty';empty.textContent='등록된 캘린더 일정이 없어요.';eventSec.append(empty)}
  scroll.append(primarySec,eventSec);panel.append(head,scroll);requestAnimationFrame(positionDayManager);
}

renderSelectedDeadlines=function(forceOpen=false){renderDayManager(forceOpen)};
openSelectedDeadlinePopup=function(){renderDayManager(true)};
closeSelectedDeadlinePopup=function(){closeDayManager()};

$('grid')?.addEventListener('click',e=>{
  if(!e.target.closest('.day'))return;
  setTimeout(()=>{dayManagerEditing=null;renderDayManager(true)},0);
});
window.addEventListener('resize',()=>{if(dayManagerOpen)positionDayManager()});
window.addEventListener('scroll',()=>{if(dayManagerOpen)positionDayManager()},{passive:true});

let workItems=[];
let editingWorkItemId=null;
let workFeatureBooted=false;

function workLocalKey(){return `todoPlanner_workItems_${userCode||'guest'}`}
function saveWorkLocal(){try{localStorage.setItem(workLocalKey(),JSON.stringify(workItems))}catch{}}
function loadWorkLocal(){try{const v=JSON.parse(localStorage.getItem(workLocalKey()));return Array.isArray(v)?v:[]}catch{return[]}}
function normalizeWorkUrl(v){v=(v||'').trim();if(!v)return'';if(!/^https?:\/\//i.test(v))v='https://'+v;try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return''}}
function workDateTime(item){return new Date(`${item.date}T${item.time||'18:00'}:00`)}
function workSort(a,b){return workDateTime(a)-workDateTime(b)}
function workItemsForDate(key){return workItems.filter(x=>x.date===key).sort(workSort)}
function workDdayText(item){
  const now=new Date(),due=workDateTime(item),diff=due-now;
  if(diff<0)return'지난 일정';
  const a=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const b=new Date(due.getFullYear(),due.getMonth(),due.getDate());
  const days=Math.round((b-a)/86400000);
  if(days===0){const h=Math.max(0,Math.floor(diff/3600000)),m=Math.max(0,Math.floor((diff%3600000)/60000));return `TODAY · ${h}시간 ${m}분`}
  return `D-${days} · ${item.time||'18:00'}`;
}
function workTypeLabel(type){return type==='due'?'DUE':'MEETING'}
function workTypeKo(type){return type==='due'?'마감':'미팅'}
function persistWorkItems(){
  saveWorkLocal();
  if(state&&typeof state==='object')state.workItems=workItems;
  queueSave();
}
async function loadWorkData(){
  if(!userCode)return;
  const local=loadWorkLocal();
  let cloud=null;
  if(CLOUD_READY){
    try{const raw=await cloudRequest('load');if(Array.isArray(raw?.state?.workItems))cloud=raw.state.workItems}catch(e){console.warn('work cloud load failed',e)}
  }
  workItems=(cloud??local).filter(x=>x&&x.id&&x.title&&x.date).map(x=>({id:String(x.id),title:String(x.title),date:String(x.date),time:String(x.time||'18:00'),type:x.type==='due'?'due':'meeting',url:normalizeWorkUrl(x.url||'')})).sort(workSort);
  if(state&&typeof state==='object')state.workItems=workItems;
  saveWorkLocal();renderWorkFeature();
}
function ensureWorkTypeField(){
  let select=$('workType');if(select)return select;
  select=document.createElement('select');select.id='workType';select.className='deadline-input work-type-select';
  select.innerHTML='<option value="meeting">미팅</option><option value="due">Due</option>';
  const form=$('deadlineForm');if(form)form.insertBefore(select,$('deadlineCompany'));return select;
}
function setPanelCopyForMode(){
  const panel=$('deadlinePanel');if(!panel)return;
  const strong=panel.querySelector('.deadline-head strong'),sub=panel.querySelector('.deadline-head span'),add=$('deadlineAddToggle'),company=$('deadlineCompany'),url=$('deadlineUrl'),workType=ensureWorkTypeField();
  if(activeMode==='work'){
    if(strong)strong.textContent='업무 일정';if(sub)sub.textContent='미팅 · Due · 시간';if(add)add.textContent='+ 업무';
    if(company)company.placeholder='미팅명 / Due 내용';if(url)url.placeholder='관련 링크 (선택)';if(workType)workType.hidden=false;
  }else{
    if(strong)strong.textContent='원서 마감';if(sub)sub.textContent='D-day · 마감시간 · 노션';if(add)add.textContent='+ 원서';
    if(company)company.placeholder='기업명 / 공고명';if(url)url.placeholder='노션 URL (선택)';if(workType)workType.hidden=true;
  }
}
function openWorkForm(item=null){
  const form=$('deadlineForm');if(!form)return;const type=ensureWorkTypeField();editingWorkItemId=item?.id||null;
  type.value=item?.type||'meeting';$('deadlineCompany').value=item?.title||'';$('deadlineDate').value=item?.date||dateKey(selected);$('deadlineTime').value=item?.time||'10:00';$('deadlineUrl').value=item?.url||'';$('deadlineSaveBtn').textContent=item?'수정 저장':'추가';form.hidden=false;setTimeout(()=>$('deadlineCompany').focus(),20);
}
function closeWorkForm(){const form=$('deadlineForm');if(form)form.hidden=true;editingWorkItemId=null}
function submitWorkItem(){
  const title=$('deadlineCompany').value.trim(),date=$('deadlineDate').value,time=$('deadlineTime').value||'18:00',type=$('workType')?.value==='due'?'due':'meeting',url=normalizeWorkUrl($('deadlineUrl').value);
  if(!title||!date)return;
  if(editingWorkItemId){const item=workItems.find(x=>x.id===editingWorkItemId);if(item)Object.assign(item,{title,date,time,type,url})}
  else workItems.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),title,date,time,type,url});
  workItems.sort(workSort);closeWorkForm();persistWorkItems();renderAll();
}
function deleteWorkItem(id){workItems=workItems.filter(x=>x.id!==id);persistWorkItems();renderAll()}
function renderWorkBoard(){
  const list=$('deadlineList');if(!list)return;list.innerHTML='';const sorted=[...workItems].sort(workSort);
  if(!sorted.length){list.innerHTML='<div class="deadline-empty">아직 등록한 업무 일정이 없어요.<br>+ 업무 버튼으로 미팅이나 Due를 추가해봐!</div>';return}
  sorted.forEach(item=>{
    const card=document.createElement('div');card.className=`deadline-card work-card ${item.type}`;if(workDateTime(item)<new Date())card.classList.add('expired');
    const top=document.createElement('div');top.className='deadline-card-top';const main=document.createElement('div');main.style.minWidth='0';
    const badge=document.createElement('span');badge.className=`work-type-badge ${item.type}`;badge.textContent=workTypeLabel(item.type);
    let title;if(item.url){title=document.createElement('a');title.href=item.url;title.target='_blank';title.rel='noopener noreferrer';title.className='deadline-company deadline-link';title.textContent=item.title+' ↗'}else{title=document.createElement('div');title.className='deadline-company';title.textContent=item.title}main.append(badge,title);
    const tools=document.createElement('div');tools.className='deadline-tools';const edit=document.createElement('button');edit.type='button';edit.textContent='✎';edit.title='수정';edit.onclick=()=>openWorkForm(item);const del=document.createElement('button');del.type='button';del.textContent='×';del.title='삭제';del.onclick=()=>deleteWorkItem(item.id);tools.append(edit,del);top.append(main,tools);
    const dday=document.createElement('div');dday.className='deadline-dday work-dday';dday.textContent=workDdayText(item);const meta=document.createElement('div');meta.className='deadline-meta';meta.textContent=`${Number(item.date.slice(5,7))}/${Number(item.date.slice(8,10))} ${item.time} · ${workTypeKo(item.type)}`;card.append(top,dday,meta);list.append(card);
  });
}
function renderWorkCalendarItems(){
  document.querySelectorAll('.work-calendar-chip,.work-calendar-more').forEach(el=>el.remove());if(activeMode!=='work')return;
  const buttons=[...document.querySelectorAll('#grid .day')];if(!buttons.length)return;const y=view.getFullYear(),m=view.getMonth(),first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());
  buttons.forEach((b,i)=>{
    const d=new Date(start);d.setDate(start.getDate()+i);const items=workItemsForDate(dateKey(d));if(!items.length)return;
    let stack=b.querySelector('.event-stack');if(!stack){stack=document.createElement('div');stack.className='event-stack';const mood=b.querySelector('.mood-mini');if(mood)b.insertBefore(stack,mood);else b.append(stack)}
    const chip=document.createElement('span');chip.className=`event-chip work-calendar-chip ${items[0].type}`;chip.textContent=`${items[0].type==='meeting'?'미팅':'Due'} · ${items[0].title}`;stack.prepend(chip);
    if(items.length>1){const more=document.createElement('span');more.className='event-more work-calendar-more';more.textContent=`업무 +${items.length-1}`;stack.append(more)}
  });
}
function renderWorkFeature(){
  setPanelCopyForMode();const panel=$('deadlinePanel');if(!panel)return;
  if(activeMode==='work'){
    panel.style.display='flex';renderWorkBoard();const foot=panel.querySelector('.deadline-foot');if(foot)foot.innerHTML='가까운 일정부터 자동 정렬돼요.<br>MEETING과 DUE를 한곳에서 관리해요.';
  }else{const foot=panel.querySelector('.deadline-foot');if(foot)foot.innerHTML='마감이 가까운 순서로 자동 정렬돼요.<br>↗가 있는 원서는 노션으로 바로 이동할 수 있어요.';}
}
function renderWorkEdit(row,item){
  const wrap=document.createElement('div');wrap.className='dm-edit';const type=document.createElement('select');type.className='dm-edit-input';type.innerHTML='<option value="meeting">미팅</option><option value="due">Due</option>';type.value=item.type;
  const title=document.createElement('input');title.className='dm-edit-input';title.value=item.title;title.maxLength=42;const duo=document.createElement('div');duo.className='dm-edit-row';const date=document.createElement('input');date.type='date';date.className='dm-edit-input';date.value=item.date;const time=document.createElement('input');time.type='time';time.className='dm-edit-input';time.value=item.time;duo.append(date,time);const url=document.createElement('input');url.className='dm-edit-input';url.value=item.url||'';url.placeholder='관련 링크 (선택)';
  const actions=document.createElement('div');actions.className='dm-edit-actions';const cancel=document.createElement('button');cancel.type='button';cancel.className='dm-edit-cancel';cancel.textContent='취소';cancel.onclick=()=>{dayManagerEditing=null;renderDayManager()};const save=document.createElement('button');save.type='button';save.className='dm-edit-save';save.textContent='저장';save.onclick=()=>{const next=title.value.trim();if(!next||!date.value)return;Object.assign(item,{title:next,date:date.value,time:time.value||'18:00',type:type.value==='due'?'due':'meeting',url:normalizeWorkUrl(url.value)});workItems.sort(workSort);dayManagerEditing=null;persistWorkItems();renderAll()};actions.append(cancel,save);wrap.append(type,title,duo,url,actions);row.append(wrap);setTimeout(()=>title.focus(),0);
}
function renderWorkRow(item){
  const row=document.createElement('div');row.className='dm-row work-dm-row';if(dayManagerEditing?.type==='work'&&dayManagerEditing.id===item.id){renderWorkEdit(row,item);return row}
  const top=document.createElement('div');top.className='dm-row-top';const badge=document.createElement('span');badge.className=`dm-work-badge ${item.type}`;badge.textContent=workTypeLabel(item.type);const main=document.createElement('div');main.className='dm-row-main';const title=document.createElement('div');title.className='dm-row-title';if(item.url){const a=document.createElement('a');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=item.title+' ↗';title.append(a)}else title.textContent=item.title;const meta=document.createElement('div');meta.className='dm-row-meta';const when=document.createElement('span');when.textContent=`${item.time} · ${workDdayText(item)}`;meta.append(when);main.append(title,meta);const tools=document.createElement('div');tools.className='dm-tools';if(item.url){const link=document.createElement('a');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='↗';tools.append(link)}const edit=document.createElement('button');edit.type='button';edit.textContent='✎';edit.title='수정';edit.onclick=()=>{dayManagerEditing={type:'work',id:item.id};renderDayManager()};const del=document.createElement('button');del.type='button';del.textContent='×';del.title='삭제';del.onclick=()=>deleteWorkItem(item.id);tools.append(edit,del);top.append(badge,main,tools);row.append(top);return row;
}

$('deadlineAddToggle')?.addEventListener('click',e=>{if(activeMode!=='work')return;e.preventDefault();e.stopImmediatePropagation();openWorkForm()},true);
$('deadlineCancelBtn')?.addEventListener('click',e=>{if(activeMode!=='work')return;e.preventDefault();e.stopImmediatePropagation();closeWorkForm()},true);
$('deadlineForm')?.addEventListener('submit',e=>{if(activeMode!=='work')return;e.preventDefault();e.stopImmediatePropagation();submitWorkItem()},true);

const _workQueueSave=queueSave;
queueSave=function(){if(state&&typeof state==='object')state.workItems=workItems;saveWorkLocal();_workQueueSave()};
const _workRenderCalendar=renderCalendar;
renderCalendar=function(){_workRenderCalendar();renderWorkCalendarItems()};
const _workRenderAll=renderAll;
renderAll=function(){_workRenderAll();renderWorkFeature()};
const _workOpenPlanner=openPlanner;
openPlanner=async function(code){workItems=[];await _workOpenPlanner(code);await loadWorkData();renderAll()};

function bootWorkFeature(){
  if(workFeatureBooted)return;workFeatureBooted=true;ensureWorkTypeField();setPanelCopyForMode();
  const tryLoad=async()=>{if(userCode){await loadWorkData();renderAll()}else setTimeout(tryLoad,250)};tryLoad();
  setInterval(()=>{if(activeMode==='work')renderWorkBoard()},60000);
}
bootWorkFeature();
