(function(){
  const LEDGER_DATE='2099-12-31';
  const VALID=new Set(['pending','done','postponed','skipped']);
  let persistTimer=null;

  function statusOf(todo){
    if(VALID.has(todo?.status))return todo.status;
    return todo?.done?'done':'pending';
  }
  function stampMs(v){const n=Date.parse(v||'');return Number.isFinite(n)?n:0}
  function ledgerArray(s,mode,create=false){
    if(!s?.todos?.[mode])return [];
    if(!Array.isArray(s.todos[mode][LEDGER_DATE])){
      if(!create)return [];
      s.todos[mode][LEDGER_DATE]=[];
    }
    return s.todos[mode][LEDGER_DATE];
  }
  function latestMap(s,mode){
    const map=new Map();
    ledgerArray(s,mode,false).forEach(rec=>{
      if(!rec?._statusLedger||!rec.targetId||!VALID.has(rec.targetStatus))return;
      const prev=map.get(String(rec.targetId));
      if(!prev||stampMs(rec.mutationAt)>=stampMs(prev.mutationAt))map.set(String(rec.targetId),rec);
    });
    return map;
  }
  function addRecord(s,mode,date,todo,stamp){
    if(!s?.todos?.[mode]||!todo?.id||date===LEDGER_DATE)return false;
    const targetStatus=statusOf(todo);
    const mutationAt=stamp||todo._itemUpdatedAt||new Date().toISOString();
    const id=`status-ledger:${String(todo.id)}:${mutationAt}`;
    const arr=ledgerArray(s,mode,true);
    if(arr.some(x=>String(x?.id||'')===id))return false;
    arr.push({
      id,
      text:'',done:false,status:'pending',
      _statusLedger:true,
      targetId:String(todo.id),
      targetStatus,
      mutationAt,
      sourceDate:String(date||'')
    });
    return true;
  }
  function bootstrapStamped(s){
    if(!s?.todos)return false;
    let changed=false;
    ['job','work'].forEach(mode=>{
      const latest=latestMap(s,mode);
      Object.entries(s.todos?.[mode]||{}).forEach(([date,arr])=>{
        if(date===LEDGER_DATE||!Array.isArray(arr))return;
        arr.forEach(todo=>{
          if(!todo?.id||!todo?._itemUpdatedAt)return;
          const prev=latest.get(String(todo.id));
          if(!prev||stampMs(todo._itemUpdatedAt)>stampMs(prev.mutationAt)){
            if(addRecord(s,mode,date,todo,todo._itemUpdatedAt)){
              latest.set(String(todo.id),ledgerArray(s,mode,false).at(-1));
              changed=true;
            }
          }
        });
      });
    });
    return changed;
  }
  function applyLedger(s){
    if(!s?.todos)return s;
    ['job','work'].forEach(mode=>{
      const latest=latestMap(s,mode);
      if(!latest.size)return;
      Object.entries(s.todos?.[mode]||{}).forEach(([date,arr])=>{
        if(date===LEDGER_DATE||!Array.isArray(arr))return;
        arr.forEach(todo=>{
          const rec=todo?.id?latest.get(String(todo.id)):null;
          if(!rec)return;
          const itemStamp=stampMs(todo._itemUpdatedAt);
          const ledgerStamp=stampMs(rec.mutationAt);
          if(itemStamp>ledgerStamp)return;
          todo.status=rec.targetStatus;
          todo.done=rec.targetStatus==='done';
          if(rec.mutationAt)todo._itemUpdatedAt=rec.mutationAt;
        });
      });
    });
    return s;
  }
  function schedulePersist(){
    clearTimeout(persistTimer);
    persistTimer=setTimeout(()=>{
      try{
        if(typeof state==='undefined'||!state||!userCode)return;
        if(typeof saveLocal==='function')saveLocal();
        if(typeof queueSave==='function')queueSave();
      }catch(e){console.warn('status ledger persist failed',e)}
    },450);
  }
  function normalizeWithLedger(base,raw){
    const s=base(raw);
    applyLedger(s);
    if(bootstrapStamped(s))schedulePersist();
    applyLedger(s);
    return s;
  }

  if(typeof window.plannerNormalizeSafe==='function'){
    const prev=window.plannerNormalizeSafe;
    window.plannerNormalizeSafe=function(raw){return normalizeWithLedger(prev,raw)};
  }
  if(typeof window.plannerMergeStates==='function'){
    const prev=window.plannerMergeStates;
    window.plannerMergeStates=function(a,b){
      const s=prev(a,b);
      applyLedger(s);
      if(bootstrapStamped(s))schedulePersist();
      return applyLedger(s);
    };
  }
  if(typeof normalize==='function'){
    const prevNormalize=normalize;
    normalize=function(raw){return normalizeWithLedger(prevNormalize,raw)};
  }

  window.todoStatusLedgerRecord=function(mode,date,todo,stamp){
    if(typeof state==='undefined'||!state)return false;
    const changed=addRecord(state,mode,date,todo,stamp);
    if(changed)applyLedger(state);
    return changed;
  };
  window.todoApplyStatusLedger=function(s){return applyLedger(s||state)};
  window.todoStatusLedgerDate=LEDGER_DATE;

  try{
    if(typeof state!=='undefined'&&state){
      applyLedger(state);
      if(bootstrapStamped(state)){applyLedger(state);if(typeof saveLocal==='function')saveLocal();schedulePersist()}
    }
  }catch(e){console.warn('status ledger bootstrap failed',e)}
})();