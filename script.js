const RAWG_KEY='7b07ac5d0ea74c20afe3e8140e91136e';
const TMDB_KEY='edf0b286a5711a735d44a37f595109fa';

(function(){
'use strict';
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const pad=n=>String(n).padStart(2,'0');
const todayISO=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
const fmtDate=iso=>{if(!iso)return '';const d=new Date(iso+'T00:00:00');return isNaN(d)?'':d.toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'});};
function relTime(ts){
  const s=(Date.now()-ts)/1000;
  if(s<60)return 'agora';
  if(s<3600)return 'há '+Math.floor(s/60)+' min';
  if(s<86400)return 'há '+Math.floor(s/3600)+' h';
  const d=Math.floor(s/86400);
  if(d===1)return 'ontem';
  if(d<30)return 'há '+d+' dias';
  return new Date(ts).toLocaleDateString('pt-BR',{day:'numeric',month:'short',year:'numeric'});
}
function initials(n){const p=String(n||'').trim().split(/\s+/).filter(Boolean);return ((p[0]||'?')[0]+(p[1]?p[1][0]:'')).toUpperCase();}
function hexRgb(h){h=String(h||'#888888').replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16);return [(n>>16)&255,(n>>8)&255,n&255];}
function lum(h){const [r,g,b]=hexRgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*r+.7152*g+.0722*b;}
const onColor=h=>lum(h)>0.36?'#0b0d14':'#ffffff';
const ROM={ii:'2',iii:'3',iv:'4',v:'5',vi:'6',vii:'7',viii:'8',ix:'9',x:'10'};
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean).map(w=>ROM[w]||w).join(' ');
const STAT={want:'Na lista',doing:'Em andamento',done:'Concluído'};
const SWATCHES=['#3aa8f0','#ff6b6b','#ffb02e','#37d39a','#b388ff','#ff7ac6','#5ce1e6','#a3e635'];
let S=null, tab='perfil', filt={q:'',status:'all',sort:'recent'}, draft=null, confirmCb=null, lastFocus=null;
let saveT=null, warned=false, toastT=null, memPick=0;
const hostTheme=document.documentElement.getAttribute('data-theme');
const profileDefaults=()=>({name:'Seu nome',tag:'@seunome',status:'Montando meu cantinho',bio:'Escreva aqui quem você é, o que curte e o que quiser deixar à vista.',avatar:'',banner:'',accent:'#3aa8f0',theme:'auto',since:Date.now()});
function makeState(withExamples){
  const now=Date.now(),day=864e5;
  const cj=uid(),cf=uid(),cs=uid(),cd=uid();
  const s={v:1,profile:profileDefaults(),
    collections:[{id:cj,name:'Jogos',color:'#4cc2ff',kind:'game'},{id:cf,name:'Filmes',color:'#ff8a5c',kind:'movie'},{id:cs,name:'Séries',color:'#b58cff',kind:'tv'},{id:cd,name:'Desenhos',color:'#4fd6a0',kind:'anim'}],
    items:[],photos:[],memories:[],friends:[]};
  if(withExamples){
    const mk=(col,title,rating,status,fav,k)=>({id:uid(),col,title,cover:'',rating,status,note:'',fav,added:now-k*day*0.8,ex:true});
    s.items=[
      mk(cj,'Hollow Knight',5,'done',true,6),mk(cj,'Celeste',5,'done',true,5),mk(cj,'Minecraft',4,'doing',false,4),mk(cj,'Hades',0,'want',false,3),
      mk(cf,'Interestelar',5,'done',true,7),mk(cf,'Homem-Aranha: Através do Aranhaverso',4,'done',false,2),mk(cf,'Duna: Parte Dois',0,'want',false,1),
      mk(cs,'Breaking Bad',5,'done',true,9),mk(cs,'Stranger Things',4,'doing',false,8),
      mk(cd,'Hora de Aventura',5,'done',true,10),mk(cd,'Gravity Falls',5,'done',false,11),mk(cd,'Steven Universo',3,'want',false,12)
    ];
    s.memories=[{id:uid(),title:'A madrugada em que zeramos o jogo',date:todayISO(),text:'Escreva aqui o que você quer lembrar: onde foi, quem estava junto, o que rolou de engraçado.',pic:'',added:now-day*0.5,ex:true}];
    s.friends=[{id:uid(),name:'Amigo de exemplo',nick:'Fulano',bday:'',fav:'Jogos de plataforma e anime',note:'Troque por um amigo seu e conte como vocês se conheceram.',avatar:'',added:now-day*0.3,ex:true}];
  }
  return s;
}
const guessKind=n=>/^jogos?$/i.test(n)?'game':/^filmes?$/i.test(n)?'movie':/^s[eé]ries?$/i.test(n)?'tv':/^desenhos?|anima/i.test(n)?'anim':'';
function normalize(o){
  const s={v:1,profile:Object.assign(profileDefaults(),o&&o.profile||{})};
  ['collections','items','photos','memories','friends'].forEach(k=>{s[k]=Array.isArray(o&&o[k])?o[k]:[];});
  if(!s.collections.length)s.collections=makeState(false).collections;
  s.collections.forEach(c=>{if(c.kind===undefined)c.kind=c.game?'game':guessKind(c.name);delete c.game;});
  return s;
}
const real=a=>a.filter(x=>!x.ex);
let dbp=null;
function idbOpen(){return new Promise((res,rej)=>{try{const r=indexedDB.open('meu-hub',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error('blocked'));}catch(e){rej(e);}});}
const getDb=()=>dbp||(dbp=idbOpen());
async function idbGet(k){const d=await getDb();return new Promise((res,rej)=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});}
async function idbSet(k,v){const d=await getDb();return new Promise((res,rej)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);});}
function save(){
  clearTimeout(saveT);
  saveT=setTimeout(async()=>{
    try{await idbSet('hub',S);}
    catch(e){if(!warned){warned=true;toast('Não consegui salvar neste navegador. Exporte um backup em Ajustes.');}}
  },350);
}
const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))]);
const SPEC={cover:{w:360,h:480,mode:'cover'},avatar:{w:256,h:256,mode:'cover'},banner:{w:1400,h:420,mode:'cover'},pic:{w:1000,h:1000,mode:'fit'},photo:{w:1600,h:1600,mode:'fit',q:.84},shot:{w:1600,h:1600,mode:'fit',q:.82}};
function loadImage(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=fr.result;};fr.onerror=rej;fr.readAsDataURL(file);});}
async function shrink(file,sp){return render(await loadImage(file),sp);}
function render(im,sp){
  let cw,ch,sx=0,sy=0,sw=im.width,sh=im.height;
  if(sp.mode==='cover'){
    cw=sp.w;ch=sp.h;const r=sp.w/sp.h,ir=im.width/im.height;
    if(ir>r){sw=im.height*r;sx=(im.width-sw)/2;}else{sh=im.width/r;sy=(im.height-sh)/2;}
  }else{
    const k=Math.min(1,sp.w/im.width,sp.h/im.height);cw=Math.round(im.width*k);ch=Math.round(im.height*k);
  }
  const c=document.createElement('canvas');c.width=cw;c.height=ch;
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,cw,ch);x.drawImage(im,sx,sy,sw,sh,0,0,cw,ch);
  return c.toDataURL('image/jpeg',sp.q||.82);
}
let acList=[],acT=null,acCtl=null,acSrc='game';
const gameCache=new Map();
const kindOf=id=>{const c=colOf(id);return c?(c.kind||''):'';};
const keyOf=k=>k==='game'?RAWG_KEY:TMDB_KEY;
const kindSel=v=>[['','Sem busca'],['game','Jogos'],['movie','Filmes'],['tv','Séries'],['anim','Desenhos']].map(k=>`<option value="${k[0]}"${v===k[0]?' selected':''}>${k[1]}</option>`).join('');
async function searchMedia(kind,q){
  const k=kind+'|'+norm(q);
  if(gameCache.has(k))return gameCache.get(k);
  if(acCtl)acCtl.abort();
  acCtl=new AbortController();
  let list;
  if(kind==='game'){
    const r=await fetch('https://api.rawg.io/api/games?key='+RAWG_KEY+'&page_size=6&search='+encodeURIComponent(q.trim()),{signal:acCtl.signal});
    if(!r.ok)throw new Error('rawg');
    const j=await r.json();
    list=(j.results||[]).map(g=>({id:g.id,key:'game:'+g.id,name:g.name,img:g.background_image||'',year:g.released?g.released.slice(0,4):''}));
  }else{
    const ep=kind==='movie'?'movie':kind==='tv'?'tv':'multi';
    const r=await fetch('https://api.themoviedb.org/3/search/'+ep+'?api_key='+TMDB_KEY+'&language=pt-BR&include_adult=false&query='+encodeURIComponent(q.trim()),{signal:acCtl.signal});
    if(!r.ok)throw new Error('tmdb');
    const j=await r.json();
    list=(j.results||[]).filter(g=>ep!=='multi'||g.media_type==='movie'||g.media_type==='tv').slice(0,6).map(g=>{
      const mt=ep==='multi'?g.media_type:ep;
      const d=g.release_date||g.first_air_date||'';
      return {id:g.id,key:mt+':'+g.id,name:g.title||g.name||'',img:g.poster_path?'https://image.tmdb.org/t/p/w342'+g.poster_path:'',year:d.slice(0,4)};
    });
  }
  gameCache.set(k,list);
  return list;
}
function coverFromUrl(u){
  return new Promise(res=>{
    const im=new Image();im.crossOrigin='anonymous';
    im.onload=()=>{try{res(render(im,SPEC.cover));}catch(e){res(u);}};
    im.onerror=()=>res(u);
    im.src=u;
  });
}
function drawAc(list,msg){
  const box=$('#ac');if(!box)return;
  if(!list&&!msg){box.hidden=true;box.innerHTML='';return;}
  const body=list?list.map(g=>`<button type="button" class="ac-it" data-act="pick-game" data-gid="${esc(g.key)}"><span class="ac-img">${g.img?`<img src="${esc(g.img)}" alt="" loading="lazy">`:''}</span><span><b>${esc(g.name)}</b><small>${esc(g.year)}</small></span></button>`).join(''):`<div class="ac-msg">${esc(msg)}</div>`;
  box.innerHTML=body+(acSrc==='game'?'<div class="ac-foot">Dados: <a href="https://rawg.io" target="_blank" rel="noopener">RAWG</a></div>':'<div class="ac-foot">Dados: <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a></div>');
  box.hidden=false;
}
function onTitleInput(t){
  if(draft){draft.gameId=null;draft.year='';}
  clearTimeout(acT);
  const q=t.value.trim();
  const kind=kindOf(t.form.elements.col.value);
  if(!kind||q.length<2){drawAc();return;}
  acSrc=kind==='game'?'game':'tmdb';
  if(!keyOf(kind)){drawAc(null,kind==='game'?'Coloque sua chave da RAWG no topo do script.js para buscar jogos.':'Coloque sua chave do TMDB no topo do script.js para buscar filmes, séries e desenhos.');return;}
  acT=setTimeout(async()=>{
    drawAc(null,'Buscando…');
    try{
      const l=await searchMedia(kind,q);
      if(t.value.trim()!==q)return;
      acList=l;
      drawAc(l.length?l:null,l.length?'':'Nenhum resultado encontrado. Dá pra salvar com o nome digitado.');
    }catch(e){if(e.name!=='AbortError')drawAc(null,'Não consegui buscar agora. Dá pra salvar com o nome digitado.');}
  },350);
}
async function pickGame(gid){
  const g=acList.find(x=>x.key===gid);if(!g||!draft)return;
  const f=$('form[data-form="item"]');if(!f)return;
  const dup=S.items.find(i=>i.id!==draft.id&&(i.gameId===g.key||(g.key.indexOf('game:')===0&&i.gameId===g.id)));
  f.elements.title.value=g.name;
  Object.assign(draft,{title:g.name,gameId:g.key,year:g.year});
  drawAc();
  if(dup)toast('Você já tem este título guardado.');
  if(g.img){
    const url=await coverFromUrl(g.img);
    if(draft&&draft.gameId===g.key){draft.cover=url;setPreview('cover',url);}
  }
}
async function autoMatch(d,kind){
  try{
    const l=await withTimeout(searchMedia(kind,d.title),3000);
    const g=l[0];
    if(g&&norm(g.name)===norm(d.title)){
      d.title=g.name;d.gameId=g.key;d.year=g.year;
      if(!d.cover&&g.img)d.cover=await withTimeout(coverFromUrl(g.img),4000);
    }
  }catch(e){}
}
const shotsInner=a=>(a||[]).map(x=>`<div class="shot"><button type="button" class="shot-img" data-act="view-shot" data-id="${x.id}" aria-label="Ver print"><img src="${x.src}" alt=""></button><button type="button" class="shot-x" data-act="del-shot" data-id="${x.id}" aria-label="Remover print">×</button></div>`).join('');
function lightbox(src){
  const d=document.createElement('div');d.className='lb';
  d.innerHTML=`<img src="${src}" alt="">`;
  d.onclick=()=>d.remove();
  document.body.appendChild(d);
}
function applyTheme(){
  const r=document.documentElement,p=S.profile;
  r.style.setProperty('--accent',p.accent);
  r.style.setProperty('--on-accent',onColor(p.accent));
  if(p.theme==='light'||p.theme==='dark')r.setAttribute('data-theme',p.theme);
  else if(hostTheme)r.setAttribute('data-theme',hostTheme);
  else r.removeAttribute('data-theme');
}
function toast(msg){
  const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true;},2800);
}
function levelInfo(){
  const xp=real(S.items).length*10+real(S.photos).length*5+real(S.memories).length*15+real(S.friends).length*10;
  const lvl=1+Math.floor(Math.sqrt(xp/25));
  const cur=25*(lvl-1)*(lvl-1),next=25*lvl*lvl;
  return {xp,lvl,next,pct:(xp-cur)/(next-cur)};
}
function badgeDefs(){
  const it=real(S.items);
  return [
    {n:1,name:'Primeiro item',desc:'Guarde um item em qualquer coleção',v:it.length},
    {n:25,name:'Colecionador',desc:'Guarde 25 itens',v:it.length},
    {n:100,name:'Biblioteca',desc:'Guarde 100 itens',v:it.length},
    {n:10,name:'Crítico',desc:'Dê nota a 10 itens',v:it.filter(i=>i.rating>0).length},
    {n:5,name:'Vitrine',desc:'Favorite 5 itens',v:it.filter(i=>i.fav).length},
    {n:10,name:'Fotógrafo',desc:'Guarde 10 fotos',v:real(S.photos).length},
    {n:5,name:'Memória boa',desc:'Escreva 5 memórias',v:real(S.memories).length},
    {n:5,name:'Turma',desc:'Adicione 5 amigos',v:real(S.friends).length},
    {n:3,name:'De tudo um pouco',desc:'Use 3 coleções diferentes',v:S.collections.filter(c=>it.some(i=>i.col===c.id)).length}
  ];
}
function daysToBday(iso){
  if(!iso||iso.length<10)return null;
  const m=+iso.slice(5,7),d=+iso.slice(8,10);if(!m||!d)return null;
  const t=new Date(),t0=new Date(t.getFullYear(),t.getMonth(),t.getDate());
  let n=new Date(t.getFullYear(),m-1,d);if(n<t0)n=new Date(t.getFullYear()+1,m-1,d);
  return Math.round((n-t0)/864e5);
}
const colOf=id=>S.collections.find(c=>c.id===id);
const colName=id=>(colOf(id)||{name:'Sem coleção'}).name;
function renderAll(){applyTheme();renderHero();renderTabs();renderView();}
function renderHero(){
  const p=S.profile,L=levelInfo(),compact=tab!=='perfil';
  const h=$('#hero');h.className='hero'+(compact?' compact':'');
  h.innerHTML=`
    <div class="banner"${p.banner?` style="background-image:url('${p.banner}')"`:''}></div>
    <div class="hero-row">
      <div class="avatar">${p.avatar?`<img src="${p.avatar}" alt="">`:`<span>${esc(initials(p.name))}</span>`}</div>
      <div class="who"><h1>${esc(p.name)}</h1>
        <div class="sub"><span>${esc(p.tag)}</span>${p.status?`<span class="dot"></span><span>${esc(p.status)}</span>`:''}</div></div>
      <div class="lvl" title="${L.xp} pontos de experiência"><div class="lvl-n"><small>nível</small>${L.lvl}</div>
        <div class="bar"><i style="width:${Math.round(L.pct*100)}%"></i></div><small class="xp mono">${L.xp} / ${L.next} xp</small></div>
    </div>
    ${compact?'':`<p class="bio">${esc(p.bio)}</p>`}`;
}
function tabsList(){
  return [{id:'perfil',label:'Perfil'}]
    .concat(S.collections.map(c=>({id:'c:'+c.id,label:c.name,n:S.items.filter(i=>i.col===c.id).length})))
    .concat([{id:'fotos',label:'Fotos',n:S.photos.length},{id:'memorias',label:'Memórias',n:S.memories.length},{id:'amigos',label:'Amigos',n:S.friends.length},{id:'ajustes',label:'Ajustes'}]);
}
function renderTabs(){
  $('#tabs').innerHTML=tabsList().map(t=>`<button class="tab" data-act="go" data-tab="${esc(t.id)}"${t.id===tab?' aria-current="page"':''}>${esc(t.label)}${t.n!=null?`<span class="n">${t.n}</span>`:''}</button>`).join('');
}
function go(id){
  tab=id;filt={q:'',status:'all',sort:'recent'};renderHero();renderTabs();renderView();
  window.scrollTo({top:0});
}
function renderView(){
  if(tab==='perfil')viewHome();
  else if(tab==='fotos')viewPhotos();
  else if(tab==='memorias')viewMemories();
  else if(tab==='amigos')viewFriends();
  else if(tab==='ajustes')viewSettings();
  else if(tab.indexOf('c:')===0)viewCollection(tab.slice(2));
  else viewHome();
}
function coverHtml(it){
  const c=colOf(it.col),color=c?c.color:'#6b7390';
  return it.cover?`<img src="${it.cover}" alt="" loading="lazy">`:`<span class="tile" style="--tc:${esc(color)};--ton:${onColor(color)}">${esc(it.title)}</span>`;
}
function starsHtml(n){return n>0?`<span class="stars" aria-label="Nota ${n} de 5">${'★'.repeat(n)}<i>${'★'.repeat(5-n)}</i></span>`:'';}
function cardHtml(it){
  return `<article class="card">
    <div class="cover-wrap">
      <button class="cover" data-act="edit-item" data-id="${it.id}" aria-label="Abrir ${esc(it.title)}">${coverHtml(it)}</button>
      ${it.ex?'<span class="ex-tag">exemplo</span>':''}
      <button class="fav" data-act="fav" data-id="${it.id}" aria-pressed="${it.fav?'true':'false'}" aria-label="Favoritar ${esc(it.title)}">${it.fav?'★':'☆'}</button>
    </div>
    <button class="ctitle" data-act="edit-item" data-id="${it.id}">${esc(it.title)}</button>
    <div class="cmeta"><span class="pill ${it.status}">${STAT[it.status]||''}</span>${starsHtml(it.rating)}${it.shots&&it.shots.length?`<span class="pill">${it.shots.length} ${it.shots.length===1?'print':'prints'}</span>`:''}</div>
  </article>`;
}
function viewHome(){
  const exN=[].concat(S.items,S.photos,S.memories,S.friends).filter(x=>x.ex).length;
  const favs=S.items.filter(i=>i.fav).sort((a,b)=>b.added-a.added).slice(0,12);
  const feed=[];
  S.items.forEach(i=>feed.push({ts:i.added,html:`Adicionou <b>${esc(i.title)}</b> em ${esc(colName(i.col))}`,act:'edit-item',id:i.id}));
  S.photos.forEach(p=>feed.push({ts:p.added,html:'Guardou uma foto'+(p.caption?`: <b>${esc(p.caption)}</b>`:''),act:'open-photo',id:p.id}));
  S.memories.forEach(m=>feed.push({ts:m.added,html:`Nova memória: <b>${esc(m.title)}</b>`,act:'edit-mem',id:m.id}));
  S.friends.forEach(f=>feed.push({ts:f.added,html:`Adicionou <b>${esc(f.name)}</b> aos amigos`,act:'edit-friend',id:f.id}));
  feed.sort((a,b)=>b.ts-a.ts);
  const mems=S.memories;const mem=mems.length?mems[memPick%mems.length]:null;
  const bdays=S.friends.map(f=>({f,d:daysToBday(f.bday)})).filter(x=>x.d!==null&&x.d<=30).sort((a,b)=>a.d-b.d);
  const stats=S.collections.map(c=>`<button class="stat" data-act="go" data-tab="c:${c.id}"><b>${S.items.filter(i=>i.col===c.id).length}</b>${esc(c.name)}</button>`)
    .concat([`<button class="stat" data-act="go" data-tab="fotos"><b>${S.photos.length}</b>Fotos</button>`,`<button class="stat" data-act="go" data-tab="memorias"><b>${S.memories.length}</b>Memórias</button>`,`<button class="stat" data-act="go" data-tab="amigos"><b>${S.friends.length}</b>Amigos</button>`]).join('');
  const badges=badgeDefs().map(b=>{const ok=b.v>=b.n;return `<div class="badge${ok?'':' locked'}" title="${esc(b.desc)}"><div class="hex">${b.n}</div><span>${esc(b.name)}</span>${ok?'':`<small>${Math.min(b.v,b.n)}/${b.n}</small>`}</div>`;}).join('');
  $('#view').innerHTML=`
    ${exN?`<div class="notice"><p>Os itens marcados como <b>exemplo</b> estão aí só pra você ver como fica. Edite, troque ou apague quando quiser.</p><button class="btn" data-act="clear-examples">Apagar exemplos</button></div>`:''}
    <div class="stats">${stats}</div>
    <div class="cols">
      <div class="stack">
        <section class="panel"><h2>Vitrine</h2>
          ${favs.length?`<div class="shelf">${favs.map(it=>`<div class="mini"><button class="cover" data-act="edit-item" data-id="${it.id}" aria-label="Abrir ${esc(it.title)}">${coverHtml(it)}</button><button class="ctitle" data-act="edit-item" data-id="${it.id}">${esc(it.title)}</button></div>`).join('')}</div>`
          :`<div class="empty"><span>Toque na estrela de qualquer item pra ele aparecer aqui.</span></div>`}
        </section>
        <section class="panel"><h2>Atividade recente</h2>
          ${feed.length?`<ul class="feed">${feed.slice(0,8).map(f=>`<li><button data-act="${f.act}" data-id="${f.id}"><span>${f.html}</span><time>${relTime(f.ts)}</time></button></li>`).join('')}</ul>`
          :`<div class="empty"><span>Nada por aqui ainda. Adicione um jogo, uma foto ou uma memória.</span></div>`}
        </section>
      </div>
      <div class="stack">
        ${mem?`<section class="panel recall"><h2>Lembra disso?</h2>
          <div><div class="when">${esc(fmtDate(mem.date))}</div><h3>${esc(mem.title)}</h3></div>
          ${mem.text?`<q>${esc(mem.text)}</q>`:''}
          <div class="actions"><button class="btn" data-act="edit-mem" data-id="${mem.id}">Abrir</button>${mems.length>1?'<button class="btn ghost" data-act="other-mem">Outra memória</button>':''}</div></section>`:''}
        ${bdays.length?`<section class="panel"><h2>Aniversários chegando</h2>${bdays.map(x=>`<div class="bday"><span>${esc(x.f.nick||x.f.name)}</span><span class="muted mono">${x.d===0?'hoje':x.d===1?'amanhã':'em '+x.d+' dias'}</span></div>`).join('')}</section>`:''}
        <section class="panel"><h2>Conquistas</h2><div class="badges">${badges}</div></section>
      </div>
    </div>`;
}
function viewCollection(cid){
  const c=colOf(cid);if(!c){tab='perfil';renderAll();return;}
  $('#view').innerHTML=`
    <div class="head"><h2>${esc(c.name)}</h2><button class="btn primary" data-act="add-item" data-col="${c.id}">+ Adicionar</button></div>
    <div class="tools">
      <input id="q" type="search" placeholder="Buscar em ${esc(c.name)}" value="${esc(filt.q)}" aria-label="Buscar">
      <select id="fs" aria-label="Filtrar por status">
        <option value="all">Todos</option>${Object.keys(STAT).map(k=>`<option value="${k}"${filt.status===k?' selected':''}>${STAT[k]}</option>`).join('')}
        <option value="fav"${filt.status==='fav'?' selected':''}>Favoritos</option>
      </select>
      <select id="so" aria-label="Ordenar">
        <option value="recent">Mais recentes</option><option value="rating"${filt.sort==='rating'?' selected':''}>Melhor nota</option><option value="alpha"${filt.sort==='alpha'?' selected':''}>A–Z</option>
      </select>
    </div>
    <div id="grid"></div>`;
  drawGrid(c);
}
function drawGrid(c){
  let a=S.items.filter(i=>i.col===c.id);const total=a.length;
  const q=filt.q.trim().toLowerCase();
  if(q)a=a.filter(i=>(i.title+' '+(i.note||'')).toLowerCase().indexOf(q)>=0);
  if(filt.status==='fav')a=a.filter(i=>i.fav);else if(filt.status!=='all')a=a.filter(i=>i.status===filt.status);
  if(filt.sort==='rating')a.sort((x,y)=>y.rating-x.rating||y.added-x.added);
  else if(filt.sort==='alpha')a.sort((x,y)=>x.title.localeCompare(y.title,'pt-BR'));
  else a.sort((x,y)=>y.added-x.added);
  $('#grid').innerHTML=a.length?`<div class="grid">${a.map(cardHtml).join('')}</div>`
    :total?`<div class="empty"><span>Nenhum resultado com esse filtro.</span></div>`
    :`<div class="empty"><span><b>${esc(c.name)}</b> está vazio. Guarde o primeiro item.</span><button class="btn primary" data-act="add-item" data-col="${c.id}">+ Adicionar</button></div>`;
}
function curCollection(){return tab.indexOf('c:')===0?colOf(tab.slice(2)):null;}
function viewPhotos(){
  const a=S.photos.slice().sort((x,y)=>y.added-x.added);
  $('#view').innerHTML=`
    <div class="head"><h2>Fotos</h2><label class="btn primary">+ Adicionar fotos<input type="file" accept="image/*" multiple data-photos></label></div>
    ${a.length?`<div class="photos">${a.map(p=>`<button class="ph" data-act="open-photo" data-id="${p.id}" aria-label="Abrir foto${p.caption?': '+esc(p.caption):''}"><img src="${p.src}" alt="${esc(p.caption||'')}" loading="lazy">${p.caption?`<span>${esc(p.caption)}</span>`:''}</button>`).join('')}</div>`
    :`<div class="empty"><span><b>Nenhuma foto ainda.</b><br>Guarde prints, fotos de rolê, desenhos seus, o que quiser.</span></div>`}`;
}
function viewMemories(){
  const a=S.memories.slice().sort((x,y)=>(y.date||'').localeCompare(x.date||'')||y.added-x.added);
  $('#view').innerHTML=`
    <div class="head"><h2>Memórias</h2><button class="btn primary" data-act="add-mem">+ Nova memória</button></div>
    ${a.length?`<div class="list">${a.map(m=>`<button class="mem" data-act="edit-mem" data-id="${m.id}"><div><time>${esc(fmtDate(m.date))}${m.ex?' · exemplo':''}</time><h3>${esc(m.title)}</h3>${m.text?`<p>${esc(m.text)}</p>`:''}</div>${m.pic?`<img src="${m.pic}" alt="" loading="lazy">`:''}</button>`).join('')}</div>`
    :`<div class="empty"><span><b>Nenhuma memória ainda.</b><br>Escreva o que você não quer esquecer.</span><button class="btn primary" data-act="add-mem">+ Nova memória</button></div>`}`;
}
function viewFriends(){
  const a=S.friends.slice().sort((x,y)=>x.name.localeCompare(y.name,'pt-BR'));
  $('#view').innerHTML=`
    <div class="head"><h2>Amigos</h2><button class="btn primary" data-act="add-friend">+ Adicionar amigo</button></div>
    ${a.length?`<div class="friends">${a.map(f=>{const d=daysToBday(f.bday);return `<button class="friend" data-act="edit-friend" data-id="${f.id}">
      <div class="f-top"><div class="f-av">${f.avatar?`<img src="${f.avatar}" alt="" loading="lazy">`:esc(initials(f.name))}</div><div style="min-width:0"><b>${esc(f.name)}</b><small>${esc(f.nick||'')}${f.ex?' · exemplo':''}</small></div></div>
      ${f.fav?`<p class="fav-line"><b>Curte:</b> ${esc(f.fav)}</p>`:''}
      ${f.note?`<p>${esc(f.note)}</p>`:''}
      ${d!==null?`<span class="pill">${d===0?'Aniversário hoje':d<=30?'Aniversário em '+d+' d':'Aniversário '+esc(f.bday.slice(8,10)+'/'+f.bday.slice(5,7))}</span>`:''}
    </button>`;}).join('')}</div>`
    :`<div class="empty"><span><b>Nenhum amigo ainda.</b><br>Guarde quem importa, o que cada um curte e as histórias de vocês.</span><button class="btn primary" data-act="add-friend">+ Adicionar amigo</button></div>`}
    <p class="share-note">Quer que um amigo tenha o hub dele? Mande o link desta página. Cada pessoa começa com um hub só dela, salvo no próprio aparelho.</p>`;
}
function imgField(label,field,spec,target,url){
  return `<div class="field"><span class="lab">${label}</span><div class="imgrow"><div class="prev" id="prev-${field}">${prevInner(url)}</div>
    <div class="imgbtns"><label class="btn">Escolher imagem<input type="file" accept="image/*" data-img="${spec}" data-field="${field}" data-target="${target}"></label>
    <button type="button" class="btn ghost" data-act="clear-img" data-field="${field}" data-target="${target}">Remover</button></div></div></div>`;
}
const prevInner=url=>url?`<img src="${url}" alt="">`:'<span>Sem imagem</span>';
function setPreview(field,url){const el=$('#prev-'+field);if(el)el.innerHTML=prevInner(url);}
function viewSettings(){
  const p=S.profile;
  $('#view').innerHTML=`<div class="settings">
    <section class="sec"><h2>Perfil</h2><div class="form">
      <div class="row2">
        <label class="field"><span class="lab">Nome</span><input data-prof="name" value="${esc(p.name)}" maxlength="40"></label>
        <label class="field"><span class="lab">Usuário</span><input data-prof="tag" value="${esc(p.tag)}" maxlength="30"></label>
      </div>
      <label class="field"><span class="lab">Status</span><input data-prof="status" value="${esc(p.status)}" maxlength="80" placeholder="O que você está jogando ou assistindo?"></label>
      <label class="field"><span class="lab">Sobre mim</span><textarea data-prof="bio" rows="4" maxlength="400">${esc(p.bio)}</textarea></label>
      ${imgField('Foto de perfil','avatar','avatar','profile',p.avatar)}
      ${imgField('Banner','banner','banner','profile',p.banner)}
    </div></section>
    <section class="sec"><h2>Aparência</h2>
      <div class="field"><span class="lab">Cor de destaque</span>
        <div class="sw">${SWATCHES.map(c=>`<button style="--c:${c}" data-act="accent" data-color="${c}" aria-pressed="${p.accent.toLowerCase()===c?'true':'false'}" aria-label="Cor ${c}"></button>`).join('')}
        <input type="color" id="customaccent" value="${esc(p.accent)}" aria-label="Escolher outra cor"></div></div>
      <div class="field"><span class="lab">Tema</span>
        <div class="seg">${[['auto','Automático'],['light','Claro'],['dark','Escuro']].map(t=>`<button data-act="theme" data-theme-set="${t[0]}" aria-pressed="${p.theme===t[0]?'true':'false'}">${t[1]}</button>`).join('')}</div></div>
    </section>
    <section class="sec"><h2>Coleções</h2>
      <p class="note">Crie quantas quiser: livros, músicas, mangás, o que for. Apagar uma coleção apaga os itens dela. Escolha em cada coleção o tipo de busca automática de nome e capa: jogos, filmes, séries ou desenhos.</p>
      ${S.collections.map(c=>`<div class="crow"><input data-colname="${c.id}" value="${esc(c.name)}" maxlength="30" aria-label="Nome da coleção"><input type="color" data-colcolor="${c.id}" value="${esc(c.color)}" aria-label="Cor da coleção"><select data-colkind="${c.id}" aria-label="Tipo de busca">${kindSel(c.kind||'')}</select><button class="btn danger" data-act="del-col" data-id="${c.id}">Apagar</button></div>`).join('')}
      <div class="crow"><input id="newcol" placeholder="Nova coleção, ex: Livros" maxlength="30" aria-label="Nome da nova coleção"><input type="color" id="newcolor" value="#ffb02e" aria-label="Cor da nova coleção"><select id="newkind" aria-label="Tipo de busca">${kindSel('')}</select><button class="btn primary" data-act="add-col">Criar</button></div>
    </section>
    <section class="sec"><h2>Seus dados</h2>
      <p class="note">Tudo fica salvo neste navegador, neste aparelho. Se limpar os dados do navegador, o hub some. Exporte um backup de vez em quando e importe quando precisar.</p>
      <div class="actions"><button class="btn" data-act="export">Exportar backup</button>
        <label class="btn">Importar backup<input type="file" accept=".json,application/json" data-import></label>
        <button class="btn danger" data-act="wipe">Começar do zero</button></div>
    </section></div>`;
}
function openModal(html,focusSel){
  lastFocus=document.activeElement;
  $('#modal-body').innerHTML=html;$('#modal').hidden=false;document.body.classList.add('modal-open');
  if(focusSel){const f=$(focusSel,$('#modal-body'));if(f)f.focus();}
}
function closeModal(){
  $('#modal').hidden=true;$('#modal-body').innerHTML='';document.body.classList.remove('modal-open');draft=null;
  if(lastFocus&&lastFocus.focus&&document.contains(lastFocus))try{lastFocus.focus();}catch(e){}
}
function confirmModal(title,text,ok,cb){
  confirmCb=cb;
  openModal(`<h3 class="mh">${esc(title)}</h3><p class="muted" style="margin:0 0 16px">${esc(text)}</p>
    <div class="actions"><span class="sp"></span><button class="btn" data-act="close-modal">Cancelar</button><button class="btn danger-fill" data-act="confirm-ok">${esc(ok)}</button></div>`);
}
const fv=(f,n)=>f.elements[n].value;
function openItem(id,col){
  const it=id?S.items.find(i=>i.id===id):null;
  draft=it?Object.assign({},it):{id:uid(),col:col||S.collections[0].id,title:'',cover:'',rating:0,status:'want',note:'',fav:false,added:Date.now(),shots:[],gameId:null,year:''};
  draft.shots=(draft.shots||[]).slice();draft._new=!it;
  openModal(`<h3 class="mh">${it?'Editar item':'Novo item'}</h3>
    <form class="form" data-form="item">
      <div class="field"><span class="lab">Título</span><div class="ac"><input name="title" value="${esc(draft.title)}" maxlength="120" autocomplete="off" required><div class="ac-list" id="ac" hidden></div></div></div>
      <div class="row2">
        <label class="field"><span class="lab">Coleção</span><select name="col">${S.collections.map(c=>`<option value="${c.id}"${c.id===draft.col?' selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label class="field"><span class="lab">Status</span><select name="status">${Object.keys(STAT).map(k=>`<option value="${k}"${draft.status===k?' selected':''}>${STAT[k]}</option>`).join('')}</select></label>
      </div>
      <div class="field"><span class="lab">Nota</span><div class="rate" id="rate">${rateInner(draft.rating)}</div></div>
      ${imgField('Capa','cover','cover','draft',draft.cover)}
      <label class="field"><span class="lab">Anotação</span><textarea name="note" rows="5" maxlength="3000" placeholder="O que você achou? Onde parou?">${esc(draft.note||'')}</textarea></label>
      <div class="field"><span class="lab">Prints</span><div class="shots" id="shots">${shotsInner(draft.shots)}</div><div><label class="btn">+ Adicionar prints<input type="file" accept="image/*" multiple data-shots></label></div></div>
      <div class="actions">${it?'<button type="button" class="btn danger" data-act="del" data-kind="item" data-id="'+it.id+'">Apagar</button>':''}<span class="sp"></span><button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn primary">Salvar</button></div>
    </form>`,it?null:'input[name=title]');
}
function rateInner(n){return [1,2,3,4,5].map(i=>`<button type="button" class="${i<=n?'on':''}" data-act="star" data-n="${i}" aria-label="${i} de 5">★</button>`).join('');}
function openMem(id){
  const m=id?S.memories.find(x=>x.id===id):null;
  draft=m?Object.assign({},m):{id:uid(),title:'',date:todayISO(),text:'',pic:'',added:Date.now()};
  openModal(`<h3 class="mh">${m?'Editar memória':'Nova memória'}</h3>
    <form class="form" data-form="mem">
      <label class="field"><span class="lab">Título</span><input name="title" value="${esc(draft.title)}" maxlength="120" required></label>
      <label class="field"><span class="lab">Data</span><input type="date" name="date" value="${esc(draft.date)}"></label>
      <label class="field"><span class="lab">O que rolou</span><textarea name="text" rows="6" maxlength="4000" placeholder="Onde foi, quem estava, o que você quer lembrar.">${esc(draft.text||'')}</textarea></label>
      ${imgField('Foto','pic','pic','draft',draft.pic)}
      <div class="actions">${m?'<button type="button" class="btn danger" data-act="del" data-kind="mem" data-id="'+m.id+'">Apagar</button>':''}<span class="sp"></span><button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn primary">Salvar</button></div>
    </form>`,m?null:'input[name=title]');
}
function openFriend(id){
  const f=id?S.friends.find(x=>x.id===id):null;
  draft=f?Object.assign({},f):{id:uid(),name:'',nick:'',bday:'',fav:'',note:'',avatar:'',added:Date.now()};
  openModal(`<h3 class="mh">${f?'Editar amigo':'Novo amigo'}</h3>
    <form class="form" data-form="friend">
      <div class="row2">
        <label class="field"><span class="lab">Nome</span><input name="name" value="${esc(draft.name)}" maxlength="60" required></label>
        <label class="field"><span class="lab">Apelido</span><input name="nick" value="${esc(draft.nick||'')}" maxlength="40"></label>
      </div>
      <label class="field"><span class="lab">Aniversário</span><input type="date" name="bday" value="${esc(draft.bday||'')}"></label>
      <label class="field"><span class="lab">O que curte</span><input name="fav" value="${esc(draft.fav||'')}" maxlength="120" placeholder="Jogos, séries, bandas…"></label>
      <label class="field"><span class="lab">Anotação</span><textarea name="note" rows="4" maxlength="800" placeholder="Como vocês se conheceram, histórias, coisas pra lembrar.">${esc(draft.note||'')}</textarea></label>
      ${imgField('Foto','avatar','avatar','draft',draft.avatar)}
      <div class="actions">${f?'<button type="button" class="btn danger" data-act="del" data-kind="friend" data-id="'+f.id+'">Apagar</button>':''}<span class="sp"></span><button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn primary">Salvar</button></div>
    </form>`,f?null:'input[name=name]');
}
function openPhoto(id){
  const p=S.photos.find(x=>x.id===id);if(!p)return;
  draft={id:p.id};
  openModal(`<img class="lb-img" src="${p.src}" alt="${esc(p.caption||'')}">
    <form class="form" data-form="photo">
      <label class="field"><span class="lab">Legenda</span><input name="caption" value="${esc(p.caption||'')}" maxlength="140" placeholder="Onde foi? Quem estava?"></label>
      <div class="note">Guardada ${esc(relTime(p.added))}</div>
      <div class="actions"><button type="button" class="btn danger" data-act="del" data-kind="photo" data-id="${p.id}">Apagar</button><span class="sp"></span><button type="button" class="btn" data-act="close-modal">Fechar</button><button class="btn primary">Salvar</button></div>
    </form>`);
}
function askDelete(kind,id){
  if(kind==='item'){const it=S.items.find(i=>i.id===id);confirmModal('Apagar item?',`“${it?it.title:''}” será removido.`,'Apagar',()=>{S.items=S.items.filter(i=>i.id!==id);finish('Item apagado');});}
  else if(kind==='mem'){confirmModal('Apagar memória?','Essa memória será removida.','Apagar',()=>{S.memories=S.memories.filter(i=>i.id!==id);finish('Memória apagada');});}
  else if(kind==='friend'){confirmModal('Apagar amigo?','Essa ficha será removida.','Apagar',()=>{S.friends=S.friends.filter(i=>i.id!==id);finish('Amigo removido');});}
  else if(kind==='photo'){confirmModal('Apagar foto?','Essa foto será removida do hub.','Apagar',()=>{S.photos=S.photos.filter(i=>i.id!==id);finish('Foto apagada');});}
}
function finish(msg){save();closeModal();renderAll();if(msg)toast(msg);}
async function exportBackup(){
  let dl=null;
  try{dl=window.claude&&window.claude.use?await window.claude.use('downloads'):null;}catch(e){dl=null;}
  const blob=new Blob([JSON.stringify(S)],{type:'application/json'});
  if(!dl){
    try{
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);a.download='meu-hub-backup.json';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href),4000);
      toast('Backup baixado.');
    }catch(e){toast('Não consegui salvar o arquivo.');}
    return;
  }
  try{
    await dl.save({filename:'meu-hub-backup.json',data:blob});
    toast('Backup pronto.');
  }catch(e){if(!e||e.code!=='declined')toast('Não consegui salvar o arquivo.');}
}
const forms={
  async item(f){
    const title=fv(f,'title').trim();if(!title){f.elements.title.focus();return;}
    const d=draft;if(!d)return;
    const sb=f.querySelector('button.primary');if(sb)sb.disabled=true;
    const isNew=d._new;delete d._new;
    Object.assign(d,{title,col:fv(f,'col'),status:fv(f,'status'),note:fv(f,'note').trim()});
    const kd=kindOf(d.col);if(kd&&keyOf(kd)&&!d.gameId)await autoMatch(d,kd);
    const i=S.items.findIndex(x=>x.id===d.id);
    if(i>=0)S.items[i]=d;else S.items.unshift(d);
    finish(isNew?'Item guardado':'Item atualizado');
  },
  mem(f){
    const title=fv(f,'title').trim();if(!title){f.elements.title.focus();return;}
    Object.assign(draft,{title,date:fv(f,'date')||todayISO(),text:fv(f,'text').trim()});
    const i=S.memories.findIndex(x=>x.id===draft.id);
    if(i>=0)S.memories[i]=draft;else S.memories.unshift(draft);
    finish('Memória guardada');
  },
  friend(f){
    const name=fv(f,'name').trim();if(!name){f.elements.name.focus();return;}
    Object.assign(draft,{name,nick:fv(f,'nick').trim(),bday:fv(f,'bday'),fav:fv(f,'fav').trim(),note:fv(f,'note').trim()});
    const i=S.friends.findIndex(x=>x.id===draft.id);
    if(i>=0)S.friends[i]=draft;else S.friends.push(draft);
    finish('Amigo guardado');
  },
  photo(f){
    const p=S.photos.find(x=>x.id===draft.id);if(p)p.caption=fv(f,'caption').trim();
    finish('Legenda salva');
  }
};
document.addEventListener('submit',e=>{
  const f=e.target;if(!f.dataset||!f.dataset.form)return;
  e.preventDefault();if(forms[f.dataset.form])forms[f.dataset.form](f);
});
document.addEventListener('click',e=>{
  if(!e.target.closest('.ac'))drawAc();
  if(e.target.id==='modal'){closeModal();return;}
  const b=e.target.closest('[data-act]');if(!b)return;
  const a=b.dataset.act,id=b.dataset.id;
  switch(a){
    case 'go':go(b.dataset.tab);break;
    case 'add-item':openItem(null,b.dataset.col);break;
    case 'edit-item':openItem(id);break;
    case 'fav':{const it=S.items.find(i=>i.id===id);if(it){it.fav=!it.fav;save();renderTabs();renderView();}break;}
    case 'star':{const n=+b.dataset.n;draft.rating=draft.rating===n?0:n;$('#rate').innerHTML=rateInner(draft.rating);break;}
    case 'pick-game':pickGame(b.dataset.gid);break;
    case 'view-shot':{const x=draft&&draft.shots.find(y=>y.id===id);if(x)lightbox(x.src);break;}
    case 'del-shot':{if(draft){draft.shots=draft.shots.filter(y=>y.id!==id);const bx=$('#shots');if(bx)bx.innerHTML=shotsInner(draft.shots);}break;}
    case 'close-modal':closeModal();break;
    case 'confirm-ok':{const cb=confirmCb;confirmCb=null;if(cb)cb();break;}
    case 'del':askDelete(b.dataset.kind,id);break;
    case 'open-photo':openPhoto(id);break;
    case 'add-mem':openMem(null);break;
    case 'edit-mem':openMem(id);break;
    case 'other-mem':memPick++;viewHome();break;
    case 'add-friend':openFriend(null);break;
    case 'edit-friend':openFriend(id);break;
    case 'clear-img':{
      const fld=b.dataset.field;
      if(b.dataset.target==='draft'&&draft)draft[fld]='';
      else if(b.dataset.target==='profile'){S.profile[fld]='';save();renderHero();}
      setPreview(fld,'');break;}
    case 'accent':S.profile.accent=b.dataset.color;save();applyTheme();renderHero();viewSettings();break;
    case 'theme':S.profile.theme=b.dataset.themeSet;save();applyTheme();viewSettings();break;
    case 'add-col':{
      const n=$('#newcol').value.trim();if(!n){$('#newcol').focus();return;}
      S.collections.push({id:uid(),name:n,color:$('#newcolor').value,kind:$('#newkind').value});save();renderTabs();viewSettings();toast('Coleção criada');break;}
    case 'del-col':{
      const c=colOf(id),n=S.items.filter(i=>i.col===id).length;
      if(S.collections.length<=1){toast('Mantenha pelo menos uma coleção.');return;}
      confirmModal('Apagar coleção?',`“${c.name}” será removida${n?' junto com '+n+(n===1?' item':' itens'):''}.`,'Apagar',()=>{
        S.collections=S.collections.filter(x=>x.id!==id);S.items=S.items.filter(i=>i.col!==id);save();closeModal();renderAll();toast('Coleção apagada');});
      break;}
    case 'clear-examples':
      ['items','photos','memories','friends'].forEach(k=>{S[k]=S[k].filter(x=>!x.ex);});
      save();renderAll();toast('Exemplos apagados');break;
    case 'export':exportBackup();break;
    case 'wipe':
      confirmModal('Começar do zero?','Isso apaga tudo que está neste hub: itens, fotos, memórias e amigos. Faça um backup antes se quiser guardar.','Apagar tudo',()=>{
        S=makeState(false);save();closeModal();tab='perfil';renderAll();toast('Hub zerado');});
      break;
  }
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.prof){S.profile[t.dataset.prof]=t.value;save();renderHero();}
  else if(t.id==='q'){filt.q=t.value;const c=curCollection();if(c)drawGrid(c);}
  else if(t.dataset.colname){const c=colOf(t.dataset.colname);if(c){c.name=t.value.trim()||c.name;save();renderTabs();}}
  else if(t.dataset.colcolor){const c=colOf(t.dataset.colcolor);if(c){c.color=t.value;save();}}
  else if(t.id==='customaccent'){S.profile.accent=t.value;save();applyTheme();renderHero();}
  else if(t.name==='title'&&t.form&&t.form.dataset.form==='item')onTitleInput(t);
});
document.addEventListener('change',async e=>{
  const t=e.target;
  if(t.id==='fs'||t.id==='so'){
    if(t.id==='fs')filt.status=t.value;else filt.sort=t.value;
    const c=curCollection();if(c)drawGrid(c);return;
  }
  if(t.dataset.img){
    const file=t.files&&t.files[0];t.value='';if(!file)return;
    try{
      const url=await shrink(file,SPEC[t.dataset.img]);
      const fld=t.dataset.field;
      if(t.dataset.target==='draft'&&draft)draft[fld]=url;
      else if(t.dataset.target==='profile'){S.profile[fld]=url;save();renderHero();}
      setPreview(fld,url);
    }catch(err){toast('Não consegui abrir essa imagem.');}
    return;
  }
  if(t.dataset.photos!==undefined){
    const files=Array.prototype.slice.call(t.files||[]);t.value='';if(!files.length)return;
    toast('Processando '+files.length+(files.length===1?' foto…':' fotos…'));
    let ok=0;
    for(const f of files){
      try{const src=await shrink(f,SPEC.photo);S.photos.push({id:uid(),src,caption:'',added:Date.now()+ok});ok++;}catch(err){}
    }
    save();renderTabs();renderHero();if(tab==='fotos')viewPhotos();
    toast(ok?ok+(ok===1?' foto guardada':' fotos guardadas'):'Não consegui abrir essas imagens.');
    return;
  }
  if(t.dataset.colkind!==undefined){const c=colOf(t.dataset.colkind);if(c){c.kind=t.value;save();}return;}
  if(t.name==='col'&&t.form&&t.form.dataset.form==='item'){if(draft)draft.col=t.value;drawAc();return;}
  if(t.dataset.shots!==undefined){
    const files=Array.from(t.files||[]);t.value='';if(!files.length||!draft)return;
    const d=draft;let ok=0;
    for(const f of files){
      try{d.shots.push({id:uid(),src:await shrink(f,SPEC.shot),added:Date.now()+ok});ok++;}catch(err){}
    }
    const bx=$('#shots');if(bx&&draft===d)bx.innerHTML=shotsInner(d.shots);
    if(!ok)toast('Não consegui abrir essas imagens.');
    return;
  }
  if(t.dataset.import!==undefined){
    const file=t.files&&t.files[0];t.value='';if(!file)return;
    try{
      const o=JSON.parse(await file.text());
      if(!o||typeof o!=='object'||!o.profile||!Array.isArray(o.items))throw new Error('formato');
      confirmModal('Importar backup?','Isso substitui tudo que está neste hub agora.','Importar',()=>{
        S=normalize(o);save();closeModal();tab='perfil';renderAll();toast('Backup importado');});
    }catch(err){toast('Esse arquivo não parece um backup do hub.');}
  }
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  const lb=$('.lb');if(lb){lb.remove();return;}
  if(!$('#modal').hidden)closeModal();
});
async function init(){
  try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();}catch(e){}
  let saved=null,failed=false;
  try{saved=await withTimeout(idbGet('hub'),2500);}catch(e){failed=true;}
  if(saved&&saved.profile){S=normalize(saved);}
  else{S=makeState(true);if(!failed)save();}
  renderAll();
  if(failed)toast('Este navegador não deixa salvar. Use Exportar backup em Ajustes.');
}
init();
})();