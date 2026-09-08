(function(){
  let running=false;
  let lastProcessedDate='';

  function makeId(){
    return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random());
  }

  function localDateKey(d){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function normalizeText(v){
    return String(v||'').trim().replace(/\s+/g,' ');
  }

  function processPostponedTodos(force=false){
    if(running||!state?.todos||!userCode)return false;

    const now=new Date();
    now.setHours(0,0,0,0);
    const todayKey=localDateKey(now);
    if(!force&&todayKey===lastProcessedDate)return false;

    const yesterday=new Date(now);
    yesterday.setDate(now.getDate()-1);
    const yesterdayKey=localDateKey(yesterday);
    let changed=false;

    running=true;
    try{
      ['job','work'].forEach(mode=>{
        const bucket=state.todos[mode]||(state.todos[mode]={});
        const source=Array.isArray(bucket[yesterdayKey])?bucket[yesterdayKey]:[];
        const postponed=source.filter(todo=>{
          const status=typeof todoStatus==='function'?todoStatus(todo):(todo?.status||'pending');
          return status==='postponed'&&normalizeText(todo?.text);
        });
        if(!postponed.length)return;

        const target=Array.isArray(bucket[todayKey])?bucket[todayKey]:(bucket[todayKey]=[]);

        postponed.forEach(todo=>{
          const sourceId=String(todo.id||'');
          const text=String(todo.text||'').trim();
          const textKey=normalizeText(text);
          if(!textKey)return;

          const alreadyExists=target.some(item=>{
            if(item?.rolloverFrom?.date===yesterdayKey&&String(item?.rolloverFrom?.id||'')===sourceId)return true;
            return normalizeText(item?.text)===textKey;
          });
          if(alreadyExists)return;

          target.push({
            id:makeId(),
            text,
            done:false,
            status:'pending',
            rolloverFrom:{date:yesterdayKey,id:sourceId}
          });
          changed=true;
        });
      });

      lastProcessedDate=todayKey;
      if(changed){
        if(typeof queueSave==='function')queueSave();
        else if(typeof saveLocal==='function')saveLocal();
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

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')setTimeout(()=>{
      if(processPostponedTodos(true)&&typeof renderAll==='function')renderAll();
    },220);
  });
  window.addEventListener('focus',()=>setTimeout(()=>{
    if(processPostponedTodos(true)&&typeof renderAll==='function')renderAll();
  },220));

  setInterval(()=>{
    if(document.visibilityState!=='visible')return;
    if(processPostponedTodos(false)&&typeof renderAll==='function')renderAll();
  },60000);

  setTimeout(()=>{
    if(processPostponedTodos(true)&&typeof renderAll==='function')renderAll();
  },1200);
})();
