(function(){
  let timer=null;

  function modeDateSnapshot(){
    const mode=typeof activeMode==='string'?activeMode:'job';
    const date=typeof dateKey==='function'?dateKey(selected):'';
    const arr=state?.todos?.[mode]?.[date];
    return {mode,date,arr:Array.isArray(arr)?arr:[]};
  }

  function persistTodoItem(mode,date,todo){
    if(!todo?.id||!mode||!date)return false;
    const stamp=new Date().toISOString();
    todo._itemUpdatedAt=stamp;
    if(typeof window.todoStatusLedgerRecord==='function')window.todoStatusLedgerRecord(mode,date,todo,stamp);
    try{if(typeof saveLocal==='function')saveLocal()}catch{}
    if(typeof window.todoVaultEnqueueUpsert==='function')window.todoVaultEnqueueUpsert(mode,date,todo,stamp);
    if(typeof window.todoMainAckEnqueueUpsert==='function')window.todoMainAckEnqueueUpsert(mode,date,todo);
    if(typeof window.todoVaultEnqueueUpsert==='function')return true;
    if(!CLOUD_READY||!userCode)return false;
    cloudRequest('todo_upsert',{
      mode,
      date,
      todo:JSON.parse(JSON.stringify(todo)),
      client_updated_at:stamp
    }).catch(e=>console.warn('todo item vault save failed',e));
    return true;
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
        if(typeof window.todoVaultFlushOutbox==='function')await window.todoVaultFlushOutbox();
        if(typeof window.todoMainAckFlush==='function')await window.todoMainAckFlush();
      }catch(e){console.warn('todo immediate save failed',e)}
    },35);
  }

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

  document.addEventListener('click',e=>{
    const check=e.target?.closest?.('#todoList .check');
    if(!check)return;
    const snap=modeDateSnapshot();
    const row=check.closest('.todo-item');
    const stableId=String(check.dataset?.todoId||row?.dataset?.todoId||'');
    const rows=Array.from(document.querySelectorAll('#todoList .todo-item'));
    const index=rows.indexOf(row);
    const indexedId=index>=0?String(snap.arr[index]?.id||''):'';
    const id=stableId||indexedId;
    setTimeout(()=>{
      if(!id)return;
      const arr=state?.todos?.[snap.mode]?.[snap.date];
      const updated=Array.isArray(arr)?arr.find(x=>String(x?.id||'')===id):null;
      if(updated)persistTodoItem(snap.mode,snap.date,updated);
    },0);
    forceTodoSave('todo-status');
  },true);

  // Keep a stable ID directly on every rendered check button/card so reorder timing cannot misaddress writes.
  const previousRenderTodos=typeof renderTodos==='function'?renderTodos:null;
  if(previousRenderTodos){
    renderTodos=function(){
      const result=previousRenderTodos();
      try{
        const mode=typeof activeMode==='string'?activeMode:'job';
        const date=typeof dateKey==='function'?dateKey(selected):'';
        const arr=state?.todos?.[mode]?.[date];
        const rows=Array.from(document.querySelectorAll('#todoList .todo-item'));
        if(Array.isArray(arr))rows.forEach((row,i)=>{
          const todo=arr[i];if(!todo?.id)return;
          row.dataset.todoId=String(todo.id);
          const check=row.querySelector('.check');if(check)check.dataset.todoId=String(todo.id);
        });
      }catch{}
      return result;
    };
  }

  window.forceTodoCloudSave=forceTodoSave;
  window.persistTodoItemToVault=persistTodoItem;
})();