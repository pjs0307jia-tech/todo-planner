(function(){
  function ensureDeletedIds(){
    if(!state||typeof state!=='object')return [];
    if(!Array.isArray(state._deletedTodoIds))state._deletedTodoIds=[];
    return state._deletedTodoIds;
  }

  function rememberDeleted(id){
    if(!id)return;
    const ids=ensureDeletedIds();
    if(!ids.includes(id))ids.push(id);
    if(ids.length>500)state._deletedTodoIds=ids.slice(-500);
  }

  function deleteFromVault(id){
    if(!id)return;
    const stamp=new Date().toISOString();
    if(typeof window.todoVaultEnqueueDelete==='function'){
      window.todoVaultEnqueueDelete(String(id),stamp);
      return;
    }
    if(!CLOUD_READY||!userCode)return;
    cloudRequest('todo_delete',{todo_id:String(id),client_updated_at:stamp}).catch(e=>console.warn('todo item vault delete failed',e));
  }

  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('#todoList .delete');
    if(!btn)return;

    const list=document.getElementById('todoList');
    const row=btn.closest('.todo-item');
    if(!list||!row||!state?.todos)return;

    const key=typeof dateKey==='function'?dateKey(selected):'';
    const mode=activeMode;
    const bucket=state.todos?.[mode];
    const arr=key&&Array.isArray(bucket?.[key])?bucket[key]:null;
    if(!arr)return;

    // 렌더링/드래그 정렬 이후에도 정확한 항목을 지우도록 DOM에 심어둔 안정 ID를 우선 사용한다.
    const stableId=String(row.dataset?.todoId||btn.dataset?.todoId||'');
    const rows=Array.from(list.children).filter(el=>el.classList?.contains('todo-item'));
    const index=rows.indexOf(row);
    const indexedTodo=index>=0?arr[index]:null;
    const todo=stableId?arr.find(item=>String(item?.id||'')===stableId):indexedTodo;
    if(!todo?.id)return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const deletedId=String(todo.id);
    rememberDeleted(deletedId);
    deleteFromVault(deletedId);
    if(typeof window.todoMainAckEnqueueDelete==='function')window.todoMainAckEnqueueDelete(deletedId);

    // 같은 ID가 혹시 다른 날짜에 중복돼 있어도 전부 제거한다. 서버 tombstone과 동일한 의미로 맞춘다.
    ['job','work'].forEach(m=>{
      const byDate=state.todos?.[m]||{};
      Object.keys(byDate).forEach(date=>{
        const source=Array.isArray(byDate[date])?byDate[date]:[];
        const next=source.filter(item=>String(item?.id||'')!==deletedId);
        if(next.length)byDate[date]=next;else delete byDate[date];
      });
    });

    if(typeof queueSave==='function')queueSave();
    if(typeof renderAll==='function')renderAll();
    if(typeof window.todoMainAckFlush==='function')setTimeout(()=>window.todoMainAckFlush(),20);
  },true);

  const oldRenderAll=typeof renderAll==='function'?renderAll:null;
  if(oldRenderAll){
    renderAll=function(){
      ensureDeletedIds();
      return oldRenderAll();
    };
  }

  ensureDeletedIds();
})();
