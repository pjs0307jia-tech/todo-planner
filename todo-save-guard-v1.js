(function(){
  let timer=null;

  function forceTodoSave(reason){
    clearTimeout(timer);
    timer=setTimeout(async()=>{
      try{
        if(!state||!userCode)return;
        if(typeof window.plannerBackupLocal==='function')window.plannerBackupLocal(reason||'todo-guard');
        if(typeof saveLocal==='function')saveLocal();
        if(typeof window.plannerMarkSyncPending==='function')window.plannerMarkSyncPending();
        if(typeof saveCloud==='function')await saveCloud();
      }catch(e){console.warn('todo immediate save failed',e)}
    },25);
  }

  // Redundant protection: app.js already queues saves, but todos are important enough
  // to also push immediately after add/status/delete interactions.
  document.addEventListener('submit',e=>{
    if(e.target?.id==='todoForm')forceTodoSave('todo-add');
  },true);

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#todoList .check'))forceTodoSave('todo-status');
    if(e.target?.closest?.('#todoList .delete'))forceTodoSave('todo-delete');
  },true);

  window.forceTodoCloudSave=forceTodoSave;
})();
