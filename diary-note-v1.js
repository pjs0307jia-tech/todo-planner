(function(){
  const MAX_LEN=400;
  let noteSaveTimer=null;

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
  function scheduleCloudSave(){
    if(!state)return;
    state._updatedAt=new Date().toISOString();
    if(typeof saveLocal==='function')saveLocal();
    clearTimeout(noteSaveTimer);
    noteSaveTimer=setTimeout(()=>{if(typeof queueSave==='function')queueSave();},500);
  }

  function ensureStyle(){
    if(document.getElementById('diaryNoteStyle'))return;
    const s=document.createElement('style');
    s.id='diaryNoteStyle';
    s.textContent=`
      .diary-note-wrap{margin-top:12px;padding-top:11px;border-top:1px solid var(--line,#eee3e7)}
      .diary-note-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px}
      .diary-note-head strong{font-size:12px;font-weight:800;color:var(--ink,#504a4d)}
      .diary-note-head span{font-size:10px;color:var(--muted,#aaa0a5)}
      .diary-note-input{display:block;width:100%;min-height:42px;max-height:92px;resize:none;overflow-y:auto;box-sizing:border-box;border:0;border-radius:10px;background:rgba(255,255,255,.62);padding:9px 10px;font:inherit;font-size:12px;line-height:1.45;color:var(--ink,#504a4d);outline:none;box-shadow:inset 0 0 0 1px rgba(232,214,220,.8);transition:box-shadow .15s,background .15s}
      .diary-note-input::placeholder{color:#c4b9be}
      .diary-note-input:focus{background:#fff;box-shadow:inset 0 0 0 1.5px var(--accent,#ec92ad)}
      body[data-mode="work"] .diary-note-input{box-shadow:inset 0 0 0 1px rgba(210,225,240,.9)}
      body[data-mode="work"] .diary-note-input:focus{box-shadow:inset 0 0 0 1.5px var(--accent,#80a9d7)}
      @media(max-width:800px){.diary-note-wrap{margin-top:10px;padding-top:10px}.diary-note-input{min-height:46px;max-height:88px;font-size:16px;padding:10px 11px}.diary-note-head strong{font-size:13px}.diary-note-head span{font-size:11px}}
    `;
    document.head.appendChild(s);
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
    const input=document.createElement('textarea');
    input.className='diary-note-input';input.maxLength=MAX_LEN;input.rows=2;
    input.placeholder='오늘은 어땠는지 가볍게 적어두기…';
    input.setAttribute('aria-label','오늘 메모');
    input.addEventListener('input',()=>{
      const notes=modeNotes();
      const key=selectedKey();if(!key)return;
      notes[key]=input.value.slice(0,MAX_LEN);
      saveDiaryLocal();
      scheduleCloudSave();
      autoSize(input);
    });
    input.addEventListener('blur',()=>{
      clearTimeout(noteSaveTimer);
      if(typeof queueSave==='function')queueSave();
    });
    head.append(title,hint);wrap.append(head,input);box.append(wrap);
    return wrap;
  }

  function autoSize(input){
    if(!input)return;
    input.style.height='auto';
    input.style.height=Math.min(input.scrollHeight,92)+'px';
  }
  function renderDiaryNote(){
    ensureStyle();ensureNotes();
    const wrap=ensureUI();if(!wrap)return;
    const input=wrap.querySelector('.diary-note-input');
    const value=modeNotes()[selectedKey()]||'';
    if(document.activeElement!==input||input.value!==value)input.value=value;
    const title=wrap.querySelector('.diary-note-head strong');
    if(title)title.textContent=activeMode==='work'?'업무 메모':'오늘 메모';
    autoSize(input);
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
