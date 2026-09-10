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
    if(ids.length>250)state._deletedTodoIds=ids.slice(-250);
  }

  async function deleteFromVault(id){
    if(!id||!CLOUD_READY||!userCode)return;
    try{await cloudRequest('todo_delete',{todo_id:String(id)})}
    catch(e){console.warn('todo item vault delete failed',e)}
  }

  // Intercept the existing delete button before app.js removes the item.
  // This writes an explicit tombstone so the server can distinguish a real delete
  // from an accidental stale/empty-client overwrite.
  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('#todoList .delete');
    if(!btn)return;

    const list=document.getElementById('todoList');
    const row=btn.closest('.todo-item');
    if(!list||!row||!state?.todos)return;

    const rows=Array.from(list.children).filter(el=>el.classList?.contains('todo-item'));
    const index=rows.indexOf(row);
    const key=typeof dateKey==='function'?dateKey(selected):'';
    const bucket=state.todos?.[activeMode];
    const arr=key&&Array.isArray(bucket?.[key])?bucket[key]:null;
    const todo=index>=0&&arr?arr[index]:null;
    if(!todo?.id)return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const deletedId=String(todo.id);
    rememberDeleted(deletedId);
    bucket[key]=arr.filter(item=>String(item?.id)!==deletedId);
    if(!bucket[key].length)delete bucket[key];

    // Exact item-level delete first; the full-state tombstone remains as a fallback.
    deleteFromVault(deletedId);
    if(typeof queueSave==='function')queueSave();
    if(typeof renderAll==='function')renderAll();
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
