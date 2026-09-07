(function(){
  const STYLE_ID='workDateTimeConfirmStyles';

  function formatChoice(dateValue,timeValue){
    if(!dateValue)return '';
    const parts=dateValue.split('-');
    const m=Number(parts[1]||0),d=Number(parts[2]||0);
    return `✓ ${m}/${d} ${timeValue||'시간 미정'} 선택됨`;
  }

  function addStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .work-datetime-confirm{
        min-width:58px;height:100%;min-height:38px;padding:0 12px;border:0;border-radius:11px;
        background:var(--accent);color:#fff;font-weight:800;font-size:10.5px;white-space:nowrap;
        box-shadow:0 4px 12px var(--accent-shadow);transition:transform .14s ease,opacity .14s ease,box-shadow .14s ease;
        touch-action:manipulation;
      }
      .work-datetime-confirm:hover{transform:translateY(-1px);box-shadow:0 6px 15px var(--accent-shadow)}
      .work-datetime-confirm:active{transform:scale(.97)}
      .work-datetime-confirm.confirmed{opacity:.82}
      .work-datetime-summary{grid-column:1/-1;margin-top:2px;padding-left:2px;color:var(--accent-deep);font-size:9px;font-weight:700;min-height:12px}
      body[data-mode="work"] .deadline-time-row.work-datetime-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;align-items:stretch}
      .work-dm-row .dm-edit-row.work-datetime-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;align-items:stretch}
      @media(max-width:540px){
        body[data-mode="work"] .deadline-time-row.work-datetime-row,
        .work-dm-row .dm-edit-row.work-datetime-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto}
        .work-datetime-confirm{min-width:52px;padding:0 9px;font-size:10px}
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceRow(row,dateInput,timeInput,scopeKey){
    if(!row||!dateInput||!timeInput||row.dataset.workConfirmReady==='1')return;
    row.dataset.workConfirmReady='1';
    row.classList.add('work-datetime-row');

    const confirm=document.createElement('button');
    confirm.type='button';
    confirm.className='work-datetime-confirm';
    confirm.textContent='확인';
    confirm.setAttribute('aria-label','날짜와 시간 선택 확인');

    const summary=document.createElement('div');
    summary.className='work-datetime-summary';
    summary.dataset.scope=scopeKey||'';

    const markPending=()=>{
      confirm.classList.remove('confirmed');
      confirm.textContent='확인';
      summary.textContent='';
    };

    confirm.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      dateInput.blur();
      timeInput.blur();
      if(!dateInput.value){dateInput.focus();return}
      confirm.classList.add('confirmed');
      confirm.textContent='확인됨';
      summary.textContent=formatChoice(dateInput.value,timeInput.value);
      if(navigator.vibrate){try{navigator.vibrate(12)}catch{}}
    });

    dateInput.addEventListener('input',markPending);
    dateInput.addEventListener('change',markPending);
    timeInput.addEventListener('input',markPending);
    timeInput.addEventListener('change',markPending);

    row.appendChild(confirm);
    row.insertAdjacentElement('afterend',summary);
  }

  function enhanceMainWorkForm(){
    if(typeof activeMode==='undefined'||activeMode!=='work')return;
    const row=document.querySelector('#deadlineForm .deadline-time-row');
    const date=document.getElementById('deadlineDate');
    const time=document.getElementById('deadlineTime');
    enhanceRow(row,date,time,'main');
  }

  function enhanceInlineWorkEdits(){
    document.querySelectorAll('.work-dm-row .dm-edit').forEach((edit,index)=>{
      const row=edit.querySelector('.dm-edit-row');
      if(!row)return;
      const inputs=[...row.querySelectorAll('input')];
      const date=inputs.find(x=>x.type==='date');
      const time=inputs.find(x=>x.type==='time');
      enhanceRow(row,date,time,`inline-${index}`);
    });
  }

  function cleanupMainWhenJob(){
    if(typeof activeMode==='undefined'||activeMode==='work')return;
    const row=document.querySelector('#deadlineForm .deadline-time-row');
    if(!row)return;
    row.classList.remove('work-datetime-row');
    row.querySelector('.work-datetime-confirm')?.remove();
    const next=row.nextElementSibling;
    if(next?.classList.contains('work-datetime-summary'))next.remove();
    delete row.dataset.workConfirmReady;
  }

  function enhanceAll(){
    addStyles();
    cleanupMainWhenJob();
    enhanceMainWorkForm();
    enhanceInlineWorkEdits();
  }

  const observer=new MutationObserver(()=>requestAnimationFrame(enhanceAll));
  observer.observe(document.documentElement,{childList:true,subtree:true});

  document.addEventListener('click',e=>{
    if(e.target.closest('.mode-btn,.deadline-add-toggle,.dm-tools'))setTimeout(enhanceAll,0);
  },true);

  window.addEventListener('load',enhanceAll);
  setTimeout(enhanceAll,0);
})();
