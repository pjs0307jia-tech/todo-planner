let applicationDeadlines=[];
let editingDeadlineId=null;
let deadlineBooted=false;
let selectedDeadlinePopupOpen=false;

function deadlineLocalKey(){return `todoPlanner_deadlines_${userCode||'guest'}`}
function saveDeadlineLocal(){try{localStorage.setItem(deadlineLocalKey(),JSON.stringify(applicationDeadlines))}catch{}}
function loadDeadlineLocal(){try{const v=JSON.parse(localStorage.getItem(deadlineLocalKey()));return Array.isArray(v)?v:[]}catch{return[]}}
function normalizeDeadlineUrl(v){v=(v||'').trim();if(!v)return'';if(!/^https?:\/\//i.test(v))v='https://'+v;try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return''}}
function deadlineDateTime(d){return new Date(`${d.date}T${d.time||'23:59'}:00`)}
function deadlineSort(a,b){return deadlineDateTime(a)-deadlineDateTime(b)}
function ddayText(item){
  const now=new Date(),due=deadlineDateTime(item),diff=due-now;
  if(diff<0)return'마감';
  const today0=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const due0=new Date(due.getFullYear(),due.getMonth(),due.getDate());
  const days=Math.round((due0-today0)/86400000);
  if(days===0){const h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000);return `D-DAY · ${h}시간 ${m}분`}
  return `D-${days} · ${item.time||'23:59'}`;
}
function isUrgentDeadline(item){const diff=deadlineDateTime(item)-new Date();return diff>=0&&diff<=86400000}
function formatDeadlineMeta(item){const [y,m,d]=item.date.split('-');return `${Number(m)}/${Number(d)} ${item.time||'23:59'} 마감`}
function deadlinesForDate(key){return applicationDeadlines.filter(x=>x.date===key).sort(deadlineSort)}

function persistDeadlines(){
  saveDeadlineLocal();
  if(state&&typeof state==='object')state.deadlines=applicationDeadlines;
  queueSave();
}

async function loadDeadlineData(){
  if(!userCode)return;
  const local=loadDeadlineLocal();
  let cloud=null;
  if(CLOUD_READY){
    try{const raw=await cloudRequest('load');if(Array.isArray(raw?.state?.deadlines))cloud=raw.state.deadlines}catch(e){console.warn('deadline cloud load failed',e)}
  }
  applicationDeadlines=(cloud??local).filter(x=>x&&x.id&&x.company&&x.date).map(x=>({id:x.id,company:String(x.company),date:String(x.date),time:String(x.time||'23:59'),url:normalizeDeadlineUrl(x.url||'')})).sort(deadlineSort);
  if(state&&typeof state==='object')state.deadlines=applicationDeadlines;
  saveDeadlineLocal();
  renderDeadlineFeature();
}

function openDeadlineForm(item=null){
  const form=$('deadlineForm');if(!form)return;
  editingDeadlineId=item?.id||null;
  $('deadlineCompany').value=item?.company||'';
  $('deadlineDate').value=item?.date||dateKey(selected);
  $('deadlineTime').value=item?.time||'18:00';
  $('deadlineUrl').value=item?.url||'';
  $('deadlineSaveBtn').textContent=item?'수정 저장':'추가';
  form.hidden=false;
  setTimeout(()=>$('deadlineCompany').focus(),20);
}
function closeDeadlineForm(){const form=$('deadlineForm');if(form)form.hidden=true;editingDeadlineId=null}
function submitDeadline(){
  const company=$('deadlineCompany').value.trim();const date=$('deadlineDate').value;const time=$('deadlineTime').value||'23:59';const url=normalizeDeadlineUrl($('deadlineUrl').value);
  if(!company||!date)return;
  if(editingDeadlineId){const item=applicationDeadlines.find(x=>x.id===editingDeadlineId);if(item){item.company=company;item.date=date;item.time=time;item.url=url}}
  else applicationDeadlines.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),company,date,time,url});
  applicationDeadlines.sort(deadlineSort);closeDeadlineForm();persistDeadlines();renderAll();
}
function deleteDeadline(id){applicationDeadlines=applicationDeadlines.filter(x=>x.id!==id);persistDeadlines();renderAll()}

