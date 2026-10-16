(function(){
  const button=document.getElementById('luckyClover');
  if(!button)return;

  // Decorative only: never read or modify planner data.
  document.querySelectorAll('.luck-note').forEach(node=>node.remove());
  const layer=document.createElement('div');
  layer.className='luck-effects';
  layer.setAttribute('aria-hidden','true');
  document.body.append(layer);

  // Separate, device-local daily counter: never writes to to-do or cloud storage.
  const countNode=document.getElementById('luckyCountValue');
  const countKey='todoPlanner_lucky_clicks_v1';
  const localDate=()=>{
    const now=new Date();
    return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  };
  let currentDate=localDate();
  let clicks=0;
  const displayCount=()=>{
    if(countNode)countNode.textContent=clicks.toLocaleString('ko-KR');
  };
  const readCount=()=>{
    const today=localDate();
    if(currentDate!==today){currentDate=today;clicks=0;}
    try{
      const saved=JSON.parse(localStorage.getItem(countKey)||'null');
      clicks=saved?.date===today&&Number.isSafeInteger(saved.count)&&saved.count>=0?saved.count:0;
    }catch{
      // Keep this session's number if browser storage isn't available.
    }
    displayCount();
  };
  const countOneClick=()=>{
    const today=localDate();
    if(currentDate!==today)readCount();
    try{
      const saved=JSON.parse(localStorage.getItem(countKey)||'null');
      if(saved?.date===today&&Number.isSafeInteger(saved.count)&&saved.count>clicks)clicks=saved.count;
    }catch{}
    clicks++;
    currentDate=today;
    try{localStorage.setItem(countKey,JSON.stringify({date:today,count:clicks}));}catch{}
    displayCount();
  };
  readCount();
  window.addEventListener('storage',event=>{if(event.key===countKey)readCount();});
  window.addEventListener('focus',readCount);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)readCount();});
  setInterval(()=>{if(currentDate!==localDate())readCount();},30000);

  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const random=(min,max)=>min+Math.random()*(max-min);
  const sizeFor=(mobile)=>{
    const chance=Math.random();
    if(chance<.30)return mobile?random(18,28):random(22,34);
    if(chance<.76)return mobile?random(30,46):random(37,55);
    return mobile?random(50,69):random(59,83);
  };

  button.addEventListener('click',()=>{
    countOneClick();
    const rect=button.getBoundingClientRect();
    const width=window.innerWidth;
    const height=window.innerHeight;
    const mobile=width<600;
    const gentle=reduceMotion.matches;
    const count=gentle?12:(mobile?26:36);

    // Bound total particles when the user taps several times in a row.
    while(layer.children.length>100-count)layer.firstElementChild.remove();

    for(let i=0;i<count;i++){
      const clover=document.createElement('span');
      clover.className='luck-particle';
      clover.textContent='🍀';
      const size=sizeFor(mobile);
      const nearButton=i<6||gentle;
      const x=nearButton
        ?rect.left+rect.width/2+random(-110,110)
        :width*random(.07,.93);
      const y=nearButton
        ?rect.bottom+random(18,150)
        :height*random(.14,.79);
      const safeX=Math.max(size*.55,Math.min(width-size*.55,x));
      const safeY=Math.max(size*.55,Math.min(height-size*.55,y));
      const delay=i<3?random(0,70):random(80,650);
      const life=gentle?random(1300,1800):random(2450,3850);
      const drift=gentle?0:random(-75,75);
      const rise=gentle?0:random(45,118);
      const tilt=gentle?0:random(-32,32);

      clover.style.cssText=`left:${safeX}px;top:${safeY}px;font-size:${size}px;--delay:${delay}ms;--life:${life}ms;--drift:${drift}px;--up:${-rise}px;--tilt:${tilt}deg;`;
      layer.appendChild(clover);

      // Keep animation consistent even when the rest of the app overrides CSS animations.
      if(typeof clover.animate==='function'){
        try{
          clover.style.setProperty('animation','none','important');
          const at=(dx,dy,scale,rotation)=>`translate(-50%,-50%) translate(${dx}px,${dy}px) scale(${scale}) rotate(${rotation}deg)`;
          const frames=gentle?[
            {offset:0,opacity:0,transform:at(0,0,.86,0)},
            {offset:.23,opacity:1,transform:at(0,0,1.06,0)},
            {offset:.56,opacity:.85,transform:at(0,0,1,0)},
            {offset:.78,opacity:.38,transform:at(0,0,.95,0)},
            {offset:1,opacity:0,transform:at(0,0,.9,0)}
          ]:[
            {offset:0,opacity:0,transform:at(0,0,.15,-18)},
            {offset:.15,opacity:1,transform:at(drift*.06,-8,1.26,8)},
            {offset:.28,opacity:1,transform:at(drift*.15,-18,.95,-5)},
            {offset:.43,opacity:.98,transform:at(drift*.30,-rise*.32,1.04,tilt*.25)},
            {offset:.58,opacity:.89,transform:at(drift*.50,-rise*.53,1,tilt*.5)},
            {offset:.75,opacity:.52,transform:at(drift*.78,-rise*.8,.92,tilt*.82)},
            {offset:.9,opacity:.20,transform:at(drift*.94,-rise*.94,.83,tilt*.95)},
            {offset:1,opacity:0,transform:at(drift,-rise,.74,tilt)}
          ];
          clover.animate(frames,{duration:life,delay,fill:'both',easing:'ease-out'});
        }catch(error){
          clover.style.setProperty('animation',`clover-float ${life}ms ease-out ${delay}ms both`,'important');
        }
      }

      setTimeout(()=>clover.remove(),life+delay+250);
    }
  });
})();
