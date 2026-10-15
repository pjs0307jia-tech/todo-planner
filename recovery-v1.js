(function(root){
  function mergeRecovery(backup,local){
    if(!backup||backup.version!==3||!backup.todos||!backup.moods)throw Error('투두리스트 백업 파일을 선택해주세요.');
    const next=JSON.parse(JSON.stringify(backup));
    const old=local&&typeof local==='object'?local:{};
    const deleted=new Set([...(next._deletedTodoIds||[]),...(old._deletedTodoIds||[])]);
    for(const field of ['todos','moods','notes']){
      next[field]=next[field]||{};
      for(const mode of ['job','work']){
        const a=next[field][mode]||{},b=old[field]?.[mode]||{};
        if(field==='todos'){
          const items=new Map();
          for(const source of [b,a])for(const [date,arr] of Object.entries(source)){
            if(!Array.isArray(arr))continue;
            for(const item of arr){
              if(!item?.id||deleted.has(String(item.id)))continue;
              const previous=items.get(String(item.id));
              if(!previous||(Date.parse(item._itemUpdatedAt)||0)>=(Date.parse(previous.item._itemUpdatedAt)||0))items.set(String(item.id),{date,item});
            }
          }
          next[field][mode]={};
          for(const {date,item} of items.values())(next[field][mode][date]??=[]).push(item);
        }else next[field][mode]={...b,...a};
      }
    }
    next.events={...(old.events||{}),...(next.events||{})};
    for(const field of ['deadlines','workItems']){
      const map=new Map();for(const item of [...(old[field]||[]),...(next[field]||[])])if(item?.id)map.set(String(item.id),item);
      next[field]=[...map.values()];
    }
    next._deletedTodoIds=[...deleted];next._updatedAt=new Date().toISOString();return next;
  }
  root.mergePlannerRecovery=mergeRecovery;
  if(typeof module!=='undefined')module.exports=mergeRecovery;
})(typeof window!=='undefined'?window:globalThis);
