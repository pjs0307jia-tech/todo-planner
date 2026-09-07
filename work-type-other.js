(function(){
  function normalizeWorkType(type){
    return type==='due'?'due':type==='other'?'other':'meeting';
  }

  function ensureOtherStyle(){
    if(document.getElementById('workOtherTypeStyle'))return;
    const s=document.createElement('style');
    s.id='workOtherTypeStyle';
    s.textContent=`
      .work-type-badge.other,.dm-work-badge.other{background:#eef1f5;color:#6f7d8e}
      .work-calendar-chip.other{background:#f0f3f7!important;color:#6f7d8e!important;border-left-color:#95a3b3!important}
      .deadline-card.work-card.other{border-color:#e6eaf0!important}
    `;
    document.head.appendChild(s);
  }

  const previousEnsure=typeof ensureWorkTypeField==='function'?ensureWorkTypeField:null;
  if(previousEnsure){
    ensureWorkTypeField=function(){
      const select=previousEnsure();
      if(select&&!select.querySelector('option[value="other"]')){
        const option=document.createElement('option');
        option.value='other';option.textContent='기타';select.appendChild(option);
      }
      return select;
    };
  }

  workTypeLabel=function(type){
    type=normalizeWorkType(type);
    return type==='due'?'DUE':type==='other'?'기타':'MEETING';
  };
  workTypeKo=function(type){
    type=normalizeWorkType(type);
    return type==='due'?'마감':type==='other'?'기타':'미팅';
  };

  loadWorkData=async function(){
    if(!userCode)return;
    const local=loadWorkLocal();
    let cloud=null;
    if(CLOUD_READY){
      try{const raw=await cloudRequest('load');if(Array.isArray(raw?.state?.workItems))cloud=raw.state.workItems}catch(e){console.warn('work cloud load failed',e)}
    }
    workItems=(cloud??local)
      .filter(x=>x&&x.id&&x.title&&x.date)
      .map(x=>({
        id:String(x.id),title:String(x.title),date:String(x.date),time:String(x.time||'18:00'),
        type:normalizeWorkType(x.type),url:normalizeWorkUrl(x.url||'')
      }))
      .sort(workSort);
    if(state&&typeof state==='object')state.workItems=workItems;
    saveWorkLocal();renderWorkFeature();
  };

  submitWorkItem=function(){
    const title=$('deadlineCompany').value.trim();
    const date=$('deadlineDate').value;
    const time=$('deadlineTime').value||'18:00';
    const type=normalizeWorkType($('workType')?.value);
    const url=normalizeWorkUrl($('deadlineUrl').value);
    if(!title||!date)return;
    if(editingWorkItemId){
      const item=workItems.find(x=>x.id===editingWorkItemId);
      if(item)Object.assign(item,{title,date,time,type,url});
    }else{
      workItems.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),title,date,time,type,url});
    }
    workItems.sort(workSort);closeWorkForm();persistWorkItems();renderAll();
  };

  renderWorkEdit=function(row,item){
    const wrap=document.createElement('div');wrap.className='dm-edit';
    const type=document.createElement('select');type.className='dm-edit-input';
    type.innerHTML='<option value="meeting">미팅</option><option value="due">Due</option><option value="other">기타</option>';
    type.value=normalizeWorkType(item.type);
    const title=document.createElement('input');title.className='dm-edit-input';title.value=item.title;title.maxLength=42;
    const duo=document.createElement('div');duo.className='dm-edit-row';
    const date=document.createElement('input');date.type='date';date.className='dm-edit-input';date.value=item.date;
    const time=document.createElement('input');time.type='time';time.className='dm-edit-input';time.value=item.time;
    duo.append(date,time);
    const url=document.createElement('input');url.className='dm-edit-input';url.value=item.url||'';url.placeholder='관련 링크 (선택)';
    const actions=document.createElement('div');actions.className='dm-edit-actions';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='dm-edit-cancel';cancel.textContent='취소';cancel.onclick=()=>{dayManagerEditing=null;renderDayManager()};
    const save=document.createElement('button');save.type='button';save.className='dm-edit-save';save.textContent='저장';save.onclick=()=>{
      const next=title.value.trim();if(!next||!date.value)return;
      Object.assign(item,{title:next,date:date.value,time:time.value||'18:00',type:normalizeWorkType(type.value),url:normalizeWorkUrl(url.value)});
      workItems.sort(workSort);dayManagerEditing=null;persistWorkItems();renderAll();
    };
    actions.append(cancel,save);wrap.append(type,title,duo,url,actions);row.append(wrap);setTimeout(()=>title.focus(),0);
  };

  renderWorkCalendarItems=function(){
    document.querySelectorAll('.work-calendar-chip,.work-calendar-more').forEach(el=>el.remove());
    if(activeMode!=='work')return;
    const buttons=[...document.querySelectorAll('#grid .day')];if(!buttons.length)return;
    const y=view.getFullYear(),m=view.getMonth(),first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());
    buttons.forEach((b,i)=>{
      const d=new Date(start);d.setDate(start.getDate()+i);
      const items=workItemsForDate(dateKey(d));if(!items.length)return;
      let stack=b.querySelector('.event-stack');
      if(!stack){stack=document.createElement('div');stack.className='event-stack';const mood=b.querySelector('.mood-mini');if(mood)b.insertBefore(stack,mood);else b.append(stack)}
      const item=items[0];
      const chip=document.createElement('span');chip.className=`event-chip work-calendar-chip ${normalizeWorkType(item.type)}`;
      const prefix=item.type==='meeting'?'미팅':item.type==='due'?'Due':'기타';
      chip.textContent=`${prefix} · ${item.title}`;stack.prepend(chip);
      if(items.length>1){const more=document.createElement('span');more.className='event-more work-calendar-more';more.textContent=`업무 +${items.length-1}`;stack.append(more)}
    });
  };

  const previousSetCopy=typeof setPanelCopyForMode==='function'?setPanelCopyForMode:null;
  if(previousSetCopy){
    setPanelCopyForMode=function(){
      previousSetCopy();
      const select=ensureWorkTypeField();
      if(activeMode==='work'){
        const panel=$('deadlinePanel');
        const sub=panel?.querySelector('.deadline-head span');
        if(sub)sub.textContent='미팅 · Due · 기타 · 시간';
        const company=$('deadlineCompany');if(company)company.placeholder='업무 일정 내용';
        if(select)select.hidden=false;
      }
    };
  }

  const previousRenderWorkFeature=typeof renderWorkFeature==='function'?renderWorkFeature:null;
  if(previousRenderWorkFeature){
    renderWorkFeature=function(){
      previousRenderWorkFeature();
      if(activeMode==='work'){
        const foot=$('deadlinePanel')?.querySelector('.deadline-foot');
        if(foot)foot.innerHTML='가까운 일정부터 자동 정렬돼요.<br>MEETING · DUE · 기타를 한곳에서 관리해요.';
      }
    };
  }

  const previousRenderDayManager=typeof renderDayManager==='function'?renderDayManager:null;
  if(previousRenderDayManager){
    renderDayManager=function(forceOpen=false){
      previousRenderDayManager(forceOpen);
      if(activeMode==='work'){
        document.querySelectorAll('#selectedDeadlines .day-manager-empty').forEach(el=>{
          if(el.textContent.includes('미팅이나 Due'))el.textContent='이 날 등록된 업무 일정이 없어요.';
        });
      }
    };
  }

  ensureOtherStyle();
  ensureWorkTypeField?.();
  setPanelCopyForMode?.();

  const observer=new MutationObserver(()=>{
    ensureWorkTypeField?.();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  setTimeout(()=>{
    if(userCode)loadWorkData().then(()=>renderAll()).catch(()=>{});
  },350);
})();
