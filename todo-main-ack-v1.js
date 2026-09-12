(function(){
  const nativeFetch=window.fetch.bind(window);
  const PLANNER_PATH='/functions/v1/planner-sync';
  window.fetch=async function(input,init){
    let nextInit=init;
    try{
      const url=typeof input==='string'?input:(input&&input.url)||'';
      const isPlanner=String(url).includes(PLANNER_PATH)&&String(init?.method||'GET').toUpperCase()==='POST'&&typeof init?.body==='string';
      if(isPlanner){
        const body=JSON.parse(init.body);
        if(body?.action==='save'&&body?.state&&typeof body.state==='object'){
          const allowTodoWrite=body._todo_write===true;
          if('_todo_write' in body)delete body._todo_write;
          if(!allowTodoWrite&&Object.prototype.hasOwnProperty.call(body.state,'todos')){
            body.state={...body.state};delete body.state.todos;
          }
          nextInit={...init,body:JSON.stringify(body)};
        }
      }
    }catch(e){console.warn('todo save firewall parse failed',e)}
    return nativeFetch(input,nextInit);
  };
  window.todoCloudSaveWithTodos=async function(snapshot){
    if(typeof cloudRequest!=='function')return null;
    return cloudRequest('save',{state:snapshot,_todo_write:true});
  };
})();

