(function(){
  let running=false;
  let lastProcessedStamp='';

  function localDateKey(d){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function parseDateKey(k){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k||''));
    if(!m)return null;
    const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
    d.setHours(0,0,0,0);
    return Number.isNaN(d.getTime())?null:d;
  }

  function nextDateKey(k){
    const d=parseDateKey(k);if(!d)return '';
    d.setDate(d.getDate()+1);
    return localDateKey(d);
  }

  function normalizeText(v){
    return String(v||'').trim().replace(/\s+/g,' ');
  }

  function rolloverKey(mode,sourceKey,sourceId){
    return `${mode}|${sourceKey}|${sourceId}`;
  }

  function rolloverId(mode,sourceKey,sourceId,textKey){
    const seed=sourceId||encodeURIComponent(textKey);
    return `rollover:${mode}:${sourceKey}:${seed}`;
  }

  function existingRolloverKey(item){
    const r=item?.rolloverFrom;
    if(!r||!r.date||!r.id)return '';
    return rolloverKey(r.mode||'',String(r.date),String(r.id));
  }

  function processMode(mode,todayKey){
    const bucket=state.todos[mode]||(state.todos[mode]={});
    let changed=false;

    Object.keys(bucket).sort().forEach(sourceKey=>{
      if(sourceKey>=todayKey)return;
      const targetKey=nextDateKey(sourceKey);
      if(!targetKey||targetKey>todayKey)return;

      const source=Array.isArray(bucket[sourceKey])?bucket[sourceKey]:[];
      const postponed=source.filter(todo=>{
        const status=typeof todoStatus==='function'?todoStatus(todo):(todo?.status||'pending');
        return status==='postponed'&&normalizeText(todo?.text);
      });
      if(!postponed.length)return;

      const target=Array.isArray(bucket[targetKey])?bucket[targetKey]:(bucket[targetKey]=[]);
      postponed.forEach(todo=>{
        const sourceId=String(todo.id||'');
        const text=String(todo.text||'').trim();
        const textKey=normalizeText(text);
        if(!textKey)return;

        const sourceRollKey=rolloverKey(mode,sourceKey,sourceId);
        const deterministicId=rolloverId(mode,sourceKey,sourceId,textKey);

        const alreadyExists=target.some(item=>{
          if(existingRolloverKey(item)===sourceRollKey)return true;
          if(String(item?.id||'')===deterministicId)return true;
          return normalizeText(item?.text)===textKey;
        });
        if(alreadyExists)return;

        target.push({
          id:deterministicId,
          text,
          done:false,
          status:'pending',
          rolloverFrom:{date:sourceKey,id:sourceId,mode}
        });
        changed=true;
      });
    });

    return changed;
  }

  function processPostponedTodos(force=false){
    if(running||!state?.todos||!userCode)return false;

    const now=new Date();
    now.setHours(0,0,0,0);
    const todayKey=localDateKey(now);
    const stamp=`${todayKey}:${Object.keys(state.todos.job||{}).length}:${Object.keys(state.todos.work||{}).length}`;
    if(!force&&stamp===lastProcessedStamp)return false;

    running=true;
    let changed=false;
    try{
      changed=processMode('job',todayKey)||changed;
      changed=processMode('work',todayKey)||changed;
      lastProcessedStamp=stamp;

      if(changed){
        if(typeof saveLocal==='function')saveLocal();
        if(typeof queueSave==='function')queueSave();
      }
    }finally{
      running=false;
    }
    return changed;
  }

  window.processPostponedTodos=processPostponedTodos;

  const previousRenderAll=typeof renderAll==='function'?renderAll:null;
  if(previousRenderAll){
    renderAll=function(){
      processPostponedTodos(false);
      return previousRenderAll();
    };
  }

  function refreshAfterCheck(force=true){
    setTimeout(()=>{
      if(processPostponedTodos(force)&&typeof renderAll==='function')renderAll();
    },300);
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')refreshAfterCheck(true);
  });
  window.addEventListener('focus',()=>refreshAfterCheck(true));
  window.addEventListener('pageshow',()=>refreshAfterCheck(true));
  window.addEventListener('online',()=>refreshAfterCheck(true));

  setInterval(()=>{
    if(document.visibilityState!=='visible')return;
    if(processPostponedTodos(false)&&typeof renderAll==='function')renderAll();
  },30000);

  setTimeout(()=>{
    if(processPostponedTodos(true)&&typeof renderAll==='function')renderAll();
  },1400);
})();
