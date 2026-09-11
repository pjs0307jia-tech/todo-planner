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
    deleteFromVault(deletedId);
    bucket[key]=arr.filter(item=>String(item?.id)!==deletedId);
    if(!bucket[key].length)delete bucket[key];

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