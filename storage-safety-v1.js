(function(){
  const preloadCode=localStorage.getItem('todoPlanner_activeCode')||'';
  const preloadKey=preloadCode?`todoPlanner_preload_snapshot_${preloadCode}`:'';
  const rescueKey=preloadCode?`todoPlanner_boot_rescue_${preloadCode}`:'';
  let recoveredFromLocal=false;
  let cloudSaveInFlight=false;
  let cloudSaveAgain=false;

  function parseJson(raw){try{return raw?JSON.parse(raw):null}catch{return null}}
  function clone(v){try{return JSON.parse(JSON.stringify(v))}catch{return v}}
  function currentCode(){return (typeof userCode!=='undefined'&&userCode)||preloadCode||''}
  function pendingKey(){const code=currentCode();return code?`todoPlanner_sync_pending_v2_${code}`:''}
  function historyKey(){const code=currentCode();return code?`todoPlanner_local_history_${code}`:''}

  function featureFallbacks(){
    const code=currentCode();
    if(!code)return {deadlines:[],workItems:[]};
    const deadlines=parseJson(localStorage.getItem(`todoPlanner_deadlines_${code}`));
    const workItems=parseJson(localStorage.getItem(`todoPlanner_workItems_${code}`));
    return {deadlines:Array.isArray(deadlines)?deadlines:[],workItems:Array.isArray(workItems)?workItems:[]};
  }

  function normalizeSafe(raw){
    const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    const fallback=featureFallbacks();
    return {
      ...src,
      version:3,
      todos:{job:src.todos?.job&&typeof src.todos.job==='object'?src.todos.job:{},work:src.todos?.work&&typeof src.todos.work==='object'?src.todos.work:{}},
      moods:{job:src.moods?.job&&typeof src.moods.job==='object'?src.moods.job:{},work:src.moods?.work&&typeof src.moods.work==='object'?src.moods.work:{}},
      notes:{job:src.notes?.job&&typeof src.notes.job==='object'?src.notes.job:{},work:src.notes?.work&&typeof src.notes.work==='object'?src.notes.work:{}},
      events:src.events&&typeof src.events==='object'?src.events:{},
      deadlines:Array.isArray(src.deadlines)?src.deadlines:fallback.deadlines,
      workItems:Array.isArray(src.workItems)?src.workItems:fallback.workItems,
      _deletedTodoIds:Array.isArray(src._deletedTodoIds)?src._deletedTodoIds:[]
    };
  }

  function deletedSet(a,b){return new Set([...(a?._deletedTodoIds||[]),...(b?._deletedTodoIds||[])].map(String))}
  function todoStatusSafe(item){
    if(item?.status==='done'||item?.status==='postponed'||item?.status==='skipped')return item.status;
    return item?.done?'done':'pending';
  }
  function itemMutationMs(item){
    const raw=item?._itemUpdatedAt||item?.itemUpdatedAt||'';
    const n=Date.parse(raw||'');
    return Number.isFinite(n)?n:0;
  }
  function chooseTodoItem(primary,secondary){
    if(!primary)return secondary;
    if(!secondary)return primary;
    const pt=itemMutationMs(primary),st=itemMutationMs(secondary);
    if(pt!==st)return pt>st?primary:secondary;
    if(pt===0){
      const ps=todoStatusSafe(primary),ss=todoStatusSafe(secondary);
      if(ps!==ss){
        if(ps==='pending'&&ss!=='pending')return secondary;
        if(ss==='pending'&&ps!=='pending')return primary;
      }
    }
    return primary;
  }
  function mergeTodoItems(primary=[],secondary=[],deleted=new Set()){
    const p=Array.isArray(primary)?primary:[],s=Array.isArray(secondary)?secondary:[];
    const secondaryById=new Map(s.map(item=>[String(item?.id||''),item]));
    const out=[];const seen=new Set();
    p.forEach(item=>{
      const id=String(item?.id||'');
      if(!id||deleted.has(id)||seen.has(id))return;
      const chosen=chooseTodoItem(item,secondaryById.get(id));
      if(chosen){out.push(chosen);seen.add(id)}
    });
    s.forEach(item=>{
      const id=String(item?.id||'');
      if(!id||deleted.has(id)||seen.has(id))return;
      out.push(item);seen.add(id);
    });
    return out;
  }
  function mergeItems(primary=[],secondary=[],deleted=new Set()){
    const out=[];const seen=new Set();
    [...(Array.isArray(primary)?primary:[]),...(Array.isArray(secondary)?secondary:[])].forEach(item=>{
      const id=String(item?.id||'');
      if(!id||deleted.has(id)||seen.has(id))return;
      seen.add(id);out.push(item);
    });
    return out;
  }
  function mergeTodoDateArrays(primary={},secondary={},deleted=new Set()){
    const out={};
    const keys=new Set([...Object.keys(secondary||{}),...Object.keys(primary||{})]);
    keys.forEach(k=>{const arr=mergeTodoItems(primary?.[k],secondary?.[k],deleted);if(arr.length)out[k]=arr});
    return out;
  }
  function mergeDateArrays(primary={},secondary={},deleted=new Set()){
    const out={};
    const keys=new Set([...Object.keys(secondary||{}),...Object.keys(primary||{})]);
    keys.forEach(k=>{const arr=mergeItems(primary?.[k],secondary?.[k],deleted);if(arr.length)out[k]=arr});
    return out;
  }
  function mergeStates(primaryState,secondaryState){
    const primary=normalizeSafe(primaryState),secondary=normalizeSafe(secondaryState);
    const deleted=deletedSet(primary,secondary);
    return {
      ...secondary,
      ...primary,
      version:3,
      todos:{job:mergeTodoDateArrays(primary.todos.job,secondary.todos.job,deleted),work:mergeTodoDateArrays(primary.todos.work,secondary.todos.work,deleted)},
      moods:{job:{...(secondary.moods?.job||{}),...(primary.moods?.job||{})},work:{...(secondary.moods?.work||{}),...(primary.moods?.work||{})}},
      notes:{job:{...(secondary.notes?.job||{}),...(primary.notes?.job||{})},work:{...(secondary.notes?.work||{}),...(primary.notes?.work||{})}},
      events:mergeDateArrays(primary.events,secondary.events,new Set()),
      deadlines:mergeItems(primary.deadlines,secondary.deadlines,new Set()),
      workItems:mergeItems(primary.workItems,secondary.workItems,new Set()),
      _deletedTodoIds:Array.from(deleted).slice(-500)
    };
  }
  function protectSnapshotTodos(localSnapshot,cloudState){
    const local=normalizeSafe(localSnapshot),cloud=normalizeSafe(cloudState);
    const deleted=deletedSet(local,cloud);
    const out=clone(local);
    out.todos={
      job:mergeTodoDateArrays(local.todos.job,cloud.todos.job,deleted),
      work:mergeTodoDateArrays(local.todos.work,cloud.todos.work,deleted)
    };
    out._deletedTodoIds=Array.from(deleted).slice(-500);
    return out;
  }

  function snapshotScore(raw){
    const s=normalizeSafe(raw);let n=0;
    ['job','work'].forEach(mode=>Object.values(s.todos?.[mode]||{}).forEach(arr=>{if(Array.isArray(arr))n+=arr.length}));
    n+=(Array.isArray(s.deadlines)?s.deadlines.length:0)+(Array.isArray(s.workItems)?s.workItems.length:0);
    return n;
  }
  function pickBetterSnapshot(a,b){
    if(!a)return b;if(!b)return a;
    const at=Date.parse(a._updatedAt||'')||0,bt=Date.parse(b._updatedAt||'')||0;
    if(at!==bt)return at>bt?a:b;
    return snapshotScore(a)>=snapshotScore(b)?a:b;
  }

  function backupLocal(reason='change'){
    const code=currentCode();if(!code||!state||typeof state!=='object')return;
    try{
      const key=historyKey();
      const history=parseJson(localStorage.getItem(key));
      const arr=Array.isArray(history)?history:[];
      const snapshot={at:new Date().toISOString(),reason,state:clone(normalizeSafe(state))};
      const last=arr[arr.length-1];
      if(!last||JSON.stringify(last.state)!==JSON.stringify(snapshot.state))arr.push(snapshot);
      if(arr.length>30)arr.splice(0,arr.length-30);
      localStorage.setItem(key,JSON.stringify(arr));
    }catch(e){console.warn('local history save failed',e)}
  }

  function markPending(stamp){const key=pendingKey();if(!key)return;try{localStorage.setItem(key,stamp||state?._updatedAt||new Date().toISOString())}catch{}}
  function pendingStamp(){const key=pendingKey();if(!key)return '';try{return localStorage.getItem(key)||''}catch{return ''}}
  function clearPendingIf(stamp){const key=pendingKey();if(!key)return;try{const cur=localStorage.getItem(key)||'';if(!cur||cur===stamp||Date.parse(cur)<=Date.parse(stamp))localStorage.removeItem(key)}catch{}}
  function showSaving(){try{if(typeof setSyncStatus==='function')setSyncStatus('local');const note=document.getElementById('storageNote');if(note&&currentCode())note.textContent=`ID ${currentCode()} · 저장 중…`}catch{}}

  const preload=parseJson(preloadKey?sessionStorage.getItem(preloadKey):null);
  const rescue=parseJson(rescueKey?localStorage.getItem(rescueKey):null);
  const bestBoot=pickBetterSnapshot(preload,rescue);

  normalize=function(raw){
    const cloud=normalizeSafe(raw);
    if(!bestBoot||!preloadCode||userCode!==preloadCode)return cloud;
    const local=normalizeSafe(bestBoot);
    const hasRealPending=Boolean(pendingStamp());
    const merged=hasRealPending?mergeStates(local,cloud):mergeStates(cloud,local);
    if(JSON.stringify(merged)!==JSON.stringify(cloud)){
      merged._updatedAt=new Date().toISOString();
      recoveredFromLocal=true;
      markPending(merged._updatedAt);
    }
    return merged;
  };

  emptyState=function(){return {version:3,todos:{job:{},work:{}},moods:{job:{},work:{}},notes:{job:{},work:{}},events:{},deadlines:[],workItems:[],_deletedTodoIds:[],_updatedAt:''}};
  loadLocal=function(){try{return normalizeSafe(JSON.parse(localStorage.getItem(storageKey())))}catch{return emptyState()}};
  saveLocal=function(){try{localStorage.setItem(storageKey(),JSON.stringify(state))}catch(e){console.warn('local save failed',e)}};

  saveCloud=async function(){
    if(!CLOUD_READY||!currentCode())return false;
    if(cloudSaveInFlight){cloudSaveAgain=true;return false}
    cloudSaveInFlight=true;
    let snapshot=clone(normalizeSafe(state));
    const sentStamp=snapshot._updatedAt||new Date().toISOString();
    snapshot._updatedAt=sentStamp;
    try{
      if(typeof window.todoVaultFlushOutbox==='function'){
        try{await window.todoVaultFlushOutbox()}catch{}
      }
      try{
        const latest=await cloudRequest('load');
        if(latest?.state)snapshot=protectSnapshotTodos(snapshot,latest.state);
        snapshot._updatedAt=sentStamp;
      }catch(e){console.warn('pre-save cloud check failed',e)}

      const data=await cloudRequest('save',{state:snapshot});
      if(state?._updatedAt===sentStamp){
        state.todos=clone(snapshot.todos);
        state._deletedTodoIds=clone(snapshot._deletedTodoIds||[]);
      }
      if(data?.updated_at)state._cloudUpdatedAt=data.updated_at;
      clearPendingIf(sentStamp);
      saveLocal();
      if(pendingStamp())showSaving();else if(typeof setSyncStatus==='function')setSyncStatus('cloud');
      return true;
    }catch(e){
      console.warn('cloud save failed',e);
      markPending(state?._updatedAt||sentStamp);
      if(typeof setSyncStatus==='function')setSyncStatus('local');
      return false;
    }finally{
      cloudSaveInFlight=false;
      if(cloudSaveAgain||pendingStamp()){
        cloudSaveAgain=false;
        if(pendingStamp()&&state?._updatedAt!==sentStamp)setTimeout(()=>saveCloud(),80);
      }
    }
  };

  queueSave=function(){
    state._updatedAt=new Date().toISOString();
    backupLocal('queue-save');saveLocal();markPending(state._updatedAt);showSaving();
    if(CLOUD_READY){clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveCloud(),60)}
  };

  function flushPendingSave(){
    if(!currentCode()||!pendingStamp())return;
    clearTimeout(saveTimer);
    backupLocal('page-hide-pending');saveLocal();
    // Never send the whole planner blindly during pagehide. A stale device could
    // overwrite newer todo statuses before the item-level preflight can run.
    // The pending flag survives locally and the next visible/online sync calls
    // saveCloud(), which performs the protected merge first.
    try{if(typeof window.todoVaultFlushOutbox==='function')window.todoVaultFlushOutbox()}catch{}
  }

  window.plannerNormalizeSafe=normalizeSafe;
  window.plannerMergeStates=mergeStates;
  window.plannerProtectSnapshotTodos=protectSnapshotTodos;
  window.plannerBackupLocal=backupLocal;
  window.plannerSyncPending=()=>Boolean(pendingStamp());
  window.plannerMarkSyncPending=()=>{if(state?._updatedAt)markPending(state._updatedAt)};

  window.addEventListener('pagehide',flushPendingSave);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushPendingSave()});

  const recoveryCheck=setInterval(()=>{if(recoveredFromLocal){clearInterval(recoveryCheck);backupLocal('startup-recovery');queueSave()}},250);
  setTimeout(()=>clearInterval(recoveryCheck),5000);
})();
