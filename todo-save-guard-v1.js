(function(){
  let timer=null;

  function modeDateSnapshot(){
    const mode=typeof activeMode==='string'?activeMode:'job';
    const date=typeof dateKey==='function'?dateKey(selected):'';
    const arr=state?.todos?.[mode]?.[date];
    return {mode,date,arr:Array.isArray(arr)?arr:[]};
  }

  async function persistTodoItem(mode,date,todo){
    if(!todo?.id||!mode||!date||!CLOUD_READY||!userCode)return false;
    try{
      await cloudRequest('todo_upsert',{
        mode,
        date,
        todo:JSON.parse(JSON.stringify(todo)),
        client_updated_at:state?._updatedAt||new Date().toISOString()
      });
      return true;
    }catch(e){
      console.warn('todo item vault save failed',e);
      return false;
    }
  }

  function forceTodoSave(reason){
    clearTimeout(timer);
    timer=setTimeout(async()=>{
      try{
        if(!state||!userCode)return;
        if(typeof window.plannerBackupLocal==='function')window.plannerBackupLocal(reason||'todo-guard');
        if(typeof saveLocal==='function')saveLocal();
        if(typeof window.plannerMarkSyncPending==='function')window.plannerMarkSyncPending();
        if(typeof saveCloud==='function')await saveCloud();
      }catch(e){console.warn('todo immediate save failed',e)}
    },35);
  }

  // Add: capture the IDs before app.js mutates state, then persist the newly-created item.
  document.addEventListener('submit',e=>{
    if(e.target?.id!=='todoForm')return;
    const before=modeDateSnapshot();
    const ids=new Set(before.arr.map(x=>String(x?.id||'')).filter(Boolean));
    setTimeout(()=>{
      const after=state?.todos?.[before.mode]?.[before.date];
      if(!Array.isArray(after))return;
      const created=[...after].reverse().find(x=>x?.id&&!ids.has(String(x.id)));
      if(created)persistTodoItem(before.mode,before.date,created);
    },0);
    forceTodoSave('todo-add');
  },true);

  // Status change: remember the clicked todo ID, then persist its post-click state.
  document.addEventListener('click',e=>{
    const check=e.target?.closest?.('#todoList .check');
    if(!check)return;
    const snap=modeDateSnapshot();
    const row=check.closest('.todo-item');
    const rows=Array.from(document.querySelectorAll('#todoList .todo-item'));
    const index=rows.indexOf(row);
    const id=index>=0?String(snap.arr[index]?.id||''):'';
    setTimeout(()=>{
      if(!id)return;
      const arr=state?.todos?.[snap.mode]?.[snap.date];
      const updated=Array.isArray(arr)?arr.find(x=>String(x?.id||'')===id):null;
      if(updated)persistTodoItem(snap.mode,snap.date,updated);
    },0);
    forceTodoSave('todo-status');
  },true);

  window.forceTodoCloudSave=forceTodoSave;
  window.persistTodoItemToVault=persistTodoItem;
})();
