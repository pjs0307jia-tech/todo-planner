(function(){
  let pulling=false;
  let lastPull=0;

  function safeState(raw){
    if(typeof window.plannerNormalizeSafe==='function')return window.plannerNormalizeSafe(raw);
    const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    return {...src,version:3,todos:{job:src.todos?.job||{},work:src.todos?.work||{}},moods:{job:src.moods?.job||{},work:src.moods?.work||{}},notes:{job:src.notes?.job||{},work:src.notes?.work||{}},events:src.events||{},deadlines:Array.isArray(src.deadlines)?src.deadlines:[],workItems:Array.isArray(src.workItems)?src.workItems:[],_deletedTodoIds:Array.isArray(src._deletedTodoIds)?src._deletedTodoIds:[]};
  }

  function merge(primary,secondary){
    return typeof window.plannerMergeStates==='function'?window.plannerMergeStates(primary,secondary):safeState(primary);
  }

  function applyFeatureCopies(){
    if(typeof applicationDeadlines!=='undefined'){
      applicationDeadlines=(state.deadlines||[]).filter(x=>x&&x.id&&x.company&&x.date).map(x=>({id:x.id,company:String(x.company),date:String(x.date),time:String(x.time||'23:59'),url:typeof normalizeDeadlineUrl==='function'?normalizeDeadlineUrl(x.url||''):String(x.url||'')}));
      if(typeof deadlineSort==='function')applicationDeadlines.sort(deadlineSort);
      if(typeof saveDeadlineLocal==='function')saveDeadlineLocal();
    }
    if(typeof workItems!=='undefined'){
      workItems=(state.workItems||[]).filter(x=>x&&x.id&&x.title&&x.date).map(x=>({id:String(x.id),title:String(x.title),date:String(x.date),time:String(x.time||'18:00'),type:typeof normalizeWorkType==='function'?normalizeWorkType(x.type):(x.type==='due'?'due':x.type==='other'?'other':'meeting'),url:typeof normalizeWorkUrl==='function'?normalizeWorkUrl(x.url||''):String(x.url||'')}));
      if(typeof workSort==='function')workItems.sort(workSort);
      if(typeof saveWorkLocal==='function')saveWorkLocal();
    }
    if(typeof syncDiaryLocalFromState==='function')syncDiaryLocalFromState();
  }

  async function pushPendingFirst(){
    if(typeof window.plannerSyncPending==='function'&&window.plannerSyncPending()){
      if(typeof saveCloud==='function')await saveCloud();
      return typeof window.plannerSyncPending==='function'&&window.plannerSyncPending();
    }
    return false;
  }

  async function pullLatest(force=false){
    if(!CLOUD_READY||!userCode||pulling)return;
    const now=Date.now();if(!force&&now-lastPull<8000)return;
    lastPull=now;pulling=true;
    try{
      // A real unsynced user edit is always pushed first.
      if(await pushPendingFirst())return;

      const raw=await cloudRequest('load');
      const cloud=raw?.state;if(!cloud||typeof cloud!=='object')return;
      const cloudSafe=safeState(cloud),localSafe=safeState(state);

      if(typeof window.plannerBackupLocal==='function')window.plannerBackupLocal('before-cloud-refresh');

      // With no dirty local edit, cloud wins all same-ID conflicts.
      // Local-only items are preserved and pushed once, so a PC-only new todo is not lost.
      const merged=merge(cloudSafe,localSafe);
      const cloudJson=JSON.stringify(cloudSafe),mergedJson=JSON.stringify(merged);

      if(mergedJson!==cloudJson){
        merged._updatedAt=new Date().toISOString();
        state=merged;
        if(typeof saveLocal==='function')saveLocal();
        if(typeof window.plannerMarkSyncPending==='function')window.plannerMarkSyncPending();
        applyFeatureCopies();
        if(typeof processPostponedTodos==='function')processPostponedTodos(true);
        if(typeof renderAll==='function')renderAll();
        if(typeof saveCloud==='function')await saveCloud();
        return;
      }

      const next=cloudSafe;if(raw?.updated_at)next._cloudUpdatedAt=raw.updated_at;
      state=next;
      applyFeatureCopies();
      if(typeof processPostponedTodos==='function')processPostponedTodos(true);
      if(typeof saveLocal==='function')saveLocal();
      if(typeof renderAll==='function')renderAll();
      if(typeof setSyncStatus==='function')setSyncStatus('cloud');
    }catch(e){
      console.warn('cloud refresh failed',e);
      if(typeof setSyncStatus==='function')setSyncStatus('local');
    }finally{pulling=false}
  }

  window.todoPullLatest=pullLatest;
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(()=>pullLatest(true),250)});
  window.addEventListener('focus',()=>setTimeout(()=>pullLatest(true),250));
  window.addEventListener('pageshow',()=>setTimeout(()=>pullLatest(true),350));
  window.addEventListener('online',()=>setTimeout(()=>pullLatest(true),350));
  setInterval(()=>{if(document.visibilityState==='visible')pullLatest(false)},15000);
  setTimeout(()=>pullLatest(true),1200);
})();
