(function(){
  const preloadCode=localStorage.getItem('todoPlanner_activeCode')||'';
  const preloadKey=preloadCode?`todoPlanner_preload_snapshot_${preloadCode}`:'';
  let recoveredFromLocal=false;

  function parseJson(raw){
    try{return raw?JSON.parse(raw):null}catch{return null}
  }

  function normalizeSafe(raw){
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

  function mergeItems(primary=[],secondary=[]){
    const out=[];
    const seen=new Set();
    [...primary,...secondary].forEach(item=>{
      const id=String(item?.id||'');
      if(!id||seen.has(id))return;
      seen.add(id);out.push(item);
    });
    return out;
  }

  function mergeDateArrays(primary={},secondary={}){
    const out={};
    const keys=new Set([...Object.keys(secondary||{}),...Object.keys(primary||{})]);
    keys.forEach(k=>{out[k]=mergeItems(primary?.[k]||[],secondary?.[k]||[])});
    return out;
  }

  function mergeStates(localState,cloudState){
    const local=normalizeSafe(localState),cloud=normalizeSafe(cloudState);
    return {
      ...cloud,
      ...local,
      version:3,
      todos:{
        job:mergeDateArrays(local.todos.job,cloud.todos.job),
        work:mergeDateArrays(local.todos.work,cloud.todos.work)
      },
      moods:{
        job:{...(cloud.moods?.job||{}),...(local.moods?.job||{})},
        work:{...(cloud.moods?.work||{}),...(local.moods?.work||{})}
      },
      events:mergeDateArrays(local.events,cloud.events),
      deadlines:mergeItems(local.deadlines,cloud.deadlines),
      workItems:mergeItems(local.workItems,cloud.workItems)
    };
  }

  const preload=parseJson(preloadKey?sessionStorage.getItem(preloadKey):null);
  const originalNormalize=normalize;
  normalize=function(raw){
    const cloud=normalizeSafe(raw);
    if(!preload||!preloadCode||userCode!==preloadCode)return cloud;

    const local=normalizeSafe(preload);
    const localTs=Date.parse(local._updatedAt||'')||0;
    const cloudTs=Date.parse(cloud._updatedAt||'')||0;

    if(localTs>cloudTs){
      recoveredFromLocal=true;
      return local;
    }

    const migrationKey=`todoPlanner_storage_safety_migrated_${preloadCode}`;
    if(!localTs&&!cloudTs&&!localStorage.getItem(migrationKey)){
      localStorage.setItem(migrationKey,'1');
      const merged=mergeStates(local,cloud);
      if(JSON.stringify(merged)!==JSON.stringify(cloud)){
        merged._updatedAt=new Date().toISOString();
        recoveredFromLocal=true;
      }
      return merged;
    }

    return cloud;
  };

  emptyState=function(){
    return {version:3,todos:{job:{},work:{}},moods:{job:{},work:{}},events:{},deadlines:[],workItems:[],_updatedAt:''};
  };

  loadLocal=function(){
    try{return normalizeSafe(JSON.parse(localStorage.getItem(storageKey())))}catch{return emptyState()}
  };

  saveLocal=function(){
    try{localStorage.setItem(storageKey(),JSON.stringify(state))}catch(e){console.warn('local save failed',e)}
  };

  saveCloud=async function(){
    if(!CLOUD_READY||!userCode)return;
    try{
      const data=await cloudRequest('save',{state});
      if(data?.updated_at)state._cloudUpdatedAt=data.updated_at;
      saveLocal();
      setSyncStatus('cloud');
    }catch(e){
      console.warn(e);
      setSyncStatus('local');
    }
  };

  queueSave=function(){
    state._updatedAt=new Date().toISOString();
    saveLocal();
    if(CLOUD_READY){
      clearTimeout(saveTimer);
      saveTimer=setTimeout(saveCloud,120);
    }
    setSyncStatus(CLOUD_READY?'cloud':'local');
  };

  function flushPendingSave(){
    if(!CLOUD_READY||!userCode)return;
    clearTimeout(saveTimer);
    if(!state._updatedAt)state._updatedAt=new Date().toISOString();
    saveLocal();
    const body=JSON.stringify({action:'save',code:userCode,state});
    try{
      if(body.length<60000){
        fetch(`${SUPABASE_URL}/functions/v1/planner-sync`,{
          method:'POST',
          headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON_KEY},
          body,
          keepalive:true
        }).catch(()=>{});
      }else{
        saveCloud();
      }
    }catch{}
  }

  window.addEventListener('pagehide',flushPendingSave);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushPendingSave()});

  const recoveryCheck=setInterval(()=>{
    if(recoveredFromLocal){
      clearInterval(recoveryCheck);
      queueSave();
    }
  },250);
  setTimeout(()=>clearInterval(recoveryCheck),5000);
})();
