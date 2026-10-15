(function(){
  const button=document.getElementById('luckyClover');
  if(!button)return;
  // No toast, text or planner writes: this button only makes clovers pop.
  document.querySelectorAll('.luck-note').forEach(node=>node.remove());
  const layer=document.createElement('div');
  layer.className='luck-effects';layer.setAttribute('aria-hidden','true');
  document.body.append(layer);
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  button.addEventListener('click',()=>{
    const rect=button.getBoundingClientRect();
    const width=window.innerWidth,height=window.innerHeight;
    const gentle=reducedMotion.matches;
    const count=gentle?10:width<600?20:28;
    while(layer.children.length>60-count)layer.firstElementChild.remove();
    for(let i=0;i<count;i++){
      const clover=document.createElement('span');
      clover.className='luck-particle';clover.textContent='🍀';
      const size=(width<600?28:36)+Math.random()*22;
      // The first clovers pop beside the button; the rest bloom across the screen.
      const nearButton=i<4||gentle;
      const x=nearButton?rect.left+(Math.random()-.7)*240:width*(.08+Math.random()*.84);
      const y=nearButton?rect.bottom+28+Math.random()*160:height*(.15+Math.random()*.6);
      const delay=i<2?0:(i%4)*180+Math.random()*100;
      const life=gentle?1600:2800+Math.random()*400;
      clover.style.cssText=`left:${Math.max(size,Math.min(width-size,x))}px;top:${Math.max(size,Math.min(height-size,y))}px;font-size:${size}px;--delay:${delay}ms;--life:${life}ms;--tilt:${(Math.random()-.5)*30}deg`;
      layer.append(clover);
      clover.addEventListener('animationend',()=>clover.remove(),{once:true});
      // Cleanup also works in browsers that suppress CSS animation events.
      setTimeout(()=>clover.remove(),life+delay+200);
    }
  });
})();
