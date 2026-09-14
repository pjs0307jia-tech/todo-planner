(function(){
  let pulling=false;
  let lastPull=0;

  function clone(v){try{return JSON.parse(JSON.stringify(v))}catch{return v}}
  function safeState(raw){
    if(typeof window.plannerNormalizeSafe==='function')return window.plannerNormalizeSafe(raw);
    const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    return {...src,version:3,todos:{job:src.todos?.job||{},work:src.todos?.work||{}},moods:{job:src.moods?.job||{},work:src.moods?.work||{}},notes:{job:src.notes?.job||{},work:src.notes?.work||{}},events:src.events||{},deadlines:Array.isArray(src.deadlines)?src.deadlines:[],workItems:Array.isArray(src.workItems)?src.workItems:[],_deletedTodoIds:Array.isArray(src._deletedTodoIds)?src._deletedTodoIds:[]};
  }

  function merge(primary,secondary){
    return typeof window.plannerMergeStates==='function'?window.plannerMergeStates(primary,secondary):safeState(primary);
  }

  function cloudFirstTodoDates(cloudDates={},localDates={},deleted=new Set()){
    const out={};
    const dates=new Set([...Object.keys(cloudDates||{}),...Object.keys(localDates||{})]);
    dates.forEach(date=>{
      const cloudArr=Array.isArray(cloudDates?.[date])?cloudDates[date]:[];
      const localArr=Array.isArray(localDates?.[date])?localDates[date]:[];
      const seen=new Set();
      const arr=[];
      cloudArr.forEach(item=>{
        const id=String(item?.id||'');
        if(!id||deleted.has(id)||seen.has(id))return;
        seen.add(id);arr.push(clone(item));
      });
      localArr.forEach(item=>{
        const id=String(item?.id||'');
        if(!id||deleted.has(id)||seen.has(id))return;
        seen.add(id);arr.push(clone(item));
      });
      if(arr.length)out[date]=arr;
    });
    return out;
  }

  function cloudFirstTodos(cloudSafe,localSafe){
    const deleted=new Set([...(cloudSafe?._deletedTodoIds||[]),...(localSafe?._deletedTodoIds||[])].map(String));
    return {
      todos:{
        job:cloudFirstTodoDates(cloudSafe?.todos?.job,localSafe?.todos?.job,deleted),
        work:cloudFirstTodoDates(cloudSafe?.todos?.work,localSafe?.todos?.work,deleted)
      },
      deleted:Array.from(deleted).slice(-500)
    };
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

  async function flushPendingBestEffort(){
    let todoPending=false,plannerPending=false;

    if(typeof window.todoMainAckPending==='function'&&window.todoMainAckPending()){
      if(typeof window.todoMainAckApplyPending==='function')window.todoMainAckApplyPending();
      try{if(typeof window.todoMainAckFlush==='function')await window.todoMainAckFlush()}catch{}
      todoPending=typeof window.todoMainAckPending==='function'&&window.todoMainAckPending();
    }

    if(typeof window.todoVaultOutboxPending==='function'&&window.todoVaultOutboxPending()){
      try{if(typeof window.todoVaultFlushOutbox==='function')await window.todoVaultFlushOutbox()}catch{}
      todoPending=todoPending||(typeof window.todoVaultOutboxPending==='function'&&window.todoVaultOutboxPending());
    }

    if(typeof window.plannerSyncPending==='function'&&window.plannerSyncPending()){
      try{if(typeof saveCloud==='function')await saveCloud()}catch{}
      plannerPending=typeof window.plannerSyncPending==='function'&&window.plannerSyncPending();
    }

    return {todoPending,plannerPending};
  }

  async function pullLatest(force=false){
    if(!CLOUD_READY||!userCode||pulling)return;
    const now=Date.now();if(!force&&now-lastPull<8000)return;
    lastPull=now;pulling=true;
    try{
      // Never let a stuck local pending flag block cloud refresh forever.
      const pending=await flushPendingBestEffort();

      const raw=await cloudRequest('load');
      const cloud=raw?.state;if(!cloud||typeof cloud!=='object')return;
      const cloudSafe=safeState(cloud),localSafe=safeState(state);

      if(typeof window.plannerBackupLocal==='function')window.plannerBackupLocal('before-cloud-refresh');

      // If a non-todo local edit still cannot be uploaded, preserve those local feature fields.
      // Todos are different: the server copy wins same-ID conflicts, while truly local-only
      // todo IDs are retained. Any real unsynced todo mutation is re-applied from the durable
      // todo-main-ack queue immediately after this merge.
      let next=pending.plannerPending?merge(localSafe,cloudSafe):merge(cloudSafe,localSafe);
      const todoMerge=cloudFirstTodos(cloudSafe,localSafe);
      next.todos=todoMerge.todos;
      next._deletedTodoIds=todoMerge.deleted;
      if(raw?.updated_at)next._cloudUpdatedAt=raw.updated_at;

      state=next;
      if(pending.todoPending&&typeof window.todoMainAckApplyPending==='function'){
        window.todoMainAckApplyPending();
      }

      applyFeatureCopies();
      if(typeof processPostponedTodos==='function')processPostponedTodos(true);
      if(typeof saveLocal==='function')saveLocal();
      if(typeof renderAll==='function')renderAll();
      if(typeof setSyncStatus==='function')setSyncStatus((pending.todoPending||pending.plannerPending)?'local':'cloud');

      // Keep retrying pending local mutations, but do not block future pulls while they retry.
      if(pending.todoPending&&typeof window.todoMainAckFlush==='function')setTimeout(()=>window.todoMainAckFlush(),450);
      if(pending.plannerPending&&typeof saveCloud==='function')setTimeout(()=>saveCloud(),650);
    }catch(e){
      console.warn('cloud refresh failed',e);
      if(typeof setSyncStatus==='function')setSyncStatus('local');
    }finally{pulling=false}
  }

  window.todoPullLatest=pullLatest;
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(()=>pullLatest(true),180)});
  window.addEventListener('focus',()=>setTimeout(()=>pullLatest(true),180));
  window.addEventListener('pageshow',()=>setTimeout(()=>pullLatest(true),220));
  window.addEventListener('online',()=>setTimeout(()=>pullLatest(true),220));
  setInterval(()=>{if(document.visibilityState==='visible')pullLatest(false)},8000);
  setTimeout(()=>pullLatest(true),700);
})();