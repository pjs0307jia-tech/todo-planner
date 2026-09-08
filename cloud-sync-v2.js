(function(){
  let pulling=false;
  let lastPull=0;

  function ts(v){return Date.parse(v||'')||0}
  function safeState(raw){
    const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    return {
      ...src,
      version:3,
      todos:{job:src.todos?.job||{},work:src.todos?.work||{}},
      moods:{job:src.moods?.job||{},work:src.moods?.work||{}},
      events:src.events||{},
      deadlines:Array.isArray(src.deadlines)?src.deadlines:[],
      workItems:Array.isArray(src.workItems)?src.workItems:[]
    };
  }

  function applyFeatureCopies(){
    if(typeof applicationDeadlines!=='undefined'){
      applicationDeadlines=(state.deadlines||[])
        .filter(x=>x&&x.id&&x.company&&x.date)
        .map(x=>({
          id:x.id,
          company:String(x.company),
          date:String(x.date),
          time:String(x.time||'23:59'),
          url:typeof normalizeDeadlineUrl==='function'?normalizeDeadlineUrl(x.url||''):String(x.url||'')
        }));
      if(typeof deadlineSort==='function')applicationDeadlines.sort(deadlineSort);
      if(typeof saveDeadlineLocal==='function')saveDeadlineLocal();
    }

    if(typeof workItems!=='undefined'){
      workItems=(state.workItems||[])
        .filter(x=>x&&x.id&&x.title&&x.date)
        .map(x=>({
          id:String(x.id),
          title:String(x.title),
          date:String(x.date),
          time:String(x.time||'18:00'),
          type:typeof normalizeWorkType==='function'?normalizeWorkType(x.type):(x.type==='due'?'due':x.type==='other'?'other':'meeting'),
          url:typeof normalizeWorkUrl==='function'?normalizeWorkUrl(x.url||''):String(x.url||'')
        }));
      if(typeof workSort==='function')workItems.sort(workSort);
      if(typeof saveWorkLocal==='function')saveWorkLocal();
    }
  }

  async function pullLatest(force=false){
    if(!CLOUD_READY||!userCode||pulling)return;
    const now=Date.now();
    if(!force&&now-lastPull<8000)return;
    lastPull=now;
    pulling=true;
    try{
      const raw=await cloudRequest('load');
      const cloud=raw?.state;
      if(!cloud||typeof cloud!=='object')return;

      const cloudClientTs=ts(cloud._updatedAt);
      const localClientTs=ts(state?._updatedAt);

      // Local changes that have not reached the server yet must never be overwritten.
      if(localClientTs>cloudClientTs)return;

      // If the server is newer (for example, PC changed data while iPhone app stayed open),
      // replace the stale in-memory copy with the server copy and refresh every feature.
      if(cloudClientTs>localClientTs || force){
        const next=safeState(cloud);
        if(raw?.updated_at)next._cloudUpdatedAt=raw.updated_at;
        state=next;
        applyFeatureCopies();
        if(typeof saveLocal==='function')saveLocal();
        if(typeof renderAll==='function')renderAll();
        if(typeof setSyncStatus==='function')setSyncStatus('cloud');
      }
    }catch(e){
      console.warn('cloud refresh failed',e);
      if(typeof setSyncStatus==='function')setSyncStatus('local');
    }finally{
      pulling=false;
    }
  }

  window.todoPullLatest=pullLatest;

  // Home-screen PWAs often remain alive in the background instead of reloading.
  // Pull whenever the app becomes active again, and periodically while it stays open.
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')setTimeout(()=>pullLatest(true),180);
  });
  window.addEventListener('focus',()=>setTimeout(()=>pullLatest(true),180));
  window.addEventListener('pageshow',()=>setTimeout(()=>pullLatest(true),250));
  window.addEventListener('online',()=>setTimeout(()=>pullLatest(true),250));
  setInterval(()=>{
    if(document.visibilityState==='visible')pullLatest(false);
  },15000);

  setTimeout(()=>pullLatest(true),900);
})();
