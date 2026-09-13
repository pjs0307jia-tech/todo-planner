(function(){
  const META='app-build';
  const CHECK_MS=30000;
  let switching=false;

  function currentBuild(){return document.querySelector(`meta[name="${META}"]`)?.content||''}
  function hasPending(){
    try{
      if(typeof window.todoMainAckPending==='function'&&window.todoMainAckPending())return true;
      if(typeof window.todoVaultOutboxPending==='function'&&window.todoVaultOutboxPending())return true;
      if(typeof window.plannerSyncPending==='function'&&window.plannerSyncPending())return true;
    }catch{}
    return false;
  }
  async function flushPending(){
    try{if(typeof window.todoMainAckFlush==='function')await window.todoMainAckFlush()}catch{}
    try{if(typeof window.todoVaultFlushOutbox==='function')await window.todoVaultFlushOutbox()}catch{}
    try{if(typeof window.plannerSyncPending==='function'&&window.plannerSyncPending()&&typeof saveCloud==='function')await saveCloud()}catch{}
  }
  async function check(){
    if(switching||document.visibilityState==='hidden')return;
    try{
      const res=await fetch(`./index.html?build_check=${Date.now()}`,{cache:'no-store'});
      if(!res.ok)return;
      const html=await res.text();
      const m=html.match(/<meta\s+name=["']app-build["']\s+content=["']([^"']+)["']/i);
      const latest=m?.[1]||'';
      if(!latest||latest===currentBuild())return;
      switching=true;
      await flushPending();
      if(hasPending()){
        switching=false;
        setTimeout(check,2500);
        return;
      }
      location.replace(`${location.pathname}?build=${encodeURIComponent(latest)}${location.hash||''}`);
    }catch{}
  }

  window.addEventListener('focus',()=>setTimeout(check,300));
  window.addEventListener('online',()=>setTimeout(check,300));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(check,300)});
  setInterval(check,CHECK_MS);
  setTimeout(check,2500);
})();