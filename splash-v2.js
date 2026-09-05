(function showStandaloneSplashV2(){
  const standalone=(window.navigator.standalone===true)||window.matchMedia('(display-mode: standalone)').matches;
  if(!standalone||document.getElementById('todoAppSplash'))return;

  const style=document.createElement('style');
  style.id='todoSplashStyleV2';
  style.textContent=`
    #todoAppSplash{
      position:fixed;inset:0;z-index:2147483647;
      display:flex;align-items:center;justify-content:center;
      padding:env(safe-area-inset-top) 24px env(safe-area-inset-bottom);
      background:#fffafd;
      opacity:1;visibility:visible;
      transition:opacity .28s ease,visibility .28s ease;
      -webkit-user-select:none;user-select:none;
      touch-action:none;
    }
    #todoAppSplash.splash-out{opacity:0;visibility:hidden;pointer-events:none}
    .todo-splash-inner{
      display:flex;align-items:center;justify-content:center;
      transform:translateY(-1.5vh);
    }
    .todo-splash-logo{
      width:min(58vw,230px);height:auto;display:block;
      filter:drop-shadow(0 10px 24px rgba(224,112,148,.07));
      animation:todoSplashFloat .72s ease-in-out infinite alternate;
    }
    @keyframes todoSplashFloat{from{transform:translateY(0)}to{transform:translateY(-3px)}}
    @media (prefers-reduced-motion:reduce){.todo-splash-logo{animation:none!important}}
  `;
  document.head.appendChild(style);

  const splash=document.createElement('div');
  splash.id='todoAppSplash';
  splash.setAttribute('role','status');
  splash.setAttribute('aria-label','TO-DO 시작 중');
  splash.innerHTML=`
    <div class="todo-splash-inner">
      <svg class="todo-splash-logo" viewBox="0 0 320 320" aria-hidden="true">
        <defs>
          <mask id="todoLogoMaskV2" maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="320">
            <rect width="320" height="320" fill="black"/>
            <path fill="white" d="M34 42Q34 31 45 31H126Q137 31 137 42V55Q137 66 126 66H103V137Q103 150 90 150H80Q67 150 67 137V66H45Q34 66 34 55Z"/>
            <path d="M226 139C214 126 158 92 158 57C158 35 175 23 193 23C207 23 219 30 226 42C234 30 246 23 260 23C279 23 296 36 296 57C296 92 239 126 226 139Z" fill="none" stroke="white" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
            <path fill="white" fill-rule="evenodd" d="M35 171H80C117 171 139 194 139 229C139 264 117 287 80 287H35Q27 287 27 279V179Q27 171 35 171ZM65 197V261H79C98 261 110 249 110 229C110 209 98 197 79 197Z"/>
            <circle cx="203" cy="229" r="55" fill="none" stroke="white" stroke-width="28"/>
            <rect x="277" y="171" width="25" height="78" rx="12.5" fill="white"/>
            <circle cx="289.5" cy="275" r="13" fill="white"/>
          </mask>
          <linearGradient id="todoWaterPinkV2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f59aba"/>
            <stop offset="1" stop-color="#e27da0"/>
          </linearGradient>
        </defs>

        <g fill="none" stroke="#eda0b8" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" opacity=".92">
          <path d="M34 42Q34 31 45 31H126Q137 31 137 42V55Q137 66 126 66H103V137Q103 150 90 150H80Q67 150 67 137V66H45Q34 66 34 55Z"/>
          <path d="M226 139C214 126 158 92 158 57C158 35 175 23 193 23C207 23 219 30 226 42C234 30 246 23 260 23C279 23 296 36 296 57C296 92 239 126 226 139Z"/>
          <path fill-rule="evenodd" d="M35 171H80C117 171 139 194 139 229C139 264 117 287 80 287H35Q27 287 27 279V179Q27 171 35 171ZM65 197V261H79C98 261 110 249 110 229C110 209 98 197 79 197Z"/>
          <circle cx="203" cy="229" r="55"/>
          <circle cx="203" cy="229" r="41"/>
          <rect x="277" y="171" width="25" height="78" rx="12.5"/>
          <circle cx="289.5" cy="275" r="13"/>
        </g>

        <g mask="url(#todoLogoMaskV2)">
          <g transform="translate(0 285)">
            <animateTransform attributeName="transform" type="translate" from="0 285" to="0 -105" dur="1.28s" begin="0s" fill="freeze" calcMode="spline" keySplines=".32 0 .18 1"/>
            <g>
              <animateTransform attributeName="transform" type="translate" values="-55 0;10 0;-55 0" dur=".58s" repeatCount="indefinite"/>
              <path fill="url(#todoWaterPinkV2)" d="M-100 90C-55 68-18 112 28 90S110 68 156 90S238 112 284 90S366 68 412 90V480H-100Z"/>
            </g>
          </g>
        </g>
      </svg>
    </div>`;
  document.body.appendChild(splash);

  let finished=false;
  const finish=()=>{
    if(finished)return;
    finished=true;
    splash.classList.add('splash-out');
    setTimeout(()=>{
      splash.remove();
      style.remove();
    },300);
  };

  const started=performance.now();
  const finishAfterMinimum=()=>{
    const wait=Math.max(0,1450-(performance.now()-started));
    setTimeout(finish,wait);
  };
  if(document.readyState==='complete')finishAfterMinimum();
  else window.addEventListener('load',finishAfterMinimum,{once:true});
  setTimeout(finish,2200);
})();
