(function(){
  const list=document.getElementById('todoList');
  if(!list)return;

  let drag=null;
  const MOVE_EASE='cubic-bezier(.22,.82,.24,1)';

  function currentKey(){return dateKey(selected)}
  function currentArray(){return modeTodos()[currentKey()]||[]}

  function reorderArrayByDom(){
    const k=currentKey();
    const arr=currentArray();
    if(!arr.length)return false;
    const ids=[...list.querySelectorAll('.todo-item')]
      .map(el=>String(el.dataset.todoId||''))
      .filter(Boolean);
    const map=new Map(arr.map(item=>[String(item.id),item]));
    const next=[];
    ids.forEach(id=>{
      const item=map.get(id);
      if(item){next.push(item);map.delete(id)}
    });
    map.forEach(item=>next.push(item));
    const changed=next.some((item,index)=>item!==arr[index]);
    if(changed)modeTodos()[k]=next;
    return changed;
  }

  function addHandle(el){
    if(el.querySelector('.todo-reorder-handle'))return;
    const handle=document.createElement('button');
    handle.type='button';
    handle.className='todo-reorder-handle';
    handle.setAttribute('aria-label','드래그해서 우선순위 바꾸기');
    handle.title='드래그해서 우선순위 바꾸기';
    handle.innerHTML='<span aria-hidden="true">≡</span>';
    handle.draggable=false;
    handle.addEventListener('dragstart',e=>{e.preventDefault();e.stopPropagation()});
    const del=el.querySelector('.delete');
    if(del)el.insertBefore(handle,del);else el.append(handle);
  }

  function animateShift(beforeRects){
    [...list.querySelectorAll('.todo-item')].forEach(el=>{
      const old=beforeRects.get(el);
      if(!old)return;
      const now=el.getBoundingClientRect();
      const dy=old.top-now.top;
      if(Math.abs(dy)<1)return;
      try{
        el.animate(
          [{transform:`translateY(${dy}px)`},{transform:'translateY(0)'}],
          {duration:190,easing:MOVE_EASE}
        );
      }catch{}
    });
  }

  function movePlaceholder(clientY){
    if(!drag)return;
    const items=[...list.querySelectorAll('.todo-item')];
    if(!items.length)return;

    let beforeNode=null;
    for(const item of items){
      const r=item.getBoundingClientRect();
      if(clientY<r.top+r.height/2){beforeNode=item;break}
    }

    const parent=drag.placeholder.parentNode;
    const next=drag.placeholder.nextSibling;
    const intended=beforeNode||null;
    if((intended===drag.placeholder)||(!intended&&next===null))return;
    if(intended===next)return;

    const beforeRects=new Map(items.map(el=>[el,el.getBoundingClientRect()]));
    if(beforeNode)list.insertBefore(drag.placeholder,beforeNode);
    else list.appendChild(drag.placeholder);
    animateShift(beforeRects);
    drag.moved=true;
  }

  function autoScroll(clientY){
    const lr=list.getBoundingClientRect();
    const threshold=48;
    if(list.scrollHeight>list.clientHeight+2){
      if(clientY<lr.top+threshold)list.scrollTop-=12;
      else if(clientY>lr.bottom-threshold)list.scrollTop+=12;
      return;
    }
    const edge=72;
    if(clientY<edge)window.scrollBy(0,-12);
    else if(clientY>window.innerHeight-edge)window.scrollBy(0,12);
  }

  function updateGhost(clientX,clientY){
    if(!drag)return;
    const top=clientY-drag.offsetY;
    drag.ghost.style.top=`${top}px`;
    drag.ghost.style.left=`${drag.left}px`;
  }

  function beginDrag(el,handle,clientX,clientY,pointerId){
    if(drag)return;
    const id=String(el.dataset.todoId||'');
    if(!id)return;

    const rect=el.getBoundingClientRect();
    const placeholder=document.createElement('div');
    placeholder.className='todo-reorder-placeholder';
    placeholder.style.height=`${rect.height}px`;

    const ghost=el.cloneNode(true);
    ghost.classList.add('todo-reorder-ghost');
    ghost.classList.remove('todo-reorder-dragging','todo-reorder-touching');
    ghost.style.width=`${rect.width}px`;
    ghost.style.height=`${rect.height}px`;
    ghost.style.left=`${rect.left}px`;
    ghost.style.top=`${rect.top}px`;
    ghost.querySelectorAll('button').forEach(btn=>{btn.tabIndex=-1;btn.disabled=true});

    el.parentNode.insertBefore(placeholder,el);
    el.remove();
    document.body.appendChild(ghost);

    const wasDraggable=el.draggable;
    el.draggable=false;
    handle.classList.add('is-grabbed');
    document.body.classList.add('todo-reordering');

    drag={
      id,source:el,handle,placeholder,ghost,
      pointerId,date:currentKey(),mode:activeMode,
      left:rect.left,offsetY:clientY-rect.top,
      moved:false,wasDraggable
    };

    requestAnimationFrame(()=>ghost.classList.add('is-floating'));
    updateGhost(clientX,clientY);
  }

  function finishDrag(cancelled=false){
    if(!drag)return;
    const d=drag;
    drag=null;

    d.handle.classList.remove('is-grabbed');
    document.body.classList.remove('todo-reordering');

    const sameContext=d.date===currentKey()&&d.mode===activeMode;
    if(!sameContext||!d.placeholder.isConnected){
      d.ghost.remove();
      if(d.placeholder.isConnected)d.placeholder.replaceWith(d.source);
      d.source.draggable=d.wasDraggable;
      renderAll();
      return;
    }

    const targetRect=d.placeholder.getBoundingClientRect();
    d.ghost.classList.remove('is-floating');
    d.ghost.style.transition=`top 140ms ${MOVE_EASE}, left 140ms ${MOVE_EASE}, transform 140ms ${MOVE_EASE}, opacity 140ms ease`;
    d.ghost.style.top=`${targetRect.top}px`;
    d.ghost.style.left=`${targetRect.left}px`;
    d.ghost.style.transform='scale(1)';
    d.ghost.style.opacity='.18';

    d.placeholder.replaceWith(d.source);
    d.source.draggable=d.wasDraggable;

    if(!cancelled&&d.moved){
      if(reorderArrayByDom())queueSave();
    }

    d.source.classList.add('todo-reorder-land');
    try{
      d.source.animate(
        [{transform:'scale(.985)',opacity:.78},{transform:'scale(1)',opacity:1}],
        {duration:180,easing:MOVE_EASE}
      );
    }catch{}
    setTimeout(()=>{
      d.source.classList.remove('todo-reorder-land');
      d.ghost.remove();
    },155);
  }

  function bindHandle(el){
    addHandle(el);
    const handle=el.querySelector('.todo-reorder-handle');
    if(!handle||handle.dataset.reorderV2==='1')return;
    handle.dataset.reorderV2='1';

    handle.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      e.preventDefault();
      e.stopPropagation();
      beginDrag(el,handle,e.clientX,e.clientY,e.pointerId);
    },{passive:false});

    handle.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
    });
  }

  function enhance(){
    const arr=currentArray();
    [...list.querySelectorAll('.todo-item')].forEach((el,index)=>{
      const todo=arr[index];
      if(todo)el.dataset.todoId=String(todo.id);
      bindHandle(el);
    });
  }

  window.addEventListener('pointermove',e=>{
    if(!drag||drag.pointerId!==e.pointerId)return;
    e.preventDefault();
    updateGhost(e.clientX,e.clientY);
    movePlaceholder(e.clientY);
    autoScroll(e.clientY);
  },{passive:false});

  window.addEventListener('pointerup',e=>{
    if(!drag||drag.pointerId!==e.pointerId)return;
    e.preventDefault();
    finishDrag(false);
  },{passive:false});

  window.addEventListener('pointercancel',e=>{
    if(!drag||drag.pointerId!==e.pointerId)return;
    finishDrag(true);
  });

  window.addEventListener('blur',()=>{if(drag)finishDrag(true)});

  const previousRenderTodos=renderTodos;
  renderTodos=function(){
    previousRenderTodos();
    enhance();
  };
  enhance();

  const style=document.createElement('style');
  style.id='todoReorderV2Styles';
  style.textContent=`
    .todo-reorder-handle{
      width:24px;height:28px;display:grid;place-items:center;flex:0 0 24px;
      border:0;background:transparent;color:#c9bec4;padding:0;border-radius:8px;
      font-size:17px;line-height:1;touch-action:none;-webkit-user-select:none;user-select:none;
      transition:color .14s ease,background .14s ease,transform .14s ease,opacity .14s ease;
    }
    .todo-reorder-handle span{display:block;margin-top:-2px;transform:scaleX(1.06)}
    .todo-reorder-handle:hover,.todo-reorder-handle.is-grabbed{color:var(--accent-deep);background:var(--accent-soft)}
    .todo-reorder-handle.is-grabbed{transform:scale(1.08)}

    .todo-reorder-placeholder{
      position:relative;flex:0 0 auto;border:1.5px dashed var(--accent);
      border-radius:13px;background:var(--accent-soft);opacity:.72;
      box-shadow:inset 0 0 0 2px rgba(255,255,255,.55);
      animation:todoSlotIn .16s ${MOVE_EASE};
    }
    .todo-reorder-placeholder:after{
      content:'여기에 놓기';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
      color:var(--accent-deep);font-size:9px;font-weight:700;white-space:nowrap;opacity:.72;
    }
    @keyframes todoSlotIn{from{opacity:.2;transform:scaleY(.86)}to{opacity:.72;transform:scaleY(1)}}

    .todo-reorder-ghost{
      position:fixed!important;z-index:9999!important;margin:0!important;pointer-events:none!important;
      transform:scale(.985);transform-origin:center center;opacity:.94;
      box-shadow:0 12px 34px rgba(86,65,76,.18),0 3px 10px rgba(86,65,76,.10)!important;
      border-color:var(--accent)!important;background:#fff!important;
      will-change:top,left,transform,opacity;
    }
    .todo-reorder-ghost.is-floating{transform:scale(1.025);opacity:.97}
    .todo-reorder-ghost .todo-reorder-handle{color:var(--accent-deep);background:var(--accent-soft)}

    body.todo-reordering{-webkit-user-select:none;user-select:none;cursor:grabbing}
    body.todo-reordering *{cursor:grabbing!important}
    .todo-item{transition:border-color .14s ease,box-shadow .14s ease,background .14s ease}

    @media(min-width:801px){
      .todo-reorder-handle{opacity:.58;cursor:grab}
      .todo-item:hover .todo-reorder-handle{opacity:1}
      .todo-reorder-handle:active{cursor:grabbing}
    }
    @media(max-width:800px){
      .todo-reorder-handle{width:28px;flex-basis:28px;color:#bfb4ba;opacity:1}
      .todo-reorder-handle:before{
        content:'';position:absolute;width:34px;height:38px;border-radius:10px;
      }
      .todo-reorder-placeholder:after{font-size:8.5px}
      .todo-reorder-ghost{box-shadow:0 14px 36px rgba(86,65,76,.21),0 4px 12px rgba(86,65,76,.10)!important}
    }
    @media(prefers-reduced-motion:reduce){
      .todo-reorder-handle,.todo-item{transition:none!important}
      .todo-reorder-placeholder{animation:none!important}
    }
  `;
  document.head.appendChild(style);
})();
