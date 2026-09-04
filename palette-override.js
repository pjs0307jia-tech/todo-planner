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

activeColor=normalizeAltColor(activeColor);
renderAll();
