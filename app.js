'use strict';

// SpareParts 0.4 – offline-first, ohne externe Bibliotheken oder Server-APIs.
const CATEGORIES = [
  'Scheuersaugmaschinen Batterie',
  'Einscheibenmaschinen',
  'Einscheibenmaschinen Zubehör',
  'Kehrmaschinen',
  'Staubsauger und Zubehör',
  'Teppichreiniger',
  'Scheuersaugmaschinen 230V'
];
const $ = id => document.getElementById(id);
const htmlEscape = v => String(v??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function loadStored(k,fallback){ try {return JSON.parse(localStorage.getItem(k)) || fallback;}catch{return fallback;} }
const state = {screen:'home',cat:'',mid:'',page:0,zoom:1,mapMode:false,selected:null,picker:null};
let machines=[];
let privateDb=null;
const privateUrls=[];
let saved=loadStored('spareparts-saved',{});
let mapping=loadStored('spareparts-positions-v02',{});
let toastTimer;

function model(id){return machines.find(m=>m.id===id)}
function currentModel(){return model(state.mid)}
function currentGroup(){return currentModel()?.groups.find(g=>g.diagramPage===state.page)}
function groupParts(m,g){return m.parts.filter(p=>p.diagramPage===g.diagramPage)}
function uniqueNumbers(parts){return new Set(parts.map(p=>p.number))}
function groupPositionKey(mid,page){return `${mid}:${page}`}
function userMarks(mid,page){let value=mapping[groupPositionKey(mid,page)];return Array.isArray(value)?value:[]}
function store(){
  try {localStorage.setItem('spareparts-saved',JSON.stringify(saved));localStorage.setItem('spareparts-positions-v02',JSON.stringify(mapping));}
  catch(e){showToast('Achtung: Lokales Speichern fehlgeschlagen. Bitte Speicherplatz prüfen.');}
  let badge=$('badge');if(badge)badge.textContent=Object.keys(saved).length||'';
}
function showToast(msg){let el=$('toast');if(!el)return;el.textContent=msg;el.style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.style.display='none'},2700);}
function onlineStatus(){let el=$('onlineStatus');if(el)el.textContent=navigator.onLine?'● Online':'● Offline';}
window.addEventListener('online',onlineStatus);window.addEventListener('offline',onlineStatus);
function go(s){state.screen=s;state.mapMode=false;closeSheet();render();window.scrollTo(0,0);}
function chooseCat(i){state.cat=CATEGORIES[i];go('models');}
function chooseMachine(id){state.mid=id;go('groups');}
function chooseGroup(page){state.page=Number(page);state.zoom=1;go('group');}
function titleAndBack(label,to){return `<button class="back-link noprint" type="button" onclick="go('${to}')">‹ ${htmlEscape(label)}</button>`}
function updateNav(){
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===(['home','models','groups','group'].includes(state.screen)?'home':state.screen)));
}
function machineCount(cat){return machines.filter(m=>m.category===cat).length}
function categoryImage(i){return `./category-images/category-${String(i+1).padStart(2,'0')}.webp`;}
function cardCategories(){
  return `<div class="eyebrow">Katalogübersicht</div><h1>Maschinen</h1><p class="lead muted">Wähle zuerst die Maschinenkategorie.</p>`+
    CATEGORIES.map((c,i)=>`<button class="list-card" type="button" onclick="chooseCat(${i})">${categoryImage(i)?`<img class="cat-photo" src="${categoryImage(i)}" alt="" loading="lazy">`:`<span class="cat-photo cat-photo-placeholder" aria-hidden="true">${["Batterie", "Einscheiben", "Zubehör", "Kehrmaschine", "Staubsauger", "Teppich", "230 V"][i]}</span>`}<span class="grow"><strong>${htmlEscape(c)}</strong><small>${machineCount(c)?machineCount(c)+' Maschine'+(machineCount(c)>1?'n':''):'Noch keine Maschinen'}</small></span><span class="chevron">›</span></button>`).join('')+
    `<div class="note"><strong>Unabhängige, private Arbeitshilfe.</strong> Keine offizielle TASKI-App und nicht mit TASKI oder Diversey verbunden. Katalogdaten und Merkliste werden lokal auf diesem Gerät gespeichert.</div><button class="btn secondary wide share-app noprint" type="button" onclick="shareApp()">↗ App-Link teilen</button><p class="version">SpareParts 0.4 · Private Offline-Kataloge · Merkliste</p>`;
}
async function shareApp(){
 const url=location.href;
 try{if(navigator.share){await navigator.share({title:'SpareParts',text:'SpareParts Ersatzteilkatalog',url});return;}}
 catch(e){if(e.name==='AbortError')return;}
 try{await navigator.clipboard.writeText(url);showToast('App-Link kopiert.');}
 catch{window.prompt('App-Link kopieren:',url);}
}
function cardModels(){
 const ms=machines.filter(m=>m.category===state.cat);
 return titleAndBack('Maschinenkategorien','home')+`<div class="eyebrow">Kategorie</div><h1>${htmlEscape(state.cat)}</h1>`+
 (ms.length?ms.map(m=>`<button class="list-card model-card" type="button" onclick="chooseMachine('${m.id}')"><img class="model-img" src="${m.thumbnail}" alt="${htmlEscape(m.name)}"><span class="grow"><strong>${htmlEscape(m.name)}</strong><small>${m.groups.length} Baugruppen · ${m.parts.length} Katalogeinträge</small></span><span class="chevron">›</span></button>`).join(''):`<div class="empty">Für diese Kategorie liegen noch keine PDF-Kataloge vor.</div>`);
}
function cardGroups(){
 const m=currentModel();if(!m)return '<div class="empty">Maschine nicht gefunden.</div>';
 return titleAndBack('Maschinenmodelle','models')+`<div class="eyebrow">${htmlEscape(m.category)}</div><h1>${htmlEscape(m.name)}</h1><p class="muted lead">PDF-Ausgabe ${htmlEscape(m.version)} · ${m.groups.length} Baugruppen</p>`+
 m.groups.map(g=>{
  let count=groupParts(m,g).length;
  return `<button class="list-card" type="button" onclick="chooseGroup(${g.diagramPage})"><span class="cat-icon">▤</span><span class="grow"><strong>${htmlEscape(g.label||g.name)}</strong><small>${count} Teile · Zeichnung Seite ${g.diagramPage}</small></span><span class="chevron">›</span></button>`;
 }).join('');
}
function sameSpot(a,b){
 return Math.hypot(a.x-b.x,a.y-b.y)<1;
}
function effectiveMarks(g,m){
 const valid=uniqueNumbers(groupParts(m,g));
 const manual=[...userMarks(m.id,g.diagramPage)].reverse();
 const automatic=[...g.hotspots].sort((a,b)=>
  Number(a.source==='uncertain')-Number(b.source==='uncertain') || (b.confidence||0)-(a.confidence||0));
 const marks=[];
 for(const mark of [...manual,...automatic]){
  if(!valid.has(mark.number)||!Number.isFinite(mark.x)||!Number.isFinite(mark.y))continue;
  if(marks.some(used=>sameSpot(used,mark)))continue;
  if(automatic.includes(mark)&&manual.some(used=>sameSpot(used,mark)))continue;
  marks.push(mark);
 }
 return marks;
}
function markHtml(g,m){
 return effectiveMarks(g,m).map((mark,index)=>{
  const color=mark.source==='manual'?'manual':mark.source==='uncertain'?'uncertain':'';
  const label=htmlEscape(`${color==='uncertain'?'Unsicherer Vorschlag: ':''}Artikelnummer ${mark.number} auswählen`);
  return `<button class="spot ${color}" type="button" aria-label="${label}" title="${label}" style="left:${mark.x}%;top:${mark.y}%" onclick="tapPosition(${index},event)"></button>`;
 }).join('');
}
function partRows(m,parts,withSource=false){
 if(!parts.length)return `<div class="empty">Hier sind keine Ersatzteile gelistet. Die Originalzeichnung kannst du trotzdem öffnen.</div>`;
 return parts.map(p=>{
  return `<div class="part"><div class="part-info"><strong class="num">${htmlEscape(p.number)}</strong><p class="desc">${htmlEscape(p.description)}</p>${withSource?`<span class="hint">${htmlEscape(m.name)} · ${htmlEscape(p.group)} · S. ${p.diagramPage}</span>`:''}</div><div class="part-actions"><button class="btn secondary tight" type="button" aria-label="${htmlEscape(p.number)} merken" onclick="addPart('${m.id}','${p.number}')">+ Merken</button></div></div>`;
 }).join('');
}
function cardGroup(){
 const m=currentModel(),g=currentGroup();if(!m||!g)return '<div class="empty">Baugruppe nicht gefunden.</div>';
 const parts=groupParts(m,g), annotated=new Set(effectiveMarks(g,m).map(h=>h.number));
 const markedCount=parts.filter((p,i,a)=>a.findIndex(x=>x.number===p.number)===i && annotated.has(p.number)).length;
 const totalCount=uniqueNumbers(parts).size;
 const zoomLabel=Math.round(state.zoom*100)+' %';
 return titleAndBack('Baugruppen','groups')+
 `<div class="eyebrow">${htmlEscape(m.name)} · PDF-Seite ${g.diagramPage}</div><h1>${htmlEscape(g.label||g.name)}</h1>`+
 `<div class="diagram-tools noprint"><span class="zoom-label" id="zoomLabel">${zoomLabel}</span><span class="tool-spacer"></span><button type="button" class="btn ${state.mapMode?'danger':'secondary'} tight" onclick="toggleMapping()">${state.mapMode?'Fertig':'✎ Zuordnen'}</button></div>`+
 `<div class="diagram-frame" id="diagramViewport" aria-label="Explosionszeichnung, zoombar und mit verknüpften Artikelnummern"><div class="diagram-inner ${state.mapMode?'mode-map':''}" id="diagramInner" style="width:${Math.round(state.zoom*100)}%" onclick="diagramTap(event)"><img draggable="false" src="${g.image}" alt="Explosionszeichnung ${htmlEscape(g.name)} aus dem Originalkatalog auf Seite ${g.diagramPage}" loading="eager">${state.mapMode?'':markHtml(g,m)}</div></div>`+
 `<div class="note"><strong>Tippe auf eine Nummer in der Zeichnung.</strong> <span class="diagram-count">${markedCount} von ${totalCount}</span> Artikelnummern sind schon direkt verknüpft. Bei anderen Nummern erscheint eine Auswahl zum einmaligen Zuordnen.</div>`+
 (state.mapMode?`<p class="diagram-help"><strong>Zuordnungsmodus:</strong> Tippe in der Zeichnung genau auf eine noch nicht verknüpfte Nummer. Wähle danach die richtige Artikelnummer aus der Liste. Die Markierung wird lokal gespeichert.</p>`:`<p class="diagram-help">Blau = sicher automatisch verknüpft, Gelb = unsicherer Vorschlag, Orange = selbst bestätigt oder zugeordnet. Tippe auch auf eine nicht umrandete Nummer, um sie einmalig zuzuordnen. Mit zwei Fingern zoomen, mit einem Finger verschieben und per Doppeltipp zurücksetzen.</p>`)+
 `<div class="below-links noprint"><a class="btn ghost tight" href="${m.pdf}#page=${g.diagramPage}" target="_blank" rel="noopener">Original-PDF ↗</a><a class="btn ghost tight" href="${m.pdf}#page=${g.partsPage}" target="_blank" rel="noopener">PDF-Ersatzteilliste ↗</a></div>`+
 `<div class="section-heading"><h3>Alle Teile dieser Baugruppe</h3><span class="pill">${parts.length} Einträge</span></div>`+partRows(m,parts);
}
let diagramGestureCleanup=null;
function initDiagramGestures(){
 const vp=$('diagramViewport'),inner=$('diagramInner');if(!vp||!inner)return;
 let active=new Map(),pinch=null,drag=null,lastTap=0,suppressUntil=0;
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const local=e=>({x:e.clientX,y:e.clientY});
 function applyZoom(z,cx,cy){
  const old=state.zoom,next=Math.min(4,Math.max(1,z));
  if(Math.abs(old-next)<.001)return;
  const bounds=vp.getBoundingClientRect();
  const x=cx-bounds.left,y=cy-bounds.top;
  const px=vp.scrollLeft+x,py=vp.scrollTop+y;
  state.zoom=next;inner.style.width=(next*100)+'%';
  vp.scrollLeft=px*next/old-x;vp.scrollTop=py*next/old-y;
  const label=$('zoomLabel');if(label)label.textContent=Math.round(next*100)+' %';
 }
 function down(e){
  if(e.pointerType==='mouse'&&e.button!==0)return;
  active.set(e.pointerId,local(e));
  if(active.size===2){
   let [a,b]=[...active.values()];pinch={dist:dist(a,b),zoom:state.zoom};drag=null;suppressUntil=Date.now()+450;
  }else if(active.size===1){drag={x:e.clientX,y:e.clientY,scrollX:vp.scrollLeft,scrollY:vp.scrollTop,moved:false};}
  try{vp.setPointerCapture(e.pointerId)}catch{}
 }
 function move(e){
  if(!active.has(e.pointerId))return;
  active.set(e.pointerId,local(e));
  if(active.size>=2){
   let [a,b]=[...active.values()];
   if(!pinch)pinch={dist:dist(a,b),zoom:state.zoom};
   if(pinch.dist>0)applyZoom(pinch.zoom*dist(a,b)/pinch.dist,(a.x+b.x)/2,(a.y+b.y)/2);
   suppressUntil=Date.now()+450;
  }else if(drag){
   const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
   if(Math.abs(dx)+Math.abs(dy)>8){drag.moved=true;suppressUntil=Date.now()+350;}
   if(state.zoom>1.001){vp.scrollLeft=drag.scrollX-dx;vp.scrollTop=drag.scrollY-dy;}
  }
  if(e.cancelable)e.preventDefault();
 }
 function up(e){
  if(!active.has(e.pointerId))return;
  const wasPinch=!!pinch,wasDrag=!!drag?.moved;
  active.delete(e.pointerId);
  if(wasPinch||wasDrag)suppressUntil=Date.now()+450;
  if(!active.size){
   pinch=null;drag=null;
   if(!wasPinch&&!wasDrag&&Date.now()-lastTap<320){
    const r=vp.getBoundingClientRect();applyZoom(1,e.clientX,e.clientY);vp.scrollLeft=0;vp.scrollTop=0;
    suppressUntil=Date.now()+450;lastTap=0;
   }else if(!wasPinch&&!wasDrag)lastTap=Date.now();
  }else if(active.size===1){let p=[...active.values()][0];pinch=null;drag={x:p.x,y:p.y,scrollX:vp.scrollLeft,scrollY:vp.scrollTop,moved:true};}
 }
 vp.addEventListener('pointerdown',down);vp.addEventListener('pointermove',move);vp.addEventListener('pointerup',up);vp.addEventListener('pointercancel',up);
 vp.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.stopPropagation();e.preventDefault();}},true);
}
function changeZoom(direction){
 const vp=$('diagramViewport'),inner=$('diagramInner');
 const prevCenter=vp&&inner?(vp.scrollLeft+vp.clientWidth/2)/inner.getBoundingClientRect().width:0.5;
 const prevTop=vp&&inner?(vp.scrollTop+vp.clientHeight/2)/inner.getBoundingClientRect().height:0;
 state.zoom=Math.min(4,Math.max(1,+(state.zoom*(direction>0?1.5:1/1.5)).toFixed(2)));
 render();
 requestAnimationFrame(()=>{let newVp=$('diagramViewport'),newInner=$('diagramInner');if(!newVp||!newInner)return;newVp.scrollLeft=prevCenter*newInner.getBoundingClientRect().width-newVp.clientWidth/2;newVp.scrollTop=prevTop*newInner.getBoundingClientRect().height-newVp.clientHeight/2;});
}
function resetZoom(){state.zoom=1;render();}
function toggleMapping(){state.mapMode=!state.mapMode;closeSheet();render();}
function tapPosition(index,e){
 e.stopPropagation();
 if(state.mapMode)return;
 const mark=effectiveMarks(currentGroup(),currentModel())[index];
 if(!mark)return;
 state.picker={x:mark.x,y:mark.y};
 showPartSheet(state.mid,mark.number,state.page,mark);
}
function diagramTap(e){
 // Auch nicht automatisch erkannte Nummern lassen sich durch Tippen verknüpfen.
 if(e.target.closest('.spot'))return;
 const root=$('diagramInner');const r=root.getBoundingClientRect();
 const x=100*(e.clientX-r.left)/r.width, y=100*(e.clientY-r.top)/r.height;
 if(!(x>=0&&x<=100&&y>=0&&y<=100))return;
 state.picker={x:+x.toFixed(3),y:+y.toFixed(3)};
 showPicker();
}
function showPartSheet(mid,number,page=state.page,mark=null){
 const m=model(mid),p=m?.parts.find(x=>x.number===number&&x.diagramPage===Number(page));
 if(!p)return showToast('Artikelnummer nicht gefunden.');
 const g=m.groups.find(x=>x.diagramPage===p.diagramPage);
 let box=`<div class="sheet-head"><div><p class="eyebrow">Ersatzteil auswählen</p><h3 class="num">${htmlEscape(p.number)}</h3></div><button type="button" class="sheet-close" aria-label="Schließen" onclick="closeSheet()">×</button></div>`+
 `<p style="margin:3px 0 8px">${htmlEscape(p.description)}</p><p class="sheet-info">${htmlEscape(m.name)} · ${htmlEscape(g?.name||p.group)} · PDF S. ${p.partsPage}</p>`+
 `<button type="button" class="btn wide" onclick="addPart('${m.id}','${p.number}')">＋ Auf Merkliste setzen</button>`;
 if(mark){
  if(mark.source==='uncertain')box+='<p class="sheet-info">Gelb · Unsicherer Vorschlag. Bitte mit der Ersatzteilliste abgleichen.</p>';
  box+=`<div class="row" style="margin-top:10px"><button type="button" class="btn secondary" onclick="showPicker()">Verknüpfung ändern</button>${mark.source!=='manual'?'<button type="button" class="btn secondary" onclick="setManualPosition(this.dataset.number)" data-number="'+htmlEscape(mark.number)+'">Verknüpfung bestätigen</button>':''}</div>`;
 }
 openSheet(box);
}
function openSheet(html){$('sheetRoot').innerHTML=`<div class="sheet-overlay" onclick="closeSheet()" aria-hidden="true"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="Ersatzteilinformation">${html}</section>`;}
function closeSheet(){$('sheetRoot').innerHTML='';}
function showPicker(){
 const m=currentModel(),g=currentGroup();if(!m||!g||!state.picker)return;
 openSheet(`<div class="sheet-head"><div><p class="eyebrow">Nummer in der Zeichnung verknüpfen</p><h3>Artikelnummer auswählen</h3></div><button type="button" class="sheet-close" aria-label="Schließen" onclick="closeSheet()">×</button></div><p class="sheet-info">Tippe auf das passende Teil. Danach ist diese Nummer an der markierten Stelle direkt anklickbar.</p><input type="search" id="mapSearch" class="search-box" placeholder="Artikelnummer / Bezeichnung suchen" oninput="filterPicker()" aria-label="Ersatzteil für Verknüpfung suchen"><div class="picker-list" id="mapOptions"></div>`);
 filterPicker();
}
function filterPicker(){
 let m=currentModel(),g=currentGroup(),out=$('mapOptions');if(!out)return;
 const q=($('mapSearch')?.value||'').toLowerCase().trim();
 let values=groupParts(m,g).filter(p=>(p.number+' '+p.description).toLowerCase().includes(q));
 const uniq=new Map();values.forEach(p=>{if(!uniq.has(p.number))uniq.set(p.number,p)});
 out.innerHTML=Array.from(uniq.values()).slice(0,150).map(p=>`<button type="button" class="picker-row" onclick="setManualPosition('${p.number}')"><strong class="num">${htmlEscape(p.number)}</strong><small>${htmlEscape(p.description)}</small></button>`).join('')||'<p class="muted">Kein passender Artikel in dieser Baugruppe.</p>';
}
function setManualPosition(number){
 if(!state.picker)return;
 const key=groupPositionKey(state.mid,state.page),m=currentModel(),g=currentGroup();
 if(!groupParts(m,g).some(p=>p.number===number))return;
 const point=state.picker;
 const a=userMarks(state.mid,state.page).filter(mark=>!sameSpot(mark,point));
 a.push({number,x:state.picker.x,y:state.picker.y,source:'manual'});
 mapping[key]=a;state.picker=null;state.mapMode=false;
 store();closeSheet();render();showToast(`Position ${number} verknüpft.`);
}
function addPart(mid,number){
 const m=model(mid),p=m?.parts.find(x=>x.number===number);if(!p)return;
 const key=`${mid}|${number}`;
 if(saved[key])saved[key].qty=Math.min(999,saved[key].qty+1);
 else saved[key]={number:p.number,description:p.description,machine:m.name,qty:1};
 store();closeSheet();render();showToast(`${number} auf Merkliste gesetzt`);
}
function adjustPart(key,step){
 if(!saved[key])return;saved[key].qty=Math.min(999,saved[key].qty+step);if(saved[key].qty<1)delete saved[key];
 store();render();
}
function removeSaved(key){delete saved[key];store();render();}
function clearSaved(){if(!Object.keys(saved).length)return;if(confirm('Wirklich alle gemerkten Ersatzteile entfernen?')){saved={};store();render();showToast('Merkliste geleert.');}}
function printTable(){
 const data=Object.values(saved);
 const rows=data.map(p=>`<tr><td>${htmlEscape(p.number)}</td><td>${htmlEscape(p.description)}</td><td>${htmlEscape(p.machine)}</td><td>${p.qty}</td></tr>`).join('');
 const date=new Date().toLocaleDateString('de-AT');
 return `<section class="print-only"><h1>SpareParts · Merkliste</h1><p>Ausdruck vom ${date} · ${data.length} Artikelpositionen</p><table><thead><tr><th>Artikelnummer</th><th>Ersatzteil</th><th>Maschine</th><th>Menge</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}
function makeSavedPdf(entries) {
 const decoder = new TextDecoder('windows-1252');
 const bytes = Uint8Array.from({length: 256}, (_, i) => i);
 const encoding = new Map([...decoder.decode(bytes)].map((letter, i) => [letter, i]));
 const hex = value => Array.from(String(value).normalize('NFC'), letter =>
  (encoding.get(letter.replace(/[\r\n\t]/, ' ')) ?? 63).toString(16).padStart(2, '0')
 ).join('');
 const objects = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
 const pages = [];
 let lines = [];
 let y = 0;
 const write = (value, size) => {
  lines.push(`BT /F1 ${size} Tf 1 0 0 1 40 ${y} Tm <${hex(value)}> Tj ET`);
  y -= size + 5;
 };
 function finishPage() {
  const stream = lines.join('\n') + '\n';
  const page = objects.length + 1;
  pages.push(page);
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${page + 1} 0 R >>`);
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
 }
 function startPage() {
  lines = [];
  y = 800;
  write('SpareParts · Merkliste', 18);
  write(`${new Date().toLocaleDateString('de-AT')} · Seite ${pages.length + 1}`, 10);
  y -= 12;
 }
 startPage();
 for (const part of entries) {
  const fields = [`${part.qty} × ${part.number}`, part.description, part.machine];
  if (y < 105) { finishPage(); startPage(); }
  for (const field of fields) {
   const wrapped = String(field ?? '').trim().match(/.{1,63}(?:\s|$)|.{1,63}/gu) || [];
   for (const line of wrapped) {
    if (y < 45) { finishPage(); startPage(); }
    write(line.trim(), 10);
   }
  }
  y -= 9;
 }
 finishPage();
 objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
 objects[1] = `<< /Type /Pages /Kids [${pages.map(page => page + ' 0 R').join(' ')}] /Count ${pages.length} >>`;
 let pdf = '%PDF-1.4\n';
 const offsets = objects.map((object, i) => {
  const offset = pdf.length;
  pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  return offset;
 });
 const xref = pdf.length;
 pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
 for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
 return pdf + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}
