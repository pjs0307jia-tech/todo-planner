(function showStandaloneSplash(){
  const standalone=(window.navigator.standalone===true)||window.matchMedia('(display-mode: standalone)').matches;
  if(!standalone||document.getElementById('todoAppSplash'))return;

  const style=document.createElement('style');
  style.id='todoSplashStyle';
  style.textContent=`
    #todoAppSplash{
      position:fixed;inset:0;z-index:2147483647;
      display:flex;align-items:center;justify-content:center;
      padding:env(safe-area-inset-top) 24px env(safe-area-inset-bottom);
      background:#fffafd;
      opacity:1;visibility:visible;
      transition:opacity .42s ease,visibility .42s ease;
      -webkit-user-select:none;user-select:none;
      touch-action:none;
    }
    #todoAppSplash.splash-out{opacity:0;visibility:hidden;pointer-events:none}
    .todo-splash-inner{
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      transform:translateY(-2vh);
    }
    .todo-splash-logo{
      width:min(58vw,230px);height:auto;display:block;
      filter:drop-shadow(0 10px 24px rgba(224,112,148,.08));
      animation:todoSplashFloat .95s ease-in-out infinite alternate;
    }
    .todo-splash-loading{
      margin-top:22px;color:#d87998;font-size:13px;font-weight:700;
      letter-spacing:.02em;opacity:.8;
      animation:todoSplashBreath .9s ease-in-out infinite alternate;
    }
    .todo-splash-dots{display:inline-block;min-width:18px;text-align:left}
    .todo-splash-dots::after{content:'~';animation:todoSplashDots 1.05s steps(1,end) infinite}
    @keyframes todoSplashFloat{from{transform:translateY(0)}to{transform:translateY(-4px)}}
    @keyframes todoSplashBreath{from{opacity:.48}to{opacity:.95}}
    @keyframes todoSplashDots{0%{content:'~'}33%{content:'~~'}66%{content:'~~~'}}
    @media (prefers-reduced-motion:reduce){
      .todo-splash-logo,.todo-splash-loading{animation:none!important}
    }
  `;
  document.head.appendChild(style);

  const splash=document.createElement('div');
  splash.id='todoAppSplash';
  splash.setAttribute('role','status');
  splash.setAttribute('aria-label','TO-DO 로딩 중');
  splash.innerHTML=`
    <div class="todo-splash-inner">
      <svg class="todo-splash-logo" viewBox="0 0 320 320" aria-hidden="true">
        <defs>
          <mask id="todoLogoMask" maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="320">
            <rect width="320" height="320" fill="black"/>
            <!-- T -->
            <path fill="white" d="M34 42Q34 31 45 31H126Q137 31 137 42V55Q137 66 126 66H103V137Q103 150 90 150H80Q67 150 67 137V66H45Q34 66 34 55Z"/>
            <!-- heart O -->
            <path d="M226 139C214 126 158 92 158 57C158 35 175 23 193 23C207 23 219 30 226 42C234 30 246 23 260 23C279 23 296 36 296 57C296 92 239 126 226 139Z" fill="none" stroke="white" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
            <!-- D -->
            <path fill="white" fill-rule="evenodd" d="M35 171H80C117 171 139 194 139 229C139 264 117 287 80 287H35Q27 287 27 279V179Q27 171 35 171ZM65 197V261H79C98 261 110 249 110 229C110 209 98 197 79 197Z"/>
            <!-- O -->
            <circle cx="203" cy="229" r="55" fill="none" stroke="white" stroke-width="28"/>
            <!-- ! -->
            <rect x="277" y="171" width="25" height="78" rx="12.5" fill="white"/>
            <circle cx="289.5" cy="275" r="13" fill="white"/>
          </mask>
          <linearGradient id="todoWaterPink" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f59aba"/>
            <stop offset="1" stop-color="#e27da0"/>
          </linearGradient>
        </defs>

        <!-- soft empty outline -->
        <g fill="none" stroke="#eda0b8" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" opacity=".92">
          <path d="M34 42Q34 31 45 31H126Q137 31 137 42V55Q137 66 126 66H103V137Q103 150 90 150H80Q67 150 67 137V66H45Q34 66 34 55Z"/>
          <path d="M226 139C214 126 158 92 158 57C158 35 175 23 193 23C207 23 219 30 226 42C234 30 246 23 260 23C279 23 296 36 296 57C296 92 239 126 226 139Z"/>
          <path fill-rule="evenodd" d="M35 171H80C117 171 139 194 139 229C139 264 117 287 80 287H35Q27 287 27 279V179Q27 171 35 171ZM65 197V261H79C98 261 110 249 110 229C110 209 98 197 79 197Z"/>
          <circle cx="203" cy="229" r="55"/>
          <circle cx="203" cy="229" r="41"/>
          <rect x="277" y="171" width="25" height="78" rx="12.5"/>
          <circle cx="289.5" cy="275" r="13"/>
        </g>

        <!-- rising wavy pink fill, clipped to logo -->
        <g mask="url(#todoLogoMask)">
          <g>
            <animateTransform attributeName="transform" type="translate" from="0 285" to="0 -105" dur="1.75s" begin="0.08s" fill="freeze" calcMode="spline" keySplines=".32 0 .18 1"/>
            <g>
              <animateTransform attributeName="transform" type="translate" values="-55 0;10 0;-55 0" dur=".72s" repeatCount="indefinite"/>
              <path fill="url(#todoWaterPink)" d="M-100 90C-55 68-18 112 28 90S110 68 156 90S238 112 284 90S366 68 412 90V480H-100Z"/>
            </g>
          </g>
        </g>
      </svg>
      <div class="todo-splash-loading">로딩중<span class="todo-splash-dots"></span></div>
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
    },460);
  };

  const started=performance.now();
  const finishAfterMinimum=()=>{
    const wait=Math.max(0,1950-(performance.now()-started));
    setTimeout(finish,wait);
  };
  if(document.readyState==='complete')finishAfterMinimum();
  else window.addEventListener('load',finishAfterMinimum,{once:true});
  setTimeout(finish,3300);
})();

const ALT_PALETTES={
  job:[
    {id:'1',hex:'#fde8ef',label:'연분홍'},
    {id:'2',hex:'#f4b9cd',label:'중간 분홍'},
    {id:'3',hex:'#df6f97',label:'진분홍'},
    {id:'4',hex:'#ececef',label:'밝은 회색'},
    {id:'5',hex:'#666a72',label:'어두운 회색'}
  ],
  work:[
    {id:'1',hex:'#eaf4ff',label:'연파랑'},
    {id:'2',hex:'#b9d7f7',label:'중간 파랑'},
    {id:'3',hex:'#5f98d9',label:'진파랑'},
    {id:'4',hex:'#eceff3',label:'밝은 회색'},
    {id:'5',hex:'#606874',label:'어두운 회색'}
  ]
};

function normalizeAltColor(id){
  const legacy={pink:'1',peach:'2',yellow:'3',mint:'4',lilac:'5'};
  const key=String(legacy[id]||id||'1');
  return ['1','2','3','4','5'].includes(key)?key:'1';
}
function altPalette(){return ALT_PALETTES[activeMode]||ALT_PALETTES.job}

colorHex=function(id){
  const key=normalizeAltColor(id);
  return altPalette().find(c=>c.id===key)?.hex||altPalette()[0].hex;
};

renderPalette=function(){
  const p=$('palette');
  p.innerHTML='';
  const current=normalizeAltColor(activeColor);
  altPalette().forEach(c=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='color-btn'+(c.id===current?' on':'');
    b.style.background=c.hex;
    b.title=c.label;
    b.setAttribute('aria-label',c.label);
    b.onclick=()=>{activeColor=c.id;renderPalette()};
    p.append(b);
  });
};

function setReadableEventText(){
  document.querySelectorAll('.event-chip,.event-item').forEach(el=>{
    const rgb=getComputedStyle(el).backgroundColor.match(/\d+(?:\.\d+)?/g);
    if(!rgb||rgb.length<3)return;
    const [r,g,b]=rgb.slice(0,3).map(Number);
    const luminance=(0.299*r+0.587*g+0.114*b)/255;
    const text=luminance<0.67?'#ffffff':'#565056';
    el.style.color=text;
    const x=el.querySelector('button');
    if(x)x.style.color=luminance<0.67?'rgba(255,255,255,.88)':'#716a70';
  });
}

const _renderCalendarPalette=renderCalendar;
renderCalendar=function(){_renderCalendarPalette();setReadableEventText()};
const _renderEventsPalette=renderEvents;
renderEvents=function(){_renderEventsPalette();setReadableEventText()};

function forceHeartFavicon(){
  const href='favicon-heart.svg?v=20260905-2';
  document.querySelectorAll('link[rel~="icon"],link[rel="shortcut icon"]').forEach(el=>el.remove());
  const icon=document.createElement('link');
  icon.rel='icon';
  icon.type='image/svg+xml';
  icon.href=href;
  document.head.appendChild(icon);
  const shortcut=document.createElement('link');
  shortcut.rel='shortcut icon';
  shortcut.href=href;
  document.head.appendChild(shortcut);
}

function lockTodoPanelToCalendar(){
  const calendar=document.querySelector('.calendar-card');
  const side=document.querySelector('.side');
  const list=document.querySelector('.side .todo-list');
  if(!calendar||!side||!list)return;
  if(window.innerWidth<=800){
    side.style.height='';
    side.style.maxHeight='';
    list.style.overflowY='';
    return;
  }
  const h=Math.round(calendar.getBoundingClientRect().height);
  side.style.height=h+'px';
  side.style.maxHeight=h+'px';
  side.style.minHeight='0';
  side.style.display='flex';
  side.style.flexDirection='column';
  side.style.overflow='hidden';
  list.style.flex='1 1 auto';
  list.style.minHeight='0';
  list.style.overflowY='auto';
  list.style.overscrollBehavior='contain';
}

function bootUiFixes(){
  forceHeartFavicon();
  lockTodoPanelToCalendar();
  window.addEventListener('resize',lockTodoPanelToCalendar);
  const calendar=document.querySelector('.calendar-card');
  if(calendar&&'ResizeObserver' in window){
    new ResizeObserver(lockTodoPanelToCalendar).observe(calendar);
  }
  const list=document.querySelector('.side .todo-list');
  if(list&&'MutationObserver' in window){
    new MutationObserver(lockTodoPanelToCalendar).observe(list,{childList:true,subtree:true});
  }
}

activeColor=normalizeAltColor(activeColor);
renderAll();
setTimeout(bootUiFixes,0);
