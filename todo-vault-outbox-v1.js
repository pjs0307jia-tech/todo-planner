(function(){
  let flushing=false;
  let retryTimer=null;

  function code(){return (typeof userCode==='string'&&userCode)||localStorage.getItem('todoPlanner_activeCode')||''}
  function key(){const c=code();return c?`todoPlanner_todo_outbox_v1_${c}`:''}
  function load(){try{const k=key();if(!k)return[];const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
  function save(items){try{const k=key();if(k)localStorage.setItem(k,JSON.stringify(items.slice(-300)))}catch{}}
  function sameOp(a,b){return a&&b&&String(a.todo_id)===String(b.todo_id)&&a.kind===b.kind&&a.mutation_at===b.mutation_at}

  function enqueue(op){
    if(!op?.todo_id)return;
    const items=load().filter(x=>String(x?.todo_id)!==String(op.todo_id));
    items.push(op);save(items);scheduleFlush(40);
  }

  async function flush(){
    if(flushing||!CLOUD_READY||!code()||typeof cloudRequest!=='function')return false;
    const snapshot=load();if(!snapshot.length)return true;
    flushing=true;
    try{
      for(const op of snapshot){
        try{
          if(op.kind==='delete'){
            await cloudRequest('todo_delete',{todo_id:String(op.todo_id),client_updated_at:op.mutation_at});
          }else{
            await cloudRequest('todo_upsert',{
              mode:op.mode,
              date:op.date,
              todo:op.todo,
              client_updated_at:op.mutation_at
            });
          }
          const current=load();
          save(current.filter(x=>!sameOp(x,op)));
        }catch(e){
          console.warn('todo outbox flush failed',e);
          break;
        }
      }
    }finally{flushing=false}
    return load().length===0;
  }

  function scheduleFlush(delay=150){clearTimeout(retryTimer);retryTimer=setTimeout(()=>flush(),delay)}

  window.todoVaultEnqueueUpsert=function(mode,date,todo,mutationAt){
    if(!todo?.id||!mode||!date)return;
    const stamp=mutationAt||new Date().toISOString();
    const copy=JSON.parse(JSON.stringify(todo));
    copy._itemUpdatedAt=stamp;
    enqueue({kind:'upsert',todo_id:String(copy.id),mode,date,todo:copy,mutation_at:stamp});
  };
  window.todoVaultEnqueueDelete=function(todoId,mutationAt){
    if(!todoId)return;
    const stamp=mutationAt||new Date().toISOString();
    enqueue({kind:'delete',todo_id:String(todoId),mutation_at:stamp});
  };
  window.todoVaultFlushOutbox=flush;
  window.todoVaultOutboxPending=()=>load().length>0;

  window.addEventListener('online',()=>scheduleFlush(100));
  window.addEventListener('focus',()=>scheduleFlush(120));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleFlush(120)});
  setInterval(()=>{if(document.visibilityState==='visible')flush()},5000);
  setTimeout(()=>flush(),1000);
})();
