(function(){
 const original=window.fetch.bind(window);let blocked=false,blockedUntil=0;
 window.fetch=async function(input,init){
  const url=typeof input==='string'?input:input?.url||String(input);
  if(!url.startsWith('https://empbjojdpmeaottpesdt.supabase.co/functions/v1/planner-sync'))return original(input,init);
  if(Date.now()<blockedUntil)throw Error('Cloud sync temporarily unavailable; records are saved in this browser.');
  const response=await original(input,init);
  if(response.status===402){blocked=true;blockedUntil=Date.now()+60000;showBanner()}
  else if(response.ok){blocked=false;blockedUntil=0;localStorage.removeItem('todoPlanner_cloud_paused');document.getElementById('recoveryNotice')?.remove()}
  return response;
 };
 function showBanner(){
  if(!document.body||document.getElementById('recoveryNotice'))return;
  const box=document.createElement('div');box.id='recoveryNotice';box.style.cssText='position:relative;z-index:1000;padding:12px 18px;background:#fff0f5;color:#70334a;font:14px/1.6 system-ui;text-align:center';
  const text=document.createElement('span');text.textContent='현재 이 브라우저에 저장 중이에요. 다른 기기와는 동기화되지 않아요. ';box.append(text);
  const exportBtn=document.createElement('button');exportBtn.textContent='기록 백업';exportBtn.style.margin='0 8px';
  exportBtn.onclick=()=>{const code=localStorage.getItem('todoPlanner_activeCode');const raw=localStorage.getItem('todoPlanner_v3_'+code);if(!raw)return;const blob=new Blob([JSON.stringify({state:JSON.parse(raw)})],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='todo_backup_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};box.append(exportBtn);
  const link=document.createElement('a');link.href='./recover.html';link.textContent='백업에서 복구';box.append(link);document.body.prepend(box);
 }
 document.addEventListener('DOMContentLoaded',()=>{if(blocked||localStorage.getItem('todoPlanner_cloud_paused')==='1')showBanner()});
})();
