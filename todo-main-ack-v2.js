(function(){
  let flushPromise=null;
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
    const previous=items.find(x=>idOf(x)===id&&id);
    if(previous&&Date.parse(previous.todo?._itemUpdatedAt||previous.queued_at)>Date.parse(op.todo?._itemUpdatedAt||op.queued_at))return;
    if(op.kind==='delete'&&id){save([...items.filter(x=>idOf(x)!==id),op]);schedule(40);return}
    if(op.kind==='upsert'&&id){
      const move=items.find(x=>x.kind==='move'&&idOf(x)===id);
      if(move){move.todo=clone(op.todo);move.queued_at=op.queued_at;save(items);schedule(40);return}
    }
    const k=opKey(op);save([...items.filter(x=>opKey(x)!==k),op]);schedule(40);
  }
  function enqueueUpsert(mode,date,todo){if(mode&&date&&todo?.id)enqueueOp({kind:'upsert',mode,date,todo:clone(todo),queued_at:new Date().toISOString()})}
  function enqueueDelete(todoId,stamp){if(todoId)enqueueOp({kind:'delete',todo_id:String(todoId),queued_at:stamp||new Date().toISOString()})}
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
  function sameOperation(a,b){return a&&b&&JSON.stringify(a)===JSON.stringify(b)}
  function flush(){
    if(flushPromise)return flushPromise;
    if(!load().length)return Promise.resolve(true);
    if(!CLOUD_READY||!code()||typeof cloudRequest!=='function')return Promise.resolve(false);
    const owner=code();
    flushPromise=(async()=>{
      try{
        while(owner===code()){
          const op=load()[0];if(!op)return true;
          let response;
          if(op.kind==='order')response=await cloudRequest('patch',{operations:[{field:'todoOrder',mode:op.mode,key:op.date,value:op.ids,mutation_at:op.queued_at}]});
          else if(op.kind==='delete')response=await cloudRequest('todo_delete',{todo_id:String(op.todo_id),client_updated_at:op.queued_at});
          else response=await cloudRequest('todo_upsert',{mode:op.mode,date:op.toDate||op.date,todo:op.todo,client_updated_at:op.todo?._itemUpdatedAt||op.queued_at});
          if(!response?.ok)throw Error('Todo save was not acknowledged');
          if(owner!==code())return false;
          // An ACK belongs only to the exact revision sent, never a later edit.
          save(load().filter(x=>!sameOperation(x,op)));
        }
        return false;
      }catch(e){console.warn('todo save pending',e);schedule(5000);return false}
      finally{flushPromise=null;if(typeof setSyncStatus==='function')setSyncStatus(load().length?'local':'cloud')}
    })();
    return flushPromise;
  }

  function schedule(ms=250){clearTimeout(timer);timer=setTimeout(()=>flush(),ms)}
  window.todoMainAckEnqueueUpsert=enqueueUpsert;window.todoMainAckEnqueueDelete=enqueueDelete;window.todoMainAckEnqueueMove=enqueueMove;window.todoMainAckEnqueueOrder=enqueueOrder;
  window.todoMainAckFlush=flush;window.todoMainAckPending=()=>load().length>0;
  window.todoMainAckApplyPending=function(){load().forEach(op=>applyOp(state,op));try{if(typeof saveLocal==='function')saveLocal()}catch{}};
  window.addEventListener('online',()=>schedule(100));window.addEventListener('focus',()=>schedule(120));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule(120)});
  setInterval(()=>{if(document.visibilityState==='visible')flush()},5000);setTimeout(()=>flush(),900);
})();
