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

  function installStyle(){
    document.getElementById('diaryNoteStyle')?.remove();
    document.getElementById('diaryNoteStyleV2')?.remove();
    const s=document.createElement('style');
    s.id='diaryNoteStyleV2';
    s.textContent=`
      .diary-note-wrap{margin-top:7px;padding-top:7px;border-top:1px solid var(--line,#eee3e7)}
      .diary-note-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:5px}
      .diary-note-head strong{font-size:12px;font-weight:800;color:var(--ink,#504a4d)}
      .diary-note-head span{font-size:10px;color:var(--muted,#aaa0a5)}
      .diary-note-editor[hidden],.diary-note-view[hidden]{display:none!important}
      .diary-note-editor{display:flex;align-items:flex-start;gap:7px;width:100%}
      .diary-note-input{display:block;flex:1 1 auto;min-width:0;width:auto;height:34px;min-height:34px;max-height:58px;resize:none;overflow-y:auto;box-sizing:border-box;border:0;border-radius:10px;background:#fff;padding:7px 10px;font:inherit;font-size:12px;line-height:1.4;color:var(--ink,#504a4d);outline:none;box-shadow:inset 0 0 0 1px rgba(232,214,220,.9);transition:box-shadow .15s,background .15s}
      .diary-note-input::placeholder{color:#c4b9be}
      .diary-note-input:focus{box-shadow:inset 0 0 0 1.5px var(--accent,#ec92ad)}
      body[data-mode="work"] .diary-note-input{box-shadow:inset 0 0 0 1px rgba(210,225,240,.95)}
      body[data-mode="work"] .diary-note-input:focus{box-shadow:inset 0 0 0 1.5px var(--accent,#80a9d7)}
      .diary-note-save,.diary-note-edit{border:0;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
      .diary-note-save{flex:0 0 auto;height:34px;min-width:45px;padding:0 12px;border-radius:10px;font-size:11px;font-weight:800;background:var(--accent,#ec92ad);color:#fff}
      .diary-note-view{position:relative;min-height:32px;box-sizing:border-box;border:0;border-radius:9px;background:linear-gradient(90deg,rgba(255,240,244,.68),rgba(255,250,252,.28));padding:6px 34px 6px 7px;box-shadow:none;cursor:text;transition:background .15s ease}
      .diary-note-view:hover{background:rgba(255,240,244,.82)}
      body[data-mode="work"] .diary-note-view{background:linear-gradient(90deg,rgba(237,245,255,.78),rgba(248,251,255,.28))}
      body[data-mode="work"] .diary-note-view:hover{background:rgba(237,245,255,.9)}
      .diary-note-view-text{white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.45;color:var(--ink,#504a4d)}
      .diary-note-edit{position:absolute;right:5px;top:50%;transform:translateY(-50%);width:26px;height:26px;border-radius:8px;background:transparent;color:var(--muted,#aaa0a5);font-size:15px;line-height:26px;text-align:center;padding:0}
      .diary-note-edit:hover{background:rgba(236,146,173,.10);color:var(--accent,#ec92ad)}
      body[data-mode="work"] .diary-note-edit:hover{background:rgba(128,169,215,.12)}
      @media(max-width:800px){
        .diary-note-wrap{margin-top:6px;padding-top:6px}
        .diary-note-editor{gap:7px}
        .diary-note-input{height:38px;min-height:38px;max-height:60px;font-size:16px;padding:7px 10px;border-radius:10px}
        .diary-note-head{margin-bottom:4px}
        .diary-note-save{height:38px;min-width:48px;padding:0 13px;font-size:11px;border-radius:10px}
        .diary-note-view{min-height:35px;padding:7px 35px 7px 7px}
        .diary-note-view-text{font-size:12.5px;line-height:1.42}
        .diary-note-edit{right:5px;width:27px;height:27px;font-size:16px;line-height:27px}
      }
    `;
    document.head.appendChild(s);
  }

  function autoSize(input){
    if(!input)return;
    const min=window.innerWidth<=800?38:34;
    const max=window.innerWidth<=800?60:58;
    input.style.height='auto';
    input.style.height=Math.max(min,Math.min(input.scrollHeight,max))+'px';
  }

  function beginEdit(wrap){
    const id=identity();
    const saved=modeNotes()[selectedKey()]||'';
    drafts[id]=saved;
    editingKey=id;
    renderDiaryNote();
    setTimeout(()=>{
      const el=wrap?.querySelector('.diary-note-input');
      if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}
    },0);
  }

  function buildUI(){
    const box=document.querySelector('.mood-box');
    if(!box)return null;
    box.querySelectorAll('.diary-note-wrap').forEach(el=>el.remove());

    const wrap=document.createElement('div');wrap.className='diary-note-wrap';
    const head=document.createElement('div');head.className='diary-note-head';
    const title=document.createElement('strong');title.textContent='오늘 메모';
    const hint=document.createElement('span');hint.textContent='오늘 어땠는지 아무 말이나';
    head.append(title,hint);

    const editor=document.createElement('div');editor.className='diary-note-editor';
    const input=document.createElement('textarea');
    input.className='diary-note-input';input.maxLength=MAX_LEN;input.rows=1;
    input.placeholder='오늘은 어땠는지 가볍게 적어두기…';
    input.setAttribute('aria-label','오늘 메모');
    const save=document.createElement('button');save.type='button';save.className='diary-note-save';save.textContent='저장';
    editor.append(input,save);

    const view=document.createElement('div');view.className='diary-note-view';view.hidden=true;view.tabIndex=0;view.setAttribute('role','button');view.setAttribute('aria-label','메모 수정');
    const text=document.createElement('div');text.className='diary-note-view-text';
    const edit=document.createElement('button');edit.type='button';edit.className='diary-note-edit';edit.textContent='✎';edit.title='수정';edit.setAttribute('aria-label','메모 수정');
    view.append(text,edit);

    input.addEventListener('input',()=>{
      drafts[identity()]=input.value.slice(0,MAX_LEN);
      autoSize(input);
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

    view.addEventListener('click',e=>{
      if(e.target.closest('.diary-note-edit'))return;
      beginEdit(wrap);
    });
    view.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();beginEdit(wrap)}
    });
    edit.addEventListener('click',e=>{e.stopPropagation();beginEdit(wrap)});

    wrap.append(head,editor,view);
    box.append(wrap);
    return wrap;
  }

  function ensureUI(){
    const box=document.querySelector('.mood-box');
    if(!box)return null;
    return box.querySelector('.diary-note-wrap')||buildUI();
  }

  function renderDiaryNote(){
    ensureNotes();
    const wrap=ensureUI();if(!wrap)return;
    const id=identity();
    const saved=modeNotes()[selectedKey()]||'';
    if(id!==lastRenderedKey){editingKey=saved?null:id;lastRenderedKey=id}

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
    }else{text.textContent=saved}

    saveDiaryLocal();
  }

  window.syncDiaryLocalFromState=function(){ensureNotes();saveDiaryLocal();};
  window.renderDiaryNote=renderDiaryNote;

  const previousRenderRating=typeof renderRating==='function'?renderRating:null;
  if(previousRenderRating){
    renderRating=function(){previousRenderRating();renderDiaryNote()};
  }

  const previousSaveCloud=typeof saveCloud==='function'?saveCloud:null;
  if(previousSaveCloud){
    saveCloud=async function(){ensureNotes();saveDiaryLocal();return await previousSaveCloud()};
  }

  installStyle();
  setTimeout(()=>{ensureNotes();buildUI();renderDiaryNote()},120);
})();
