(function(){
  const KEY='_todoJournalV1';
  const MAX=700;
  const VALID_MODES=new Set(['job','work']);

  function clone(v){try{return JSON.parse(JSON.stringify(v))}catch{return v}}
  function ms(v){const n=Date.parse(v||'');return Number.isFinite(n)?n:0}
  function ensureJournal(s){
    if(!s||typeof s!=='object')return {};
    const raw=s[KEY];
    s[KEY]=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    return s[KEY];
  }
  function prune(j){
    const entries=Object.entries(j||{});
    if(entries.length<=MAX)return j||{};
    entries.sort((a,b)=>ms(b[1]?.mutationAt)-ms(a[1]?.mutationAt));
    return Object.fromEntries(entries.slice(0,MAX));
  }
  function newer(a,b){
    if(!a)return b;if(!b)return a;
    const at=ms(a.mutationAt),bt=ms(b.mutationAt);
    if(at!==bt)return at>bt?a:b;
    return a;
  }
  function mergeJournal(a,b){
    const out={};
    const aa=a&&typeof a==='object'&&!Array.isArray(a)?a:{};
    const bb=b&&typeof b==='object'&&!Array.isArray(b)?b:{};
    new Set([...Object.keys(bb),...Object.keys(aa)]).forEach(id=>{
      const rec=newer(aa[id],bb[id]);if(rec)out[id]=clone(rec);
    });
    return prune(out);
  }
  function itemStamp(todo){return ms(todo?._itemUpdatedAt||todo?.itemUpdatedAt||'')}
  function statusOf(todo){
    if(todo?.status==='done'||todo?.status==='postponed'||todo?.status==='skipped')return todo.status;
    return todo?.done?'done':'pending';
  }
  function findNewestItem(s,id){
    let best=null,bestStamp=-1,bestMode='',bestDate='';
    ['job','work'].forEach(mode=>Object.entries(s?.todos?.[mode]||{}).forEach(([date,arr])=>{
      if(!Array.isArray(arr))return;
      arr.forEach(todo=>{
        if(String(todo?.id||'')!==String(id))return;
        const st=itemStamp(todo);
        if(st>=bestStamp){best=todo;bestStamp=st;bestMode=mode;bestDate=date}
      });
    }));
    return {todo:best,stamp:bestStamp,mode:bestMode,date:bestDate};
  }
  function removeEverywhere(s,id){
    ['job','work'].forEach(mode=>Object.keys(s?.todos?.[mode]||{}).forEach(date=>{
      const arr=Array.isArray(s.todos[mode][date])?s.todos[mode][date]:[];
      const next=arr.filter(todo=>String(todo?.id||'')!==String(id));
      if(next.length)s.todos[mode][date]=next;else delete s.todos[mode][date];
    }));
  }
  function applyJournal(s){
    if(!s||typeof s!=='object'||!s.todos)return s;
    if(!s.todos.job)s.todos.job={};if(!s.todos.work)s.todos.work={};
    const j=ensureJournal(s);
    Object.entries(j).sort((a,b)=>ms(a[1]?.mutationAt)-ms(b[1]?.mutationAt)).forEach(([id,rec])=>{
      if(!id||!rec||typeof rec!=='object')return;
      const rStamp=ms(rec.mutationAt);
      const cur=findNewestItem(s,id);
      if(cur.todo&&cur.stamp>rStamp)return;

      removeEverywhere(s,id);
      if(rec.deleted){
        const tomb=Array.isArray(s._deletedTodoIds)?s._deletedTodoIds:[];
        if(!tomb.map(String).includes(String(id)))tomb.push(String(id));
        s._deletedTodoIds=tomb.slice(-500);
        return;
      }
      const mode=VALID_MODES.has(rec.mode)?rec.mode:'job';
      const date=String(rec.date||'');
      if(!date||!rec.todo)return;
      const todo=clone(rec.todo);
      todo.id=String(todo.id||id);
      if(rec.mutationAt)todo._itemUpdatedAt=rec.mutationAt;
      if(!todo.status)todo.status=statusOf(todo);
      todo.done=todo.status==='done';
      (s.todos[mode][date]??=[]).push(todo);
      if(Array.isArray(s._deletedTodoIds))s._deletedTodoIds=s._deletedTodoIds.filter(x=>String(x)!==String(id));
    });
    return s;
  }
  function recordUpsert(mode,date,todo,stamp){
    if(typeof state==='undefined'||!state||!todo?.id||!VALID_MODES.has(mode)||!date)return false;
    const mutationAt=stamp||todo._itemUpdatedAt||new Date().toISOString();
    todo._itemUpdatedAt=mutationAt;
    const j=ensureJournal(state),id=String(todo.id);
    const rec={id,mode,date:String(date),todo:clone(todo),mutationAt,deleted:false};
    j[id]=clone(newer(rec,j[id]));
    state[KEY]=prune(j);
    applyJournal(state);
    return true;
  }
  function recordDelete(id,stamp){
    if(typeof state==='undefined'||!state||!id)return false;
    const mutationAt=stamp||new Date().toISOString();
    const j=ensureJournal(state),sid=String(id);
    const rec={id:sid,mutationAt,deleted:true};
    j[sid]=clone(newer(rec,j[sid]));
    state[KEY]=prune(j);
    applyJournal(state);
    return true;
  }

  if(typeof window.plannerNormalizeSafe==='function'){
    const prev=window.plannerNormalizeSafe;
    window.plannerNormalizeSafe=function(raw){
      const s=prev(raw);
      s[KEY]=mergeJournal(s[KEY],raw?.[KEY]);
      return applyJournal(s);
    };
  }
  if(typeof window.plannerMergeStates==='function'){
    const prev=window.plannerMergeStates;
    window.plannerMergeStates=function(a,b){
      const s=prev(a,b);
      s[KEY]=mergeJournal(a?.[KEY],b?.[KEY]);
      return applyJournal(s);
    };
  }
  if(typeof normalize==='function'){
    const prevNormalize=normalize;
    normalize=function(raw){
      const s=prevNormalize(raw);
      s[KEY]=mergeJournal(s[KEY],raw?.[KEY]);
      return applyJournal(s);
    };
  }
  if(typeof saveCloud==='function'){
    const prevSaveCloud=saveCloud;
    saveCloud=async function(){
      try{
        if(CLOUD_READY&&userCode&&typeof cloudRequest==='function'){
          const latest=await cloudRequest('load');
          if(latest?.state){
            state[KEY]=mergeJournal(state?.[KEY],latest.state?.[KEY]);
            applyJournal(state);
            if(typeof saveLocal==='function')saveLocal();
          }
        }
      }catch(e){console.warn('todo journal pre-save merge failed',e)}
      return prevSaveCloud();
    };
  }

  window.todoRootJournalRecordUpsert=recordUpsert;
  window.todoRootJournalRecordDelete=recordDelete;
  window.todoRootJournalApply=function(s){return applyJournal(s||state)};
  window.todoRootJournalMerge=mergeJournal;

  try{if(typeof state!=='undefined'&&state){ensureJournal(state);applyJournal(state)}}catch{}
})();