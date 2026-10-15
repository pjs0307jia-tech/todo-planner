(function(){
  const button=document.getElementById('luckyClover');
  if(!button)return;
  const layer=document.createElement('div');
  layer.className='luck-effects';layer.setAttribute('aria-hidden','true');
  const note=document.createElement('div');
  note.className='luck-note';note.setAttribute('role','status');note.setAttribute('aria-live','polite');
  document.body.append(layer,note);
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const colors=['#79ac87','#a3c99a','#589b78','#b6d5a4','#8dbda5'];
  let noteTimer,bounce;

  button.addEventListener('click',()=>{
    const rect=button.getBoundingClientRect();
    const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    clearTimeout(noteTimer);
    note.style.left=`${Math.max(12,Math.min(window.innerWidth-190,rect.right-175))}px`;
    note.style.top=`${rect.bottom+12}px`;
    note.textContent='행운 충전 완료 🍀';note.classList.add('show');
    noteTimer=setTimeout(()=>{note.classList.remove('show');note.textContent=''},2200);
    if(reducedMotion.matches)return;
    bounce?.cancel();
    bounce=button.animate([
      {transform:'scale(1) rotate(0deg)'},
      {transform:'scale(.8) rotate(-18deg)',offset:.25},
      {transform:'scale(1.18) rotate(12deg)',offset:.6},
      {transform:'scale(1) rotate(0deg)'}
    ],{duration:450,easing:'ease-out'});
    // Bound the number of particles even when the button is tapped repeatedly.
    while(layer.children.length>40)layer.firstElementChild.remove();
    for(let i=0;i<24;i++){
      const particle=document.createElement('span');
      particle.className='luck-particle';
      const sparkle=i%5===0,size=sparkle?12+Math.random()*7:15+Math.random()*17;
      particle.style.cssText=`left:${x}px;top:${y}px;width:${size}px;height:${size}px;color:${sparkle?'#c6b57b':colors[i%colors.length]}`;
      if(sparkle)particle.textContent='✧';
      else particle.append(button.querySelector('svg').cloneNode(true));
      layer.append(particle);
      const dx=(Math.random()*window.innerWidth-x)*.85;
      const fall=Math.min(window.innerHeight*.65,440)*(0.5+Math.random()*.5);
      const turn=(Math.random()-.5)*360;
      const animation=particle.animate([
        {transform:'translate(-50%,-50%) scale(.1)',opacity:0},
        {transform:`translate(calc(-50% + ${dx*.2}px),-58px) scale(1.1) rotate(${turn*.2}deg)`,opacity:1,offset:.18},
        {transform:`translate(calc(-50% + ${dx*.65}px),${fall*.3}px) scale(1) rotate(${turn*.6}deg)`,opacity:1,offset:.55},
        {transform:`translate(calc(-50% + ${dx}px),${fall}px) scale(.55) rotate(${turn}deg)`,opacity:0}
      ],{duration:1500+Math.random()*800,delay:Math.random()*110,easing:'cubic-bezier(.2,.6,.4,1)',fill:'both'});
      animation.onfinish=()=>particle.remove();
      animation.oncancel=()=>particle.remove();
    }
  });
})();
