// Compatibility bridge: all callers use the same durable, serialized queue.
(function(){
  window.todoVaultEnqueueUpsert=(mode,date,todo,stamp)=>window.todoMainAckEnqueueUpsert(mode,date,{...todo,_itemUpdatedAt:stamp||todo._itemUpdatedAt||new Date().toISOString()});
  window.todoVaultEnqueueDelete=(id,stamp)=>window.todoMainAckEnqueueDelete(id,stamp);
  window.todoVaultFlushOutbox=()=>window.todoMainAckFlush();
  window.todoVaultOutboxPending=()=>window.todoMainAckPending();
  window.todoMigrateLegacyOutbox=function(){
    const key=`todoPlanner_todo_outbox_v1_${userCode}`;
    try{
      const ops=JSON.parse((window.plannerStorage||localStorage).getItem(key)||'[]');
      for(const op of ops){
        if(op.kind==='delete')window.todoVaultEnqueueDelete(op.todo_id,op.mutation_at);
        else window.todoVaultEnqueueUpsert(op.mode,op.date,op.todo,op.mutation_at);
      }
      (window.plannerStorage||localStorage).removeItem(key);
    }catch(e){console.warn('pending todo migration failed',e)}
  };
})();