(function(){
  let flushing=false;
  let timer=null;

  function code(){return (typeof userCode==='string'&&userCode)||localStorage.getItem('todoPlanner_activeCode')||''}
  function key(){const c=code();return c?`todoPlanner_todo_main_ack_v1_${c}`:''}
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function normalizeOp(x){
    if(!x||typeof x!=='object')return null;
    if(!x.kind&&x.todo?.id)return {...x,kind:'upsert'};
    return x;
  }
  function load(){try{const k=key();if(!k)return[];const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v.map(normalizeOp).filter(Boolean):[]}catch{return[]}}
  function save(items){try{const k=key();if(k)localStorage.setItem(k,JSON.stringify(items.slice(-250)))}catch{}}
  function status(todo){if(todo?.status==='done'||todo?.status==='postponed'||todo?.status==='skipped')return todo.status;return todo?.done?'done':'pending'}
  function idOf(op){return String(op?.todo?.id||op?.todo_id||'')}
  function opKey(op){if(op?.kind==='order')return `order:${op.mode}:${op.date}`;return `${op?.kind||'upsert'}:${idOf(op)}`}

  function enqueueOp(op){
    if(!op)return;
    const items=load(),id=idOf(op);
    if(op.kind==='delete'&&id){save([...items.filter(x=>idOf(x)!==id),op]);schedule(40);return}
    if(op.kind==='upsert'&&id){
      const move=items.find(x=>x.kind==='move'&&idOf(x)===id);
      if(move){move.todo=clone(op.todo);move.queued_at=op.queued_at;save(items);schedule(40);return}
    }
    const k=opKey(op);save([...items.filter(x=>opKey(x)!==k),op]);schedule(40);
  }
  function enqueueUpsert(mode,date,todo){if(mode&&date&&todo?.id)enqueueOp({kind:'upsert',mode,date,todo:clone(todo),queued_at:new Date().toISOString()})}
  function enqueueDelete(todoId){if(todoId)enqueueOp({kind:'delete',todo_id:String(todoId),queued_at:new Date().toISOString()})}
  function enqueueMove(mode,fromDate,toDate,todo){if(mode&&fromDate&&toDate&&todo?.id)enqueueOp({kind:'move',mode,fromDate,toDate,todo:clone(todo),queued_at:new Date().toISOString()})}
  function enqueueOrder(mode,date,ids){const clean=(Array.isArray(ids)?ids:[]).map(String).filter(Boolean);if(mode&&date&&clean.length)enqueueOp({kind:'order',mode,date,ids:clean,queued_at:new Date().toISOString()})}

  function ensureTodos(target){
    if(!target||typeof target!=='object')return null;
    if(!target.todos||typeof target.todos!=='object')target.todos={job:{},work:{}};
    if(!target.todos.job)target.todos.job={};if(!target.todos.work)target.todos.work={};return target.todos;
  }
  function removeIdEverywhere(target,id,mode){
    const todos=ensureTodos(target);if(!todos||!id)return;
    (mode?[mode]:['job','work']).forEach(m=>Object.keys(todos[m]||{}).forEach(date=>{
      const arr=Array.isArray(todos[m][date])?todos[m][date]:[];
      const next=arr.filter(x=>String(x?.id||'')!==String(id));
      if(next.length)todos[m][date]=next;else delete todos[m][date];
    }));
  }
  function applyOp(target,op){
    if(!target||typeof target!=='object')return target;
    const todos=ensureTodos(target);if(!todos)return target;
    if(op.kind==='upsert'){
      if(!todos[op.mode])todos[op.mode]={};
      const arr=Array.isArray(todos[op.mode][op.date])?todos[op.mode][op.date]:[];
      const id=String(op.todo.id),i=arr.findIndex(x=>String(x?.id||'')===id);
      if(i>=0)arr[i]=clone(op.todo);else arr.push(clone(op.todo));todos[op.mode][op.date]=arr;
      if(Array.isArray(target._deletedTodoIds))target._deletedTodoIds=target._deletedTodoIds.filter(x=>String(x)!==id);
    }else if(op.kind==='move'){
      const id=String(op.todo.id);removeIdEverywhere(target,id,op.mode);if(!todos[op.mode])todos[op.mode]={};
      (todos[op.mode][op.toDate]??=[]).push(clone(op.todo));
      if(Array.isArray(target._deletedTodoIds))target._deletedTodoIds=target._deletedTodoIds.filter(x=>String(x)!==id);
    }else if(op.kind==='delete'){
      const id=String(op.todo_id);removeIdEverywhere(target,id);
      const tomb=Array.isArray(target._deletedTodoIds)?target._deletedTodoIds:[];if(!tomb.map(String).includes(id))tomb.push(id);target._deletedTodoIds=tomb.slice(-500);
    }else if(op.kind==='order'){
      if(!todos[op.mode])todos[op.mode]={};const arr=Array.isArray(todos[op.mode][op.date])?todos[op.mode][op.date]:[];
      const map=new Map(arr.map(x=>[String(x?.id||''),x])),next=[];
      op.ids.forEach(id=>{const item=map.get(String(id));if(item){next.push(item);map.delete(String(id))}});map.forEach(item=>next.push(item));
      if(next.length)todos[op.mode][op.date]=next;else delete todos[op.mode][op.date];
    }
    target._updatedAt=new Date().toISOString();return target;
  }

  function findTodo(s,mode,date,id){const arr=s?.todos?.[mode]?.[date];return Array.isArray(arr)?arr.find(x=>String(x?.id||'')===String(id)):null}
  function verify(s,op){
    if(!s||typeof s!=='object')return false;
    if(op.kind==='upsert'){const got=findTodo(s,op.mode,op.date,op.todo.id);return !!got&&status(got)===status(op.todo)&&String(got.text||'')===String(op.todo.text||'')}
    if(op.kind==='move'){const got=findTodo(s,op.mode,op.toDate,op.todo.id),old=findTodo(s,op.mode,op.fromDate,op.todo.id);return !!got&&!old&&status(got)===status(op.todo)&&String(got.text||'')===String(op.todo.text||'')}
    if(op.kind==='delete'){const id=String(op.todo_id);return !['job','work'].some(m=>Object.values(s?.todos?.[m]||{}).some(arr=>Array.isArray(arr)&&arr.some(x=>String(x?.id||'')===id)))}
    if(op.kind==='order'){const arr=s?.todos?.[op.mode]?.[op.date];if(!Array.isArray(arr))return false;const actual=arr.map(x=>String(x?.id||'')).filter(id=>op.ids.includes(id)),expected=op.ids.filter(id=>arr.some(x=>String(x?.id||'')===id));return actual.join('|')===expected.join('|')}
    return false;
  }
  function delay(ms){return new Promise(r=>setTimeout(r,ms))}
  async function syncVault(op){
    if(op.kind==='upsert'&&typeof window.todoVaultEnqueueUpsert==='function')window.todoVaultEnqueueUpsert(op.mode,op.date,op.todo,op.todo?._itemUpdatedAt||op.queued_at);
    else if(op.kind==='move'&&typeof window.todoVaultEnqueueUpsert==='function')window.todoVaultEnqueueUpsert(op.mode,op.toDate,op.todo,op.todo?._itemUpdatedAt||op.queued_at);
    else if(op.kind==='delete'&&typeof window.todoVaultEnqueueDelete==='function')window.todoVaultEnqueueDelete(String(op.todo_id),op.queued_at);
    if(typeof window.todoVaultFlushOutbox==='function')await window.todoVaultFlushOutbox();
  }
  async function saveTrusted(snapshot){return typeof window.todoCloudSaveWithTodos==='function'?window.todoCloudSaveWithTodos(snapshot):cloudRequest('save',{state:snapshot,_todo_write:true})}

  async function flush(){
    if(flushing||!CLOUD_READY||!code()||typeof cloudRequest!=='function')return false;
    const pending=load();if(!pending.length)return true;flushing=true;
    try{
      for(const op of pending){
        let ok=false;
        for(let attempt=0;attempt<5&&!ok;attempt++){
          try{
            applyOp(state,op);if(typeof saveLocal==='function')saveLocal();await syncVault(op);
            const before=await cloudRequest('load');const base=before?.state&&typeof before.state==='object'?clone(before.state):clone(state);
            await saveTrusted(applyOp(base,op));await delay(120+attempt*90);
            const after=await cloudRequest('load');ok=verify(after?.state,op);if(!ok)await delay(160+attempt*140);
          }catch(e){console.warn('todo main ack attempt failed',e);await delay(220+attempt*180)}
        }
        if(ok){const k=opKey(op);save(load().filter(x=>opKey(x)!==k))}else break;
      }
    }finally{flushing=false}
    if(load().length){schedule(1800);return false}return true;
  }

  function schedule(ms=250){clearTimeout(timer);timer=setTimeout(()=>flush(),ms)}
  window.todoMainAckEnqueueUpsert=enqueueUpsert;window.todoMainAckEnqueueDelete=enqueueDelete;window.todoMainAckEnqueueMove=enqueueMove;window.todoMainAckEnqueueOrder=enqueueOrder;
  window.todoMainAckFlush=flush;window.todoMainAckPending=()=>load().length>0;
  window.todoMainAckApplyPending=function(){load().forEach(op=>applyOp(state,op));try{if(typeof saveLocal==='function')saveLocal()}catch{}};
  window.addEventListener('online',()=>schedule(100));window.addEventListener('focus',()=>schedule(120));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule(120)});
  setInterval(()=>{if(document.visibilityState==='visible')flush()},5000);setTimeout(()=>flush(),900);
})();
