(function(){
  function stableCompletionPartition(){
    if(typeof modeTodos!=='function'||typeof dateKey!=='function'||typeof todoStatus!=='function')return false;
    const k=dateKey(selected);
    const arr=modeTodos()[k]||[];
    if(arr.length<2)return false;
    const active=[],done=[];
    arr.forEach(item=>{(todoStatus(item)==='done'?done:active).push(item)});
    const next=active.concat(done);
    const changed=next.some((item,i)=>item!==arr[i]);
    if(changed)modeTodos()[k]=next;
    return changed;
  }

  const originalCycleTodoStatus=cycleTodoStatus;
  cycleTodoStatus=function(todo){
    originalCycleTodoStatus(todo);
    stableCompletionPartition();
  };

  const originalRenderTodos=renderTodos;
  renderTodos=function(){
    const changed=stableCompletionPartition();
    originalRenderTodos();
    if(changed&&typeof queueSave==='function')queueSave();
  };
})();