function renderDeadlineBoard(){
  const list=$('deadlineList');if(!list)return;
  list.innerHTML='';
  const sorted=[...applicationDeadlines].sort(deadlineSort);
  if(!sorted.length){list.innerHTML='<div class="deadline-empty">아직 등록한 원서 마감이 없어요.<br>위의 + 원서 버튼으로 추가해봐!</div>';return}
  sorted.forEach(item=>{
    const card=document.createElement('div');card.className='deadline-card';
    const expired=deadlineDateTime(item)<new Date();if(expired)card.classList.add('expired');if(isUrgentDeadline(item))card.classList.add('urgent');
    const top=document.createElement('div');top.className='deadline-card-top';
    const companyWrap=document.createElement('div');companyWrap.style.minWidth='0';
    let company;
    if(item.url){company=document.createElement('a');company.href=item.url;company.target='_blank';company.rel='noopener noreferrer';company.className='deadline-company deadline-link';company.textContent=item.company+' ↗'}
    else{company=document.createElement('div');company.className='deadline-company';company.textContent=item.company}
    companyWrap.append(company);
    const tools=document.createElement('div');tools.className='deadline-tools';
    const edit=document.createElement('button');edit.type='button';edit.textContent='✎';edit.title='수정';edit.onclick=()=>openDeadlineForm(item);
    const del=document.createElement('button');del.type='button';del.textContent='×';del.title='삭제';del.onclick=()=>deleteDeadline(item.id);
    tools.append(edit,del);top.append(companyWrap,tools);
    const dday=document.createElement('div');dday.className='deadline-dday';dday.textContent=ddayText(item);
    const meta=document.createElement('div');meta.className='deadline-meta';meta.textContent=formatDeadlineMeta(item);
    card.append(top,dday,meta);list.append(card);
  });
}

function renderCalendarDeadlines(){
  document.querySelectorAll('.deadline-calendar-chip,.deadline-calendar-more').forEach(el=>el.remove());
  if(activeMode!=='job')return;
  const buttons=[...document.querySelectorAll('#grid .day')];if(!buttons.length)return;
  const y=view.getFullYear(),m=view.getMonth(),first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());
  buttons.forEach((b,i)=>{
    const d=new Date(start);d.setDate(start.getDate()+i);const items=deadlinesForDate(dateKey(d));if(!items.length)return;
    let stack=b.querySelector('.event-stack');if(!stack){stack=document.createElement('div');stack.className='event-stack';const mood=b.querySelector('.mood-mini');if(mood)b.insertBefore(stack,mood);else b.append(stack)}
    const chip=document.createElement('span');chip.className='event-chip deadline-calendar-chip';chip.textContent=`${items[0].company} 제출`;stack.prepend(chip);
    if(items.length>1){const more=document.createElement('span');more.className='event-more deadline-calendar-more';more.textContent=`원서 +${items.length-1}`;stack.append(more)}
  });
}

function closeSelectedDeadlinePopup(){
  selectedDeadlinePopupOpen=false;
  const section=$('selectedDeadlines');
  if(section)section.hidden=true;
}

