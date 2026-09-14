(function(){
  function ensureDeleted(){
    if(!state||typeof state!=='object')return [];
    if(!Array.isArray(state._deletedTodoIds))state._deletedTodoIds=[];
    return state._deletedTodoIds;
  }

  function remember(id){
    const value=String(id||'');if(!value)return;
    const ids=ensureDeleted().map(String);
    if(!ids.includes(value))ids.push(value);
    state._deletedTodoIds=ids.slice(-1000);
  }

  function removeEverywhere(id){
    ['job','work'].forEach(mode=>{
      const byDate=state.todos?.[mode]||{};
      Object.keys(byDate).forEach(date=>{
        const arr=Array.isArray(byDate[date])?byDate[date]:[];
        const next=arr.filter(item=>String(item?.id||'')!==id);
        if(next.length)byDate[date]=next;else delete byDate[date];
      });
    });
  }

  function findTodo(btn){
    const row=btn.closest('.todo-item'),list=document.getElementById('todoList');
    const k=typeof dateKey==='function'?dateKey(selected):'';
    const arr=k&&Array.isArray(state.todos?.[activeMode]?.[k])?state.todos[activeMode][k]:[];
    const id=String(row?.dataset?.todoId||btn.dataset?.todoId||'');
    if(id)return arr.find(x=>String(x?.id||'')===id)||null;
    const rows=Array.from(list?.querySelectorAll('.todo-item')||[]);
    return arr[rows.indexOf(row)]||null;
  }

  function persistDelete(id){
    const stamp=new Date().toISOString();
    if(typeof window.todoVaultEnqueueDelete==='function')window.todoVaultEnqueueDelete(id,stamp);
    else if(typeof cloudRequest==='function'&&CLOUD_READY&&userCode)cloudRequest('todo_delete',{todo_id:id,client_updated_at:stamp}).catch(console.warn);
    if(typeof window.todoMainAckEnqueueDelete==='function')window.todoMainAckEnqueueDelete(id);
  }

  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('#todoList .delete');if(!btn)return;
    const todo=findTodo(btn);if(!todo?.id)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const id=String(todo.id);
    remember(id);removeEverywhere(id);persistDelete(id);
    if(typeof queueSave==='function')queueSave();
    if(typeof renderAll==='function')renderAll();
    if(typeof window.todoMainAckFlush==='function')setTimeout(()=>window.todoMainAckFlush(),20);
  },true);

  const previousRender=typeof renderAll==='function'?renderAll:null;
  if(previousRender){
    renderAll=function(){
      const deleted=new Set(ensureDeleted().map(String));
      deleted.forEach(removeEverywhere);
      return previousRender();
    };
  }
})();
