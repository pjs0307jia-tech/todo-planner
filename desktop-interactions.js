(function(){
  const DESKTOP_MIN=801;
  const grid=document.getElementById('grid');
  const todoList=document.getElementById('todoList');
  if(!grid||!todoList)return;

  let singleClickTimer=null;
  let dragPayload=null;
  let activeDropDay=null;
  let suppressClicksUntil=0;
  let toastTimer=null;

  function isDesktop(){return window.innerWidth>=DESKTOP_MIN}

  function dateForDay(day){
    const days=[...grid.querySelectorAll('.day')];
    const index=days.indexOf(day);
    if(index<0)return null;
    const y=view.getFullYear(),m=view.getMonth();
    const first=new Date(y,m,1);
    const start=new Date(y,m,1-first.getDay());
    const d=new Date(start);
    d.setDate(start.getDate()+index);
    d.setHours(0,0,0,0);
    return d;
  }

  function selectDesktopDate(d,openManager){
    if(!d)return;
    selected=new Date(d);
    if(d.getMonth()!==view.getMonth()||d.getFullYear()!==view.getFullYear()){
      view=new Date(d.getFullYear(),d.getMonth(),1);
    }
    if(typeof closeDayManager==='function')closeDayManager();
    renderAll();
    if(openManager){
      requestAnimationFrame(()=>{
        if(typeof dayManagerEditing!=='undefined')dayManagerEditing=null;
        if(typeof renderDayManager==='function')renderDayManager(true);
      });
    }
  }

  // Desktop: one click selects the date; a double click opens the manager.
  // The short delay keeps the calendar DOM stable long enough for the browser
  // to recognise the second click reliably.
  grid.addEventListener('click',e=>{
    if(!isDesktop())return;
    const day=e.target.closest('.day');
    if(!day||!grid.contains(day))return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if(Date.now()<suppressClicksUntil)return;

    const d=dateForDay(day);
    if(!d)return;

    if(e.detail>=2){
      clearTimeout(singleClickTimer);
      singleClickTimer=null;
      selectDesktopDate(d,true);
      return;
    }

    clearTimeout(singleClickTimer);
    singleClickTimer=setTimeout(()=>{
      singleClickTimer=null;
      selectDesktopDate(d,false);
    },260);
  },true);

  // Fallback for browsers that report the second click detail differently.
  grid.addEventListener('dblclick',e=>{
    if(!isDesktop())return;
    const day=e.target.closest('.day');
    if(!day||!grid.contains(day))return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    clearTimeout(singleClickTimer);
    singleClickTimer=null;
    const d=dateForDay(day);
    if(d)selectDesktopDate(d,true);
  },true);

  function clearDropTarget(){
    if(activeDropDay)activeDropDay.classList.remove('todo-drop-target');
    activeDropDay=null;
  }

  function showMoveToast(d){
    const toast=document.getElementById('toast');
    if(!toast)return;
    toast.textContent=`${d.getMonth()+1}월 ${d.getDate()}일로 옮겼어요`;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toast.classList.remove('show'),1500);
  }

  function enhanceTodoDrag(){
    const desktop=isDesktop();
    const sourceDate=dateKey(selected);
    const arr=modeTodos()[sourceDate]||[];
    const items=[...todoList.querySelectorAll('.todo-item')];

    items.forEach((el,index)=>{
      const todo=arr[index];
      if(!todo)return;
      el.draggable=desktop;
      el.dataset.todoId=String(todo.id);
      el.dataset.todoDate=sourceDate;
      el.dataset.todoMode=activeMode;
      el.querySelectorAll('button').forEach(btn=>btn.draggable=false);

      if(!desktop)return;
      el.addEventListener('dragstart',e=>{
        dragPayload={
          id:String(todo.id),
          sourceDate,
          mode:activeMode
        };
        el.classList.add('todo-dragging');
        if(typeof closeDayManager==='function')closeDayManager();
        if(e.dataTransfer){
          e.dataTransfer.effectAllowed='move';
          const raw=JSON.stringify(dragPayload);
          try{e.dataTransfer.setData('application/x-todo-planner',raw)}catch{}
          try{e.dataTransfer.setData('text/plain',raw)}catch{}
        }
      });
      el.addEventListener('dragend',()=>{
        el.classList.remove('todo-dragging');
        dragPayload=null;
        clearDropTarget();
      });
    });
  }

  const originalRenderTodos=renderTodos;
  renderTodos=function(){
    originalRenderTodos();
    enhanceTodoDrag();
  };
  enhanceTodoDrag();

  grid.addEventListener('dragover',e=>{
    if(!isDesktop()||!dragPayload)return;
    const day=e.target.closest('.day');
    if(!day||!grid.contains(day))return;
    e.preventDefault();
    if(e.dataTransfer)e.dataTransfer.dropEffect='move';
    if(activeDropDay!==day){
      clearDropTarget();
      activeDropDay=day;
      day.classList.add('todo-drop-target');
    }
  });

  grid.addEventListener('dragleave',e=>{
    if(!activeDropDay)return;
    const next=e.relatedTarget;
    if(next&&activeDropDay.contains(next))return;
    const day=e.target.closest('.day');
    if(day===activeDropDay)clearDropTarget();
  });

  grid.addEventListener('drop',e=>{
    if(!isDesktop()||!dragPayload)return;
    const day=e.target.closest('.day');
    if(!day||!grid.contains(day))return;
    e.preventDefault();
    e.stopPropagation();

    const destination=dateForDay(day);
    const payload={...dragPayload};
    dragPayload=null;
    clearDropTarget();
    if(!destination)return;

    const destinationKey=dateKey(destination);
    if(destinationKey===payload.sourceDate)return;

    const todoMaps=state.todos?.[payload.mode];
    if(!todoMaps)return;
    const source=todoMaps[payload.sourceDate]||[];
    const index=source.findIndex(todo=>String(todo.id)===payload.id);
    if(index<0)return;

    const [todo]=source.splice(index,1);
    if(!source.length)delete todoMaps[payload.sourceDate];
    (todoMaps[destinationKey]??=[]).push(todo);

    suppressClicksUntil=Date.now()+350;
    selected=new Date(destination);
    if(destination.getMonth()!==view.getMonth()||destination.getFullYear()!==view.getFullYear()){
      view=new Date(destination.getFullYear(),destination.getMonth(),1);
    }
    queueSave();
    renderAll();
    showMoveToast(destination);
  });

  const style=document.createElement('style');
  style.id='desktopInteractionStyles';
  style.textContent=`
    @media (min-width:801px){
      .todo-item[draggable="true"]{cursor:grab;transition:opacity .15s ease,transform .15s ease,box-shadow .15s ease}
      .todo-item[draggable="true"]:active{cursor:grabbing}
      .todo-item.todo-dragging{opacity:.42;transform:scale(.985);box-shadow:none}
      #grid .day.todo-drop-target{background:var(--accent-soft)!important;outline:2px dashed var(--accent);outline-offset:-3px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.72)}
    }
  `;
  document.head.appendChild(style);

  window.addEventListener('resize',()=>{
    clearTimeout(singleClickTimer);
    singleClickTimer=null;
    clearDropTarget();
    enhanceTodoDrag();
  });
})();
