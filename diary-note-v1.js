(function(){
  const MAX_LEN=400;
  let editingKey=null;
  let lastRenderedKey='';
  const drafts={};

  function diaryLocalKey(){return `todoPlanner_diary_${userCode||'guest'}`}
  function parse(raw){try{return raw?JSON.parse(raw):null}catch{return null}}
  function blankNotes(){return {job:{},work:{}}}
  function normalizeNotes(raw){
    const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    return {job:src.job&&typeof src.job==='object'?src.job:{},work:src.work&&typeof src.work==='object'?src.work:{}};
  }
  function loadDiaryLocal(){return normalizeNotes(parse(localStorage.getItem(diaryLocalKey())))}
  function saveDiaryLocal(){
    if(!userCode||!state)return;
    try{localStorage.setItem(diaryLocalKey(),JSON.stringify(normalizeNotes(state.notes)))}catch{}
  }
  function preloadNotes(){
    if(!userCode)return blankNotes();
    const p=parse(sessionStorage.getItem(`todoPlanner_preload_snapshot_${userCode}`));
    return normalizeNotes(p?.notes);
  }
  function ensureNotes(){
    if(!state||typeof state!=='object')return blankNotes();
    const local=loadDiaryLocal();
    const preload=preloadNotes();
    const current=normalizeNotes(state.notes);
    state.notes={
      job:{...preload.job,...local.job,...current.job},
      work:{...preload.work,...local.work,...current.work}
    };
    return state.notes;
  }
  function modeNotes(){return ensureNotes()[activeMode]}
  function selectedKey(){return typeof dateKey==='function'?dateKey(selected):''}
  function identity(){return `${activeMode}:${selectedKey()}`}

  function ensureStyle(){
    if(document.getElementById('diaryNoteStyle'))return;
    const s=document.createElement('style');
    s.id='diaryNoteStyle';
    s.textContent=`
      .diary-note-wrap{margin-top:12px;padding-top:11px;border-top:1px solid var(--line,#eee3e7)}
      .diary-note-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px}
      .diary-note-head strong{font-size:12px;font-weight:800;color:var(--ink,#504a4d)}
      .diary-note-head span{font-size:10px;color:var(--muted,#aaa0a5)}
      .diary-note-editor[hidden],.diary-note-view[hidden]{display:none!important}
      .diary-note-input{display:block;width:100%;min-height:46px;max-height:96px;resize:none;overflow-y:auto;box-sizing:border-box;border:0;border-radius:10px;background:rgba(255,255,255,.62);padding:9px 10px;font:inherit;font-size:12px;line-height:1.48;color:var(--ink,#504a4d);outline:none;box-shadow:inset 0 0 0 1px rgba(232,214,220,.8);transition:box-shadow .15s,background .15s}
      .diary-note-input::placeholder{color:#c4b9be}
      .diary-note-input:focus{background:#fff;box-shadow:inset 0 0 0 1.5px var(--accent,#ec92ad)}
      body[data-mode="work"] .diary-note-input{box-shadow:inset 0 0 0 1px rgba(210,225,240,.9)}
      body[data-mode="work"] .diary-note-input:focus{box-shadow:inset 0 0 0 1.5px var(--accent,#80a9d7)}
      .diary-note-actions{display:flex;justify-content:flex-end;align-items:center;gap:7px;margin-top:8px}
      .diary-note-cancel,.diary-note-save,.diary-note-edit{border:0;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
      .diary-note-cancel,.diary-note-save{height:30px;padding:0 13px;border-radius:9px;font-size:11px;font-weight:800}
      .diary-note-cancel{background:#f6f2f4;color:#9e9398}
      .diary-note-save{background:var(--accent,#ec92ad);color:#fff}
      body[data-mode="work"] .diary-note-cancel{background:#f1f5f9;color:#8996a5}
      .diary-note-view{position:relative;min-height:44px;box-sizing:border-box;border-radius:10px;background:rgba(255,255,255,.62);padding:10px 38px 10px 10px;box-shadow:inset 0 0 0 1px rgba(232,214,220,.8)}
      body[data-mode="work"] .diary-note-view{box-shadow:inset 0 0 0 1px rgba(210,225,240,.9)}
      .diary-note-view-text{white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.5;color:var(--ink,#504a4d)}
      .diary-note-edit{position:absolute;right:7px;top:7px;width:27px;height:27px;border-radius:8px;background:transparent;color:var(--muted,#aaa0a5);font-size:17px;line-height:27px;text-align:center;padding:0}
      .diary-note-edit:hover{background:rgba(236,146,173,.10);color:var(--accent,#ec92ad)}
      body[data-mode="work"] .diary-note-edit:hover{background:rgba(128,169,215,.12)}
      @media(max-width:800px){
        .diary-note-wrap{margin-top:10px;padding-top:10px}
        .diary-note-input{min-height:50px;max-height:96px;font-size:16px;padding:10px 11px}
        .diary-note-head strong{font-size:13px}.diary-note-head span{font-size:11px}
        .diary-note-cancel,.diary-note-save{height:32px;padding:0 14px;font-size:12px}
        .diary-note-view{min-height:48px;padding:11px 40px 11px 11px}
        .diary-note-view-text{font-size:13px;line-height:1.5}
        .diary-note-edit{right:8px;top:8px;width:29px;height:29px;font-size:18px;line-height:29px}
      }
    `;
    document.head.appendChild(s);
  }

  function autoSize(input){
    if(!input)return;
    input.style.height='auto';
    input.style.height=Math.min(input.scrollHeight,96)+'px';
  }

  function ensureUI(){
    const box=document.querySelector('.mood-box');
    if(!box)return null;
    let wrap=box.querySelector('.diary-note-wrap');
    if(wrap)return wrap;

    wrap=document.createElement('div');
    wrap.className='diary-note-wrap';

    const head=document.createElement('div');head.className='diary-note-head';
    const title=document.createElement('strong');title.textContent='오늘 메모';
    const hint=document.createElement('span');hint.textContent='오늘 어땠는지 아무 말이나';
    head.append(title,hint);

    const editor=document.createElement('div');editor.className='diary-note-editor';
    const input=document.createElement('textarea');
    input.className='diary-note-input';input.maxLength=MAX_LEN;input.rows=2;
    input.placeholder='오늘은 어땠는지 가볍게 적어두기…';
    input.setAttribute('aria-label','오늘 메모');
    input.addEventListener('input',()=>{
      drafts[identity()]=input.value.slice(0,MAX_LEN);
      autoSize(input);
    });

    const actions=document.createElement('div');actions.className='diary-note-actions';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='diary-note-cancel';cancel.textContent='취소';
    const save=document.createElement('button');save.type='button';save.className='diary-note-save';save.textContent='저장';
    actions.append(cancel,save);editor.append(input,actions);

    const view=document.createElement('div');view.className='diary-note-view';view.hidden=true;
    const text=document.createElement('div');text.className='diary-note-view-text';
    const edit=document.createElement('button');edit.type='button';edit.className='diary-note-edit';edit.textContent='✎';edit.title='수정';edit.setAttribute('aria-label','메모 수정');
    view.append(text,edit);

    cancel.addEventListener('click',()=>{
      const id=identity();
      const saved=modeNotes()[selectedKey()]||'';
      delete drafts[id];
      if(saved){editingKey=null}else{editingKey=id}
      renderDiaryNote();
    });

    save.addEventListener('click',()=>{
      const id=identity();
      const key=selectedKey();if(!key)return;
      const notes=modeNotes();
      const value=(drafts[id]!==undefined?drafts[id]:input.value).slice(0,MAX_LEN);
      if(value.trim())notes[key]=value;
      else delete notes[key];
      delete drafts[id];
      saveDiaryLocal();
      if(typeof queueSave==='function')queueSave();
      editingKey=value.trim()?null:id;
      renderDiaryNote();
    });

    edit.addEventListener('click',()=>{
      const id=identity();
      const saved=modeNotes()[selectedKey()]||'';
      drafts[id]=saved;
      editingKey=id;
      renderDiaryNote();
      setTimeout(()=>{
        const el=wrap.querySelector('.diary-note-input');
        if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}
      },0);
    });

    wrap.append(head,editor,view);box.append(wrap);
    return wrap;
  }

  function renderDiaryNote(){
    ensureStyle();ensureNotes();
    const wrap=ensureUI();if(!wrap)return;

    const id=identity();
    const saved=modeNotes()[selectedKey()]||'';
    if(id!==lastRenderedKey){
      editingKey=saved?null:id;
      lastRenderedKey=id;
    }

    const editor=wrap.querySelector('.diary-note-editor');
    const view=wrap.querySelector('.diary-note-view');
    const input=wrap.querySelector('.diary-note-input');
    const text=wrap.querySelector('.diary-note-view-text');
    const title=wrap.querySelector('.diary-note-head strong');
    const hint=wrap.querySelector('.diary-note-head span');
    const isEditing=editingKey===id||!saved;

    if(title)title.textContent=activeMode==='work'?'업무 메모':'오늘 메모';
    if(hint)hint.textContent=isEditing?'오늘 어땠는지 아무 말이나':'저장됨';

    editor.hidden=!isEditing;
    view.hidden=isEditing;

    if(isEditing){
      const value=drafts[id]!==undefined?drafts[id]:saved;
      if(document.activeElement!==input&&input.value!==value)input.value=value;
      autoSize(input);
    }else{
      text.textContent=saved;
    }

    saveDiaryLocal();
  }

  window.syncDiaryLocalFromState=function(){ensureNotes();saveDiaryLocal();};
  window.renderDiaryNote=renderDiaryNote;

  const previousRenderRating=typeof renderRating==='function'?renderRating:null;
  if(previousRenderRating){
    renderRating=function(){previousRenderRating();renderDiaryNote();};
  }

  const previousSaveCloud=typeof saveCloud==='function'?saveCloud:null;
  if(previousSaveCloud){
    saveCloud=async function(){ensureNotes();saveDiaryLocal();return await previousSaveCloud();};
  }

  ensureStyle();
  setTimeout(()=>{ensureNotes();renderDiaryNote();},150);
})();
