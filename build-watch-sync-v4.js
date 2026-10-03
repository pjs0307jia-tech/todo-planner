(function(){
  const META='app-build';
  const CHECK_MS=30000;
  let switching=false;

  function currentBuild(){return document.querySelector(`meta[name="${META}"]`)?.content||''}
  function assetFingerprint(root=document){
    try{
      return Array.from(root.querySelectorAll('script[src],link[rel="stylesheet"][href]'))
        .map(el=>el.getAttribute('src')||el.getAttribute('href')||'')
        .filter(Boolean)
        .join('|');
    }catch{return ''}
  }
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
      const parsed=new DOMParser().parseFromString(html,'text/html');
      const latest=parsed.querySelector(`meta[name="${META}"]`)?.content||'';
      const latestAssets=assetFingerprint(parsed);
      const buildChanged=Boolean(latest&&latest!==currentBuild());
      const assetsChanged=Boolean(latestAssets&&latestAssets!==assetFingerprint(document));
      if(!buildChanged&&!assetsChanged)return;
      switching=true;
      await flushPending();
      if(hasPending()){
        switching=false;
        setTimeout(check,2500);
        return;
      }
      const token=latest||String(Date.now());
      location.replace(`${location.pathname}?build=${encodeURIComponent(token)}&asset_refresh=${Date.now()}${location.hash||''}`);
    }catch{}
  }

  window.addEventListener('focus',()=>setTimeout(check,300));
  window.addEventListener('online',()=>setTimeout(check,300));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(check,300)});
  setInterval(check,CHECK_MS);
  setTimeout(check,2500);
})();