const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const {webcrypto}=require('node:crypto');
const {chromium}=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));
const clone=x=>JSON.parse(JSON.stringify(x));
const tables={planner_state:[],planner_todo_items:[],planner_state_history:[]};
class Query{
  constructor(table){this.table=table;this.filters=[];this.action='select';this.single=false;this.returning=false;}
  select(){this.returning=true;return this;}eq(k,v){this.filters.push(x=>x[k]===v);return this;}
  is(k,v){this.filters.push(x=>(x[k]??null)===v);return this;}lte(k,v){this.filters.push(x=>x[k]<=v);return this;}
  in(k,vs){this.filters.push(x=>vs.includes(x[k]));return this;}order(){return this;}range(a,b){this.rangeArgs=[a,b];return this;}
  maybeSingle(){this.single=true;return this;}insert(data){this.action='insert';this.data=data;return this;}
  update(data){this.action='update';this.data=data;return this;}upsert(data){this.action='upsert';this.data=data;return this;}
  delete(){this.action='delete';return this;}
  then(resolve,reject){return Promise.resolve().then(()=>{
    let rows=tables[this.table],found=rows.filter(x=>this.filters.every(f=>f(x)));
    if(this.rangeArgs)found=found.slice(this.rangeArgs[0],this.rangeArgs[1]+1);
    if(this.action==='insert'||this.action==='upsert'){
      found=[];
      for(const item of Array.isArray(this.data)?this.data:[this.data]){
        const exists=rows.find(x=>x.owner_hash===item.owner_hash&&(this.table==='planner_state'||this.table==='planner_todo_items'&&x.todo_id===item.todo_id));
        if(exists&&this.action==='insert')return {data:null,error:{code:'23505'}};
        if(exists)Object.assign(exists,clone(item));else rows.push(clone(item));found.push(item);
      }
    }else if(this.action==='update'){found.forEach(x=>Object.assign(x,clone(this.data)));}
    else if(this.action==='delete'){tables[this.table]=rows.filter(x=>!found.includes(x));}
    return {data:clone(this.single?found[0]||null:found),error:null};
  }).then(resolve,reject);}
}
let handler;
const context=vm.createContext({crypto:webcrypto,TextEncoder,Response,structuredClone,console,
 createClient:()=>({from:t=>new Query(t)}),Deno:{env:{get:k=>k==='SUPABASE_SERVICE_ROLE_KEY'?'test':undefined},serve:fn=>handler=fn}});
const source=fs.readFileSync('supabase/functions/planner-sync/index.ts','utf8').replace(/^import .*\n/,'');
vm.runInContext(stripTypeScriptTypes(source,{mode:'strip'}),context);
async function api(body){const res=await handler(new Request('https://test',{method:'POST',body:JSON.stringify(body)}));return {status:res.status,body:await res.json()};}
const code='984760129853';
const today='2026-10-15';
const initial={version:3,todos:{job:{[today]:[{id:'a',text:'테스트 할 일',status:'pending',done:false,_itemUpdatedAt:'2026-10-14T00:00:00Z'}]},work:{}},moods:{job:{[today]:2},work:{}},notes:{job:{},work:{}},events:{},deadlines:[],workItems:[],_deletedTodoIds:[]};
async function main(){
  assert.equal((await api({code,action:'save',state:initial})).status,200);
  // Concurrent field writes and older snapshots must preserve both updates.
  let stamp='2026-10-16T00:00:00Z';
  await Promise.all([
    api({code,action:'patch',operations:[{field:'moods',mode:'job',key:today,value:4,mutation_at:stamp}]}),
    api({code,action:'patch',operations:[{field:'notes',mode:'job',key:today,value:'new note',mutation_at:stamp}]})
  ]);
  await api({code,action:'save',state:initial});
  let remote=(await api({code,action:'load'})).body.state;
  assert.equal(remote.moods.job[today],4);assert.equal(remote.notes.job[today],'new note');
  await api({code,action:'patch',operations:[{field:'moods',mode:'job',key:today,value:null,mutation_at:'2026-10-16T00:01:00Z'}]});
  await api({code,action:'patch',operations:[{field:'moods',mode:'job',key:today,value:1,mutation_at:stamp}]});
  assert.equal((await api({code,action:'load'})).body.state.moods.job[today],undefined);
  console.log('PASS server: concurrent fields, stale snapshots, explicit clear, old mutation');
  if(process.env.SYNC_RUNTIME_ONLY==='1'){await runtimeTests();return;}
  // Reset the isolated fake store to exercise the actual browser scripts.
  for(const table of Object.values(tables))table.length=0;
  await api({code,action:'save',state:initial});
  const browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({timezoneId:'Asia/Seoul'});
  let blocked=false,delayTodo=0,delayPatch=0,delayLoad=0;let loads=0,writes=0;const errors=[];
  await ctx.route('**/functions/v1/planner-sync',async route=>{
    if(blocked)return route.abort();
    const body=route.request().postDataJSON();
    if(body.code!==code)throw Error('Unexpected identity');
    if(body.action==='load')loads++;else writes++;
    const delay=body.action==='todo_upsert'?delayTodo:body.action==='patch'?delayPatch:body.action==='load'?delayLoad:0;
    // Capture load at request time to model a stale response arriving later.
    let result=body.action==='load'?await api(body):null;
    if(delay)await new Promise(r=>setTimeout(r,delay));
    result??=await api(body);
    await route.fulfill({status:result.status,contentType:'application/json',body:JSON.stringify(result.body)}).catch(()=>{});
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({code,initial})=>{
    if(!localStorage.getItem('testInitialized')){
      localStorage.setItem('testInitialized','1');localStorage.setItem('todoPlanner_activeCode',code);
      localStorage.setItem(`todoPlanner_v3_${code}`,JSON.stringify(initial));
      localStorage.setItem('todoPlanner_cloud_paused','1');
    }
  },{code,initial});
  await page.goto('http://127.0.0.1:8765');
  await page.waitForFunction(()=>window.plannerBootReady);
  await page.evaluate(()=>{selected=new Date('2026-10-15T00:00:00');renderAll()});
  await page.waitForFunction(()=>!window.plannerSyncPending()&&!window.todoMainAckPending());
  assert.equal(await page.evaluate(()=>localStorage.getItem('todoPlanner_cloud_paused')),null);
  console.log('PASS browser: upgrade resumes local-only state');
  delayTodo=450;
  await page.locator('#todoList .check').first().click();
  await page.waitForTimeout(100);
  await page.locator('#todoList .check').first().click();
  await page.waitForTimeout(80);
  await page.locator('#todoList .check').first().click();
  await page.waitForFunction(()=>!window.todoMainAckPending()&&!window.plannerSyncPending());
  assert.equal(await page.evaluate(()=>state.todos.job['2026-10-15'][0].status),'skipped');
  assert.equal((await api({code,action:'load'})).body.state.todos.job[today][0].status,'skipped');
  console.log('PASS browser: late ACK cannot erase newer rapid status changes');
  delayTodo=0;delayPatch=450;
  await page.locator('#rating button').nth(3).click();await page.waitForTimeout(100);
  await page.locator('#rating button').nth(4).click();
  await page.waitForFunction(()=>!window.plannerSyncPending());
  assert.equal((await api({code,action:'load'})).body.state.moods.job[today],5);
  await page.locator('#rating button').nth(4).click();
  await page.waitForFunction(()=>!window.plannerSyncPending());
  await page.evaluate(()=>window.todoPullLatest(true));
  assert.equal(await page.evaluate(()=>state.moods.job['2026-10-15']),undefined);
  console.log('PASS browser: heart rapid updates and clearing survive cloud pull');
  delayPatch=0;delayLoad=600;
  const pull=page.evaluate(()=>window.todoPullLatest(true));
  await page.waitForTimeout(120);
  await page.locator('#rating button').nth(2).click();
  await pull;await page.waitForFunction(()=>!window.plannerSyncPending());
  assert.equal(await page.evaluate(()=>state.moods.job['2026-10-15']),3);
  console.log('PASS browser: stale pull cannot repaint a newer edit');
  delayLoad=0;blocked=true;
  await page.locator('#todoInput').fill('오프라인 저장 테스트');await page.locator('#todoForm').evaluate(form=>form.requestSubmit());
  await page.locator('#rating button').nth(0).click();
  await page.reload();await page.waitForFunction(()=>window.plannerBootReady);
  await page.evaluate(()=>{selected=new Date('2026-10-15T00:00:00');renderAll()});
  assert.equal(await page.locator('#todoList .todo-text').last().textContent(),'오프라인 저장 테스트');
  assert.equal(await page.evaluate(()=>state.moods.job['2026-10-15']),1);
  blocked=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.waitForFunction(()=>!window.plannerSyncPending()&&!window.todoMainAckPending(),{},{timeout:20000});
  await page.reload();await page.waitForFunction(()=>window.plannerBootReady);
  await page.evaluate(()=>{selected=new Date('2026-10-15T00:00:00');renderAll()});
  assert.equal(await page.locator('#todoList .todo-text').last().textContent(),'오프라인 저장 테스트');
  assert.equal(await page.evaluate(()=>state.moods.job['2026-10-15']),1);
  console.log('PASS browser: offline edit, immediate reload, reconnect, second reload');
  await page.locator('#todoList .delete').last().click();
  await page.waitForFunction(()=>!window.plannerSyncPending()&&!window.todoMainAckPending());
  await page.reload();await page.waitForFunction(()=>window.plannerBootReady);
  assert.equal((await api({code,action:'load'})).body.state.todos.job[today].length,1);
  console.log('PASS browser: deletion persists without resurrection');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({pageErrors:errors,loads,writes,status:await page.locator('#storageNote').textContent()}));
  await browser.close();
}
async function runtimeTests(){
  for(const table of Object.values(tables))table.length=0;
  await api({code,action:'save',state:initial});
  const store=new Map();const session=new Map();let offline=false,delay=0,quota=Infinity,sessionBlocked=false;
  store.set('todoPlanner_activeCode',code);store.set(`todoPlanner_v3_${code}`,JSON.stringify(initial));
  store.set('todoPlanner_cloud_paused','1');
  const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>{
    if(map===session&&sessionBlocked)throw new DOMException('Storage disabled','SecurityError');
    v=String(v);const size=[...map].reduce((n,[key,value])=>n+key.length+value.length,0)-(map.has(k)?k.length+map.get(k).length:0)+k.length+v.length;
    if(map===store&&size>quota)throw new DOMException('Storage quota exceeded','QuotaExceededError');map.set(k,v);
  },removeItem:k=>map.delete(k)});
  const elements={storageNote:{textContent:''}};
  const timeouts=new Set();
  function boot(){
    const c=vm.createContext({console,crypto:webcrypto,Date,JSON,Promise,Set,Map,structuredClone,
      localStorage:storage(store),sessionStorage:storage(session),
      setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);timeouts.add(t);return t},clearTimeout,
      setInterval:()=>0,clearInterval:()=>{},
      document:{visibilityState:'visible',getElementById:id=>elements[id]||null,addEventListener:()=>{}},
      addEventListener:()=>{},CLOUD_READY:true,userCode:code,state:clone(JSON.parse(store.get(`todoPlanner_v3_${code}`))),
      storageKey:()=>`todoPlanner_v3_${code}`,normalize:x=>x,emptyState:()=>clone(initial),loadLocal:()=>{},saveLocal:()=>{},saveCloud:()=>{},queueSave:()=>{},setSyncStatus:()=>{},saveTimer:null,renderAll:()=>{},
      cloudRequest:async(action,extra={})=>{if(offline)throw Error('offline');if(delay)await new Promise(r=>setTimeout(r,delay));return (await api({code,action,...clone(extra)})).body;}
    });
    c.window=c;
    for(const file of ['storage-safety-v3.js','todo-main-ack-v3.js','todo-vault-outbox-v3.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
    vm.runInContext('plannerPrepareBoot();todoMigrateLegacyOutbox()',c);return c;
  }
  let c=boot();await c.saveCloud();assert.equal(store.get('todoPlanner_cloud_paused'),undefined);
  delay=70;
  const a={id:'race',text:'before',status:'done',done:true,_itemUpdatedAt:new Date().toISOString()};
  c.state.todos.job[today].push(a);c.todoMainAckEnqueueUpsert('job',today,a);const pending=c.todoMainAckFlush();
  await new Promise(r=>setTimeout(r,10));
  const b={...a,text:'after',status:'skipped',done:false,_itemUpdatedAt:new Date().toISOString()};
  c.state.todos.job[today][1]=b;c.todoMainAckEnqueueUpsert('job',today,b);await pending;
  assert.equal(c.state.todos.job[today][1].text,'after');assert.equal(c.todoMainAckPending(),false);
  assert.equal((await api({code,action:'load'})).body.state.todos.job[today].find(x=>x.id==='race').text,'after');
  console.log('PASS runtime: delayed ACK preserves later edit and latest status');
  c.state.moods.job[today]=4;c.queueSave();const saving=c.saveCloud();
  await new Promise(r=>setTimeout(r,15));c.state.moods.job[today]=5;c.queueSave();await saving;
  assert.equal((await api({code,action:'load'})).body.state.moods.job[today],5);
  delete c.state.moods.job[today];c.queueSave();await c.saveCloud();
  assert.equal((await api({code,action:'load'})).body.state.moods.job[today],undefined);
  console.log('PASS runtime: rapid hearts and explicit clear are acknowledged by revision');
  offline=true;delay=0;c.state.notes.job[today]='offline note';c.queueSave();await c.saveCloud();
  c.todoMainAckEnqueueUpsert('job',today,{id:'offline',text:'offline task',status:'pending',_itemUpdatedAt:new Date().toISOString()});
  c.saveLocal();for(const t of timeouts)clearTimeout(t);timeouts.clear();
  c=boot();const remote=(await api({code,action:'load'})).body.state;c.state=remote;c.plannerApplyPendingFields(c.state);c.todoMainAckApplyPending();
  assert.equal(c.state.notes.job[today],'offline note');assert.ok(c.state.todos.job[today].some(x=>x.id==='offline'));
  offline=false;await c.saveCloud();assert.equal(c.plannerSyncPending(),false);assert.equal(c.todoMainAckPending(),false);
  assert.equal((await api({code,action:'load'})).body.state.notes.job[today],'offline note');
  console.log('PASS runtime: offline queue survives reload and flushes after reconnect');
  c.todoMainAckEnqueueOrder('job',today,['offline','race','a']);await c.todoMainAckFlush();
  assert.deepEqual((await api({code,action:'load'})).body.state.todos.job[today].map(x=>x.id),['offline','race','a']);
  c.todoMainAckEnqueueDelete('race');await c.todoMainAckFlush();
  await api({code,action:'todo_upsert',mode:'job',date:today,todo:b,client_updated_at:b._itemUpdatedAt});
  assert.equal((await api({code,action:'load'})).body.state.todos.job[today].some(x=>x.id==='race'),false);
  console.log('PASS runtime: reorder and delete survive stale writes');
  for(const t of timeouts)clearTimeout(t);timeouts.clear();
  // Reproduce an established browser full of the former 30 whole-state backups.
  const historyKey=`todoPlanner_local_history_${code}`;
  store.set(historyKey,JSON.stringify(Array.from({length:30},()=>({state:clone(c.state),padding:'x'.repeat(10000)}))));
  quota=[...store].reduce((n,[k,v])=>n+k.length+v.length,0);
  c=boot();c.plannerAcceptBaseline(c.state);
  let rendered=false;c.state.moods.job[today]=3;
  assert.doesNotThrow(()=>{c.queueSave();rendered=true},'full storage must not interrupt the heart click before render');
  assert.equal(rendered,true);
  const checked={...c.state.todos.job[today][0],status:'done',done:true,_itemUpdatedAt:new Date().toISOString()};
  assert.doesNotThrow(()=>{c.todoMainAckEnqueueUpsert('job',today,checked);c.queueSave()});
  assert.equal(c.todoMainAckPending(),true);
  assert.ok(JSON.parse(store.get(historyKey)).length<=2);
  await c.saveCloud();
  assert.equal((await api({code,action:'load'})).body.state.moods.job[today],3);
  assert.equal((await api({code,action:'load'})).body.state.todos.job[today].find(x=>x.id===checked.id).status,'done');
  console.log('PASS runtime: full browser storage does not block heart/check clicks or server saves');
  // No reclaimable space: secondary storage must retain the unacknowledged edit
  // across a reload, then retire it only after the server acknowledges it.
  quota=0;offline=true;
  c.state.moods.job[today]=1;c.queueSave();
  c.todoMainAckEnqueueUpsert('job',today,{...checked,status:'skipped',done:false,_itemUpdatedAt:new Date().toISOString()});
  for(const t of timeouts)clearTimeout(t);timeouts.clear();
  c=boot();c.state=(await api({code,action:'load'})).body.state;c.plannerApplyPendingFields(c.state);c.todoMainAckApplyPending();
  assert.equal(c.state.moods.job[today],1);
  assert.equal(c.state.todos.job[today].find(x=>x.id===checked.id).status,'skipped');
  offline=false;await c.saveCloud();
  assert.equal(c.plannerSyncPending(),false);assert.equal(c.todoMainAckPending(),false);
  assert.equal((await api({code,action:'load'})).body.state.moods.job[today],1);
  assert.equal((await api({code,action:'load'})).body.state.todos.job[today].find(x=>x.id===checked.id).status,'skipped');
  console.log('PASS runtime: secondary storage preserves pending heart/check edits across reload');
  sessionBlocked=true;offline=true;c.crypto={};
  assert.doesNotThrow(()=>{c.state.moods.job[today]=2;c.queueSave()});
  assert.ok(c.plannerSyncPending());assert.ok(elements.storageNote.textContent.includes('이 창을 열어 주세요'));
  offline=false;await c.saveCloud();assert.equal(c.plannerSyncPending(),false);
  assert.equal((await api({code,action:'load'})).body.state.moods.job[today],2);
  console.log('PASS runtime: denied storage and older crypto APIs do not interrupt clicks or network saves');
  for(const t of timeouts)clearTimeout(t);
}
main().catch(e=>{console.error(e);process.exit(1)});
