(function(){
  let flushing=false;
  let timer=null;

  function code(){return (typeof userCode==='string'&&userCode)||localStorage.getItem('todoPlanner_activeCode')||''}
  function key(){const c=code();return c?`todoPlanner_todo_main_ack_v1_${c}`:''}
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function load(){try{const k=key();if(!k)return[];const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
  function save(items){try{const k=key();if(k)localStorage.setItem(k,JSON.stringify(items.slice(-200)))}catch{}}
  function status(todo){if(todo?.status==='done'||todo?.status==='postponed'||todo?.status==='skipped')return todo.status;return todo?.done?'done':'pending'}

  function enqueue(mode,date,todo){
    if(!mode||!date||!todo?.id)return;
    const desired=clone(todo);
    const items=load().filter(x=>String(x?.todo?.id||'')!==String(desired.id));
    items.push({mode,date,todo:desired,queued_at:new Date().toISOString()});
    save(items);schedule(50);
  }

  function applyDesired(target,op){
    if(!target||typeof target!=='object')return target;
    if(!target.todos||typeof target.todos!=='object')target.todos={job:{},work:{}};
    if(!target.todos.job)target.todos.job={};
    if(!target.todos.work)target.todos.work={};
    if(!target.todos[op.mode])target.todos[op.mode]={};
    const arr=Array.isArray(target.todos[op.mode][op.date])?target.todos[op.mode][op.date]:[];
    const id=String(op.todo.id);
    const i=arr.findIndex(x=>String(x?.id||'')===id);
    if(i>=0)arr[i]=clone(op.todo);else arr.push(clone(op.todo));
    target.todos[op.mode][op.date]=arr;
    if(Array.isArray(target._deletedTodoIds))target._deletedTodoIds=target._deletedTodoIds.filter(x=>String(x)!==id);
    target._updatedAt=new Date().toISOString();
    return target;
  }

  function findTodo(s,op){
    const arr=s?.todos?.[op.mode]?.[op.date];
    return Array.isArray(arr)?arr.find(x=>String(x?.id||'')===String(op.todo.id)):null;
  }
  function matches(s,op){
    const got=findTodo(s,op);if(!got)return false;
    return status(got)===status(op.todo)&&String(got.text||'')===String(op.todo.text||'');
  }
  function delay(ms){return new Promise(r=>setTimeout(r,ms))}

  async function flush(){
    if(flushing||!CLOUD_READY||!code()||typeof cloudRequest!=='function')return false;
    const pending=load();if(!pending.length)return true;
    flushing=true;
    try{
      for(const op of pending){
        let ok=false;
        for(let attempt=0;attempt<4&&!ok;attempt++){
          try{
            // Never let a stale pull erase the desired local mutation while it is unacknowledged.
            applyDesired(state,op);
            if(typeof saveLocal==='function')saveLocal();
            if(typeof window.todoVaultEnqueueUpsert==='function')window.todoVaultEnqueueUpsert(op.mode,op.date,op.todo,op.todo?._itemUpdatedAt||op.queued_at);
            if(typeof window.todoVaultFlushOutbox==='function')await window.todoVaultFlushOutbox();

            const snapshot=applyDesired(clone(state),op);
            await cloudRequest('save',{state:snapshot});
            await delay(90+attempt*80);
            const raw=await cloudRequest('load');
            ok=matches(raw?.state,op);
            if(!ok)await delay(120+attempt*120);
          }catch(e){console.warn('todo main ack attempt failed',e);await delay(180+attempt*150)}
        }
        if(ok){
          const cur=load();save(cur.filter(x=>String(x?.todo?.id||'')!==String(op.todo.id)));
        }else break;
      }
    }finally{flushing=false}
    if(load().length){schedule(1500);return false}
    return true;
  }

  function schedule(ms=250){clearTimeout(timer);timer=setTimeout(()=>flush(),ms)}
  window.todoMainAckEnqueueUpsert=enqueue;
  window.todoMainAckFlush=flush;
  window.todoMainAckPending=()=>load().length>0;
  window.todoMainAckApplyPending=function(){load().forEach(op=>applyDesired(state,op));try{if(typeof saveLocal==='function')saveLocal()}catch{}};

  window.addEventListener('online',()=>schedule(100));
  window.addEventListener('focus',()=>schedule(120));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule(120)});
  setInterval(()=>{if(document.visibilityState==='visible')flush()},5000);
  setTimeout(()=>flush(),900);
})();
