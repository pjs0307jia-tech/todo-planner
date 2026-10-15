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
    const count=width<600?26:38;
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
      // Imperative animations remain visible even when site-wide motion CSS suppresses keyframes.
      // The old CSS animationend cleanup could otherwise remove particles immediately.
      if(typeof clover.animate==='function'){
        clover.style.setProperty('animation','none','important');
        try {
          const travel=gentle?-2:-75;
          const frames=gentle?[
            {opacity:0,transform:'translate(-50%,-50%) scale(.8)',offset:0},
            {opacity:1,transform:'translate(-50%,-50%) scale(1.08)',offset:.2},
            {opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.73},
            {opacity:0,transform:'translate(-50%,-50%) scale(1)',offset:1}
          ]:[
            {opacity:0,transform:'translate(-50%,-50%) scale(.1) rotate(-25deg)',offset:0},
            {opacity:1,transform:'translate(-50%,-50%) scale(1.35) rotate(10deg)',offset:.14},
            {opacity:1,transform:'translate(-50%,-50%) scale(.9) rotate(-5deg)',offset:.27},
            {opacity:1,transform:'translate(-50%,-50%) scale(1.06) rotate(3deg)',offset:.4},
            {opacity:1,transform:'translate(-50%,-50%) translateY(-20px) scale(1) rotate(var(--tilt))',offset:.7},
            {opacity:0,transform:'translate(-50%,-50%) translateY(-75px) scale(.7) rotate(var(--tilt))',offset:1}
          ];
          clover.animate(frames,{duration:life,delay:delay,fill:'both',easing:'cubic-bezier(.2,.7,.3,1)'});
        } catch(error) {
          clover.style.setProperty('animation','clover-pop '+life+'ms ease-out '+delay+'ms both','important');
        }
      } else {
        clover.style.setProperty('animation','clover-pop '+life+'ms ease-out '+delay+'ms both','important');
      }
      // Cleanup also works in browsers that suppress CSS animation events.
      setTimeout(()=>clover.remove(),life+delay+200);
    }
  });
})();