async function exportSavedPdf() {
 const entries = Object.values(saved);
 if (!entries.length) return;
 try {
  const file = new File([makeSavedPdf(entries)], 'SpareParts-Merkliste.pdf', {type:'application/pdf'});
  const share = {files:[file]};
  if (navigator.share && navigator.canShare?.(share)) {
   try { await navigator.share(share); return; }
   catch (error) { if (error.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
 } catch {
  showToast('Die PDF-Datei konnte nicht erstellt werden.');
 }
}
function savedView(){
 const entries=Object.entries(saved);
 let row=entries.map(([key,p])=>{
  const safeKey=htmlEscape(key);
  return `<div class="part"><div class="part-info"><strong class="num">${htmlEscape(p.number)}</strong><p class="desc">${htmlEscape(p.description)}</p><span class="hint">${htmlEscape(p.machine)}</span></div><div class="part-actions qty"><button type="button" onclick="adjustPart('${safeKey}',-1)" aria-label="Menge verringern">−</button><b>${p.qty}</b><button type="button" onclick="adjustPart('${safeKey}',1)" aria-label="Menge erhöhen">+</button><button type="button" class="remove" onclick="removeSaved('${safeKey}')" aria-label="Artikel entfernen">×</button></div></div>`;
 }).join('');
 return `<div class="noprint"><div class="eyebrow">Kostenvoranschlag vorbereiten</div><h1>Merkliste</h1><p class="muted lead">${entries.length} Artikel · Gesamtmenge ${entries.reduce((s,[,p])=>s+p.qty,0)} · Ohne Preise</p>`+
 (entries.length?row+`<div class="row" style="margin-top:14px"><button type="button" class="btn" onclick="exportSavedPdf()">▤ Merkliste als PDF</button><button type="button" class="btn secondary" onclick="copyList()">⎘ Liste kopieren</button></div><p style="margin-top:14px"><button type="button" class="btn danger wide" onclick="clearSaved()">🗑 Gesamte Merkliste leeren</button></p>`:`<div class="empty"><p>Die Merkliste ist noch leer. Tippe in einer Explosionszeichnung oder Ersatzteilliste auf ein Teil und wähle „Merken“.</p></div>`)+`</div>`+printTable();
}
async function copyList(){
 const values=Object.values(saved).map(p=>`${p.qty} × ${p.number} – ${p.description} (${p.machine})`).join('\n');
 try{await navigator.clipboard.writeText(values);showToast('Merkliste kopiert.');}
 catch{window.prompt('Zum Kopieren markieren:',values);}
}
function searchView(){return `<div class="eyebrow">Alle vorhandenen Ersatzteilkataloge</div><h1>Artikel suchen</h1><p class="muted lead">Durchsuche Artikelnummern und Ersatzteilbezeichnungen aller importierten Kataloge.</p><input class="search-box" id="searchInput" type="search" placeholder="Artikelnummer oder Bezeichnung" oninput="searchNow()" autocomplete="off" aria-label="Artikel suchen"><div id="searchResults" class="search-results muted">Gib mindestens 2 Zeichen ein, um Ersatzteile zu finden.</div>`;}
function searchNow(){
 let val=$('searchInput')?.value.trim().toLowerCase(),out=$('searchResults');if(!out)return;
 if(!val||val.length<2){out.textContent='Gib mindestens 2 Zeichen ein, um Ersatzteile zu finden.';return;}
 let all=[];
 for(let m of machines)for(let p of m.parts)if((p.number+' '+p.description+' '+p.group).toLowerCase().includes(val))all.push({m,p});
 out.innerHTML=`<p class="muted">${all.length} Treffer${all.length>100?' · Erste 100 angezeigt':''}</p>`+all.slice(0,100).map(({m,p})=>`<div class="part"><div class="part-info"><strong class="num">${htmlEscape(p.number)}</strong><p class="desc">${htmlEscape(p.description)}</p><span class="hint">${htmlEscape(m.name)} · ${htmlEscape(p.group)}</span></div><div class="part-actions"><button type="button" class="btn secondary tight" onclick="addPart('${m.id}','${p.number}')">+ Merken</button><button type="button" class="btn ghost tight" onclick="openDrawing('${m.id}',${p.diagramPage})" aria-label="Zeichnung öffnen">↗</button></div></div>`).join('');
}
function openDrawing(mid,page){state.mid=mid;state.cat=model(mid)?.category||'';chooseGroup(page);}
function downloadBackup(){
 let payload={format:'SpareParts-Backup-1',created:new Date().toISOString(),saved,mapping};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`SpareParts-Sicherung-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);showToast('Sicherung erstellt.');
}
function importBackup(el){
 const f=el.files?.[0];if(!f)return;
 if(f.size>2000000){showToast('Sicherung ist zu groß.');return;}
 f.text().then(t=>{
  let v=JSON.parse(t);if(v.format!=='SpareParts-Backup-1'||!v.saved||typeof v.saved!=='object'||!v.mapping||typeof v.mapping!=='object')throw Error('Ungültiges Sicherungsformat');
  const clean={};Object.entries(v.saved).forEach(([k,p])=>{
   if(!/^\w+\|\d{7,8}$/.test(k)||!p||!/^\d{7,8}$/.test(String(p.number))||!Number.isInteger(p.qty)||p.qty<1||p.qty>999)return;
   clean[k]={number:p.number,description:String(p.description||'').slice(0,200),machine:String(p.machine||'').slice(0,150),qty:p.qty};
  });
  const coords={};Object.entries(v.mapping).forEach(([k,spots])=>{
   if(!/^[A-Za-z0-9_-]{1,64}:\d+$/.test(k)||!Array.isArray(spots))return;
   let [mid,page]=k.split(':'),m=model(mid),g=m?.groups.find(gr=>gr.diagramPage===Number(page));if(!g)return;
   const legal=uniqueNumbers(groupParts(m,g));
   coords[k]=spots.filter(h=>h&&legal.has(h.number)&&Number.isFinite(h.x)&&Number.isFinite(h.y)&&h.x>=0&&h.x<=100&&h.y>=0&&h.y<=100).slice(0,250).map(h=>({number:h.number,x:h.x,y:h.y,source:'manual'}));
  });
  if(confirm('Die vorhandene Merkliste und deine eigenen Positionszuordnungen durch diese Sicherung ersetzen?')){saved=clean;mapping=coords;store();render();showToast('Sicherung wiederhergestellt.');}
 }).catch(()=>showToast('Sicherung konnte nicht gelesen werden.')).finally(()=>{el.value='';});
}
function toolsView(){
 const totalHotspots=machines.reduce((sum,m)=>sum+m.groups.reduce((s,g)=>s+g.hotspots.length,0),0);
 const original=machines.reduce((sum,m)=>sum+m.parts.length,0);
 return `<div class="eyebrow">SpareParts – Verwaltung</div><h1>Mehr</h1><div class="surface tools-card"><h3>Offline-Kataloge</h3><p>Die öffentliche App wird offline zwischengespeichert. PDF-Kataloge und Explosionszeichnungen importierst du privat und speicherst sie auf diesem iPhone.</p><span class="offline-badge">✓ Offline-fähig</span><p>Entfernt die Kataloge von diesem Gerät. Die Merkliste und deine Zuordnungen bleiben gespeichert.</p><button id="resetCatalogButton" type="button" class="btn danger" onclick="resetPrivateCatalog()">Katalog zurücksetzen</button><p class="hint">Teste die App nach der Installation einmal im Flugmodus. Lösche keine Website-Daten für SpareParts, sonst können Merklisten und eigene Markierungen verloren gehen.</p></div>`+
 `<div class="surface tools-card"><h3>Merkliste & Markierungen sichern</h3><p>Sichere deine Merkliste und selbst hinzugefügte Zuordnungspunkte als Datei. Die Daten werden nur auf diesem Gerät gespeichert, bis du sie selbst exportierst.</p><div class="row"><button type="button" class="btn" onclick="downloadBackup()">Sicherung exportieren</button><label class="btn secondary" for="importBackupInput" style="cursor:pointer">Sicherung importieren</label><input type="file" id="importBackupInput" accept=".json,application/json" style="display:none" onchange="importBackup(this)"></div></div>`+
 `<div class="surface tools-card"><h3>Originalkataloge</h3><p>${original} Ersatzteileinträge · ${totalHotspots} erkannte antippbare Markierungen · ${machines.length} Maschinen.</p>`+
 machines.map(m=>`<p style="margin:6px 0"><a href="${m.pdf}" target="_blank" rel="noopener">${htmlEscape(m.name)} – Original-PDF öffnen ↗</a></p>`).join('')+
 `</div><p class="version">Version 0.4 · Automatisch erkannte Nummern bitte vor einer Bestellung anhand des PDF-Katalogs prüfen. Nicht erkannte Nummern lassen sich über „Zuordnen“ nachtragen.</p>`;
}
function render(){
 if(!machines.length)return;
 const app=$('app');
 const views={home:cardCategories,models:cardModels,groups:cardGroups,group:cardGroup,search:searchView,saved:savedView,tools:toolsView};
 app.innerHTML=(views[state.screen]||cardCategories)();
 store();updateNav();onlineStatus();if(state.screen==='group')requestAnimationFrame(initDiagramGestures);
}
function getPrivateDb(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open('spareparts-private-v1',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('catalog');
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
function dbRead(db,key){return new Promise((resolve,reject)=>{const t=db.transaction('catalog','readonly');const r=t.objectStore('catalog').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function dbWriteAll(db,records){return new Promise((resolve,reject)=>{
 const t=db.transaction('catalog','readwrite');const s=t.objectStore('catalog');
 for(const [key,value] of records)s.put(value,key);
 t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);
});}
function base64ToBlob(b64,path){
 const bytes=atob(b64),u=new Uint8Array(bytes.length);
 for(let i=0;i<bytes.length;i++)u[i]=bytes.charCodeAt(i);
 const type=path.endsWith('.pdf')?'application/pdf':path.endsWith('.webp')?'image/webp':/\.jpe?g$/i.test(path)?'image/jpeg':path.endsWith('.png')?'image/png':'application/octet-stream';
 return new Blob([u],{type});
}
async function resetPrivateCatalog() {
 const button = $('resetCatalogButton');
 if (button.disabled || !confirm('Lokale Kataloge entfernen? Du brauchst anschließend deine private JSON-Datei für den erneuten Import. Merkliste und Zuordnungen bleiben gespeichert.')) return;
 button.disabled = true;
 try {
  const db = privateDb || (privateDb = await getPrivateDb());
  await new Promise((resolve, reject) => {
   const transaction = db.transaction('catalog', 'readwrite');
   transaction.oncomplete = resolve;
   transaction.onabort = () => reject(transaction.error);
   transaction.objectStore('catalog').clear();
  });
  for (const url of privateUrls) URL.revokeObjectURL(url);
  privateUrls.length = 0;
  machines = [];
  go('home');
  updateNav();
  privateImportScreen('Katalog zurückgesetzt. Wähle deine private JSON-Datei aus.');
 } catch {
  button.disabled = false;
  showToast('Der Katalog konnte nicht zurückgesetzt werden.');
 }
}
function privateImportScreen(message=''){
 $('app').innerHTML=`<div class="eyebrow">Privat · nur auf deinem iPhone</div><h1>Kataloge importieren</h1>
 <div class="surface tools-card"><p>Die App ist installiert, aber es sind noch keine Ersatzteilkataloge auf diesem Gerät gespeichert.</p>
 <p>Wähle <strong>SpareParts_v0.4_PRIVATE_62_KATALOGE_NICHT_HOCHLADEN.json</strong> in der Dateien-App aus. Sie wird lokal auf diesem Gerät gespeichert und <strong>nicht zu GitHub hochgeladen</strong>.</p>
 <label class="btn" for="privateCatalogFile">📂 Private Katalogdatei auswählen</label>
 <input id="privateCatalogFile" type="file" accept=".json,application/json" style="display:none" onchange="importPrivateCatalog(this)">
 <p class="hint" id="importStatus">${htmlEscape(message)}</p></div>
 <p class="muted">Wichtig: Prüfe die automatisch erkannten Nummern vor einer Bestellung. Sichere die private Datei extern, da iOS lokale Website-Daten entfernen kann.</p>`;
}
async function importPrivateCatalog(input){
 const file=input.files?.[0];if(!file)return;
 const status=$('importStatus');status.textContent='Datei wird geprüft und auf diesem iPhone gespeichert …';
 try{
  if(file.size>250000000)throw Error('Die Katalogdatei überschreitet die unterstützte Größe von 250 MB.');
  const payload=JSON.parse(await file.text());
  if(payload.format!=='SpareParts-Privatkatalog-1'||!Array.isArray(payload.models)||!payload.assets||!payload.models.length)throw Error('Keine gültige SpareParts-Katalogdatei.');
  const db=privateDb||(privateDb=await getPrivateDb());
  const paths=Object.keys(payload.assets);
  for(let i=0;i<paths.length;i+=12){
   const records=[];
   for(const path of paths.slice(i,i+12)){
    const b64=payload.assets[path];
    if(!/^(catalogs|diagrams|thumbnails)\/[A-Za-z0-9._-]+$/.test(path)||typeof b64!=='string')throw Error('Ungültiger Kataloginhalt.');
    records.push(['asset:'+path,base64ToBlob(b64,path)]);
    delete payload.assets[path];
   }
   await dbWriteAll(db,records);
   status.textContent=`Kataloge gespeichert: ${Math.min(i+12,paths.length)} von ${paths.length} Dateien …`;
  }
  await dbWriteAll(db,[['models',payload.models]]);
  await loadPrivateCatalog();showToast('Private Kataloge erfolgreich importiert.');
 }catch(e){privateImportScreen('Import fehlgeschlagen: '+e.message+' Bitte freien Speicherplatz prüfen.');}
}
async function loadPrivateCatalog(){
 const db=privateDb||(privateDb=await getPrivateDb());const catalog=await dbRead(db,'models');
 if(!Array.isArray(catalog)||!catalog.length)return false;
 for(const url of privateUrls)URL.revokeObjectURL(url);privateUrls.length=0;
 const assetPaths=new Set();
 for(const m of catalog){assetPaths.add(m.pdf);assetPaths.add(m.thumbnail);for(const g of m.groups)assetPaths.add(g.image);}
 const urls={};
 for(const path of assetPaths){
  const blob=await dbRead(db,'asset:'+path);
  if(!(blob instanceof Blob))throw Error('Katalogdatei fehlt: '+path);
  urls[path]=URL.createObjectURL(blob);privateUrls.push(urls[path]);
 }
 machines=catalog;
 for(const m of machines){m.pdf=urls[m.pdf];m.thumbnail=urls[m.thumbnail];for(const g of m.groups)g.image=urls[g.image];}
 render();return true;
}
async function initialize(){
 try{if(!await loadPrivateCatalog())privateImportScreen();}
 catch(e){privateImportScreen('Katalog konnte nicht geöffnet werden: '+e.message);}
}
initialize();onlineStatus();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}));}

// iOS Safari: avoid viewport zoom while keeping custom diagram zoom.
document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});
document.addEventListener('gesturechange',e=>e.preventDefault(),{passive:false});
document.addEventListener('gestureend',e=>e.preventDefault(),{passive:false});
