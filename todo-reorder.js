(function(){
  const list=document.getElementById('todoList');
  if(!list)return;

  const MOBILE_MAX=800;
  let desktopDrag=null;
  let touchDrag=null;

  function currentKey(){return dateKey(selected)}
  function currentArray(){return modeTodos()[currentKey()]||[]}
  function isMobile(){return window.innerWidth<=MOBILE_MAX}

  function findItem(id){
    return currentArray().find(x=>String(x.id)===String(id));
  }

  function reorderArrayByIds(ids){
    const k=currentKey();
    const arr=currentArray();
    if(!arr.length)return false;
    const map=new Map(arr.map(x=>[String(x.id),x]));
    const next=[];
    ids.forEach(id=>{const item=map.get(String(id));if(item){next.push(item);map.delete(String(id))}});
    map.forEach(item=>next.push(item));
    const changed=next.some((item,i)=>item!==arr[i]);
    if(changed)modeTodos()[k]=next;
    return changed;
  }

  function clearDesktopTargets(){
    list.querySelectorAll('.todo-reorder-before,.todo-reorder-after').forEach(el=>el.classList.remove('todo-reorder-before','todo-reorder-after'));
  }

  function addHandle(el){
    if(el.querySelector('.todo-reorder-handle'))return;
    const handle=document.createElement('button');
    handle.type='button';
    handle.className='todo-reorder-handle';
    handle.setAttribute('aria-label','우선순위 순서 바꾸기');
    handle.title='드래그해서 순서 바꾸기';
    handle.innerHTML='<span aria-hidden="true">≡</span>';
    const del=el.querySelector('.delete');
    if(del)el.insertBefore(handle,del);else el.append(handle);
  }

  function enhance(){
    const arr=currentArray();
    const items=[...list.querySelectorAll('.todo-item')];
    items.forEach((el,index)=>{
      const todo=arr[index]||findItem(el.dataset.todoId);
      if(!todo)return;
      el.dataset.todoId=String(todo.id);
      addHandle(el);

      if(el.dataset.reorderBound==='1')return;
      el.dataset.reorderBound='1';

      el.addEventListener('dragstart',()=>{
        if(isMobile())return;
        desktopDrag={id:String(el.dataset.todoId),date:currentKey(),mode:activeMode};
        el.classList.add('todo-reorder-dragging');
      });
      el.addEventListener('dragend',()=>{
        desktopDrag=null;
        el.classList.remove('todo-reorder-dragging');
        clearDesktopTargets();
      });

      const handle=el.querySelector('.todo-reorder-handle');
      handle.addEventListener('pointerdown',e=>{
        if(!isMobile())return;
        const id=String(el.dataset.todoId||'');
        if(!id)return;
        e.preventDefault();
        e.stopPropagation();
        touchDrag={
          pointerId:e.pointerId,
          id,
          source:el,
          handle,
          date:currentKey(),
          mode:activeMode,
          moved:false
        };
        try{handle.setPointerCapture(e.pointerId)}catch{}
        el.classList.add('todo-reorder-touching');
        document.body.classList.add('todo-reordering');
      });

      handle.addEventListener('pointermove',e=>{
        if(!touchDrag||touchDrag.pointerId!==e.pointerId||touchDrag.handle!==handle)return;
        e.preventDefault();
        const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.todo-item');
        if(!target||target===touchDrag.source||!list.contains(target))return;
        const rect=target.getBoundingClientRect();
        const before=e.clientY<rect.top+rect.height/2;
        if(before)list.insertBefore(touchDrag.source,target);
        else list.insertBefore(touchDrag.source,target.nextSibling);
        touchDrag.moved=true;
        const edge=58;
        if(e.clientY<edge)window.scrollBy({top:-18,behavior:'auto'});
        else if(e.clientY>window.innerHeight-edge)window.scrollBy({top:18,behavior:'auto'});
      });

      const finishTouch=e=>{
        if(!touchDrag||touchDrag.pointerId!==e.pointerId||touchDrag.handle!==handle)return;
        e.preventDefault();
        e.stopPropagation();
        const drag={...touchDrag};
        touchDrag=null;
        try{handle.releasePointerCapture(e.pointerId)}catch{}
        drag.source.classList.remove('todo-reorder-touching');
        document.body.classList.remove('todo-reordering');
        if(drag.date!==currentKey()||drag.mode!==activeMode){renderAll();return}
        if(drag.moved){
          const ids=[...list.querySelectorAll('.todo-item')].map(x=>String(x.dataset.todoId||'')).filter(Boolean);
          if(reorderArrayByIds(ids)){queueSave();renderAll()}
        }
      };
      handle.addEventListener('pointerup',finishTouch);
      handle.addEventListener('pointercancel',finishTouch);
    });
  }

  list.addEventListener('dragover',e=>{
    if(isMobile()||!desktopDrag)return;
    const target=e.target.closest('.todo-item');
    if(!target||!list.contains(target)||String(target.dataset.todoId)===desktopDrag.id)return;
    e.preventDefault();
    e.stopPropagation();
    clearDesktopTargets();
    const r=target.getBoundingClientRect();
    target.classList.add(e.clientY<r.top+r.height/2?'todo-reorder-before':'todo-reorder-after');
    if(e.dataTransfer)e.dataTransfer.dropEffect='move';
  });

  list.addEventListener('drop',e=>{
    if(isMobile()||!desktopDrag)return;
    const target=e.target.closest('.todo-item');
    if(!target||!list.contains(target))return;
    e.preventDefault();
    e.stopPropagation();
    const sourceId=desktopDrag.id;
    const targetId=String(target.dataset.todoId||'');
    const sameContext=desktopDrag.date===currentKey()&&desktopDrag.mode===activeMode;
    const before=target.classList.contains('todo-reorder-before');
    desktopDrag=null;
    clearDesktopTargets();
    if(!sameContext||!sourceId||!targetId||sourceId===targetId)return;

    const arr=currentArray();
    const from=arr.findIndex(x=>String(x.id)===sourceId);
    if(from<0)return;
    const [item]=arr.splice(from,1);
    let to=arr.findIndex(x=>String(x.id)===targetId);
    if(to<0){arr.splice(from,0,item);return}
    if(!before)to+=1;
    arr.splice(to,0,item);
    queueSave();
    renderAll();
  });

  list.addEventListener('dragleave',e=>{
    if(!desktopDrag)return;
    const related=e.relatedTarget;
    if(related&&list.contains(related))return;
    clearDesktopTargets();
  });

  const previousRenderTodos=renderTodos;
  renderTodos=function(){
    previousRenderTodos();
    enhance();
  };
  enhance();

  const style=document.createElement('style');
  style.id='todoReorderStyles';
  style.textContent=`
    .todo-reorder-handle{
      width:22px;height:26px;display:grid;place-items:center;flex:0 0 22px;
      border:0;background:transparent;color:#c8bec3;padding:0;border-radius:7px;
      font-size:17px;line-height:1;touch-action:none;-webkit-user-select:none;user-select:none;
    }
    .todo-reorder-handle:hover{color:var(--accent-deep);background:var(--accent-soft)}
    .todo-reorder-handle span{display:block;transform:scaleX(1.05);margin-top:-2px}
    .todo-item.todo-reorder-touching{position:relative;z-index:20;box-shadow:0 8px 24px rgba(91,70,80,.14);transform:scale(1.015);border-color:var(--accent)}
    body.todo-reordering{overscroll-behavior:none}
    body.todo-reordering .todo-reorder-handle{color:var(--accent-deep)}
    @media(min-width:801px){
      .todo-item.todo-reorder-dragging{opacity:.45}
      .todo-item.todo-reorder-before{box-shadow:inset 0 2px 0 var(--accent-deep)}
      .todo-item.todo-reorder-after{box-shadow:inset 0 -2px 0 var(--accent-deep)}
      .todo-reorder-handle{opacity:.58}
      .todo-item:hover .todo-reorder-handle{opacity:1}
    }
    @media(max-width:800px){
      .todo-reorder-handle{width:24px;flex-basis:24px;color:#c2b8bd}
      .todo-item{transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
    }
  `;
  document.head.appendChild(style);
})();