function renderSelectedDeadlines(forceOpen=false){
  const section=$('selectedDeadlines');if(!section)return;
  if(activeMode!=='job'){closeSelectedDeadlinePopup();return}
  const items=deadlinesForDate(dateKey(selected));
  if(!items.length){closeSelectedDeadlinePopup();return}
  if(forceOpen)selectedDeadlinePopupOpen=true;
  if(!selectedDeadlinePopupOpen){section.hidden=true;return}

  section.innerHTML='';
  section.hidden=false;
  section.setAttribute('role','dialog');
  section.setAttribute('aria-modal','true');
  section.setAttribute('aria-label','이 날의 원서 마감');

  const title=document.createElement('div');title.className='selected-deadline-title';
  const titleLeft=document.createElement('div');titleLeft.className='selected-deadline-title-left';
  const strong=document.createElement('strong');strong.textContent='이 날의 원서 마감';
  const count=document.createElement('span');count.textContent=`${items.length}건`;
  titleLeft.append(strong,count);
  const close=document.createElement('button');close.type='button';close.className='selected-deadline-close';close.setAttribute('aria-label','닫기');close.textContent='×';close.onclick=e=>{e.stopPropagation();closeSelectedDeadlinePopup()};
  title.append(titleLeft,close);

  const list=document.createElement('div');list.className='selected-deadline-list';
  items.forEach(item=>{
    const el=item.url?document.createElement('a'):document.createElement('span');
    el.className='selected-deadline-item'+(item.url?'':' no-link');
    if(item.url){el.href=item.url;el.target='_blank';el.rel='noopener noreferrer'}
    const name=document.createElement('span');name.textContent=`${item.company} 제출${item.url?' ↗':''}`;
    const time=document.createElement('small');time.textContent=item.time||'23:59';
    el.append(name,time);list.append(el);
  });
  section.append(title,list);
}

function openSelectedDeadlinePopup(){renderSelectedDeadlines(true)}

function renderDeadlineFeature(){
  const panel=$('deadlinePanel');if(panel)panel.style.display=activeMode==='job'?'flex':'none';
  if(activeMode==='job'){renderDeadlineBoard();renderSelectedDeadlines(false)}
}

function setupDeadlineEvents(){
  $('deadlineAddToggle')?.addEventListener('click',()=>openDeadlineForm());
  $('deadlineCancelBtn')?.addEventListener('click',closeDeadlineForm);
  $('deadlineForm')?.addEventListener('submit',e=>{e.preventDefault();submitDeadline()});
  $('grid')?.addEventListener('click',e=>{
    const day=e.target.closest('.day');if(!day)return;
    setTimeout(()=>{
      if(activeMode==='job'&&deadlinesForDate(dateKey(selected)).length)openSelectedDeadlinePopup();
      else closeSelectedDeadlinePopup();
    },0);
  });
  $('selectedDeadlines')?.addEventListener('click',e=>e.stopPropagation());
  document.addEventListener('click',e=>{
    const section=$('selectedDeadlines');
    if(!selectedDeadlinePopupOpen||!section||section.hidden)return;
    if(section.contains(e.target)||e.target.closest('#grid .day'))return;
    closeSelectedDeadlinePopup();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSelectedDeadlinePopup()});
}

const _deadlineQueueSave=queueSave;
queueSave=function(){if(state&&typeof state==='object')state.deadlines=applicationDeadlines;saveDeadlineLocal();_deadlineQueueSave()};
const _deadlineRenderCalendar=renderCalendar;
renderCalendar=function(){_deadlineRenderCalendar();renderCalendarDeadlines()};
const _deadlineRenderAll=renderAll;
renderAll=function(){_deadlineRenderAll();renderDeadlineFeature()};
const _deadlineOpenPlanner=openPlanner;
openPlanner=async function(code){applicationDeadlines=[];selectedDeadlinePopupOpen=false;await _deadlineOpenPlanner(code);await loadDeadlineData();renderAll()};

function bootDeadlineFeature(){
  if(deadlineBooted)return;deadlineBooted=true;setupDeadlineEvents();
  const tryLoad=async()=>{if(userCode){await loadDeadlineData();renderAll()}else setTimeout(tryLoad,250)};tryLoad();
  setInterval(()=>{if(activeMode==='job')renderDeadlineBoard()},60000);
}
bootDeadlineFeature();
