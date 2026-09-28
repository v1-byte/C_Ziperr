(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let cm,tabs=[],act=null,fs=13,ready=0;
const ext=p=>p.split('.').pop().toLowerCase();
const MODE={js:'javascript',mjs:'javascript',json:{name:'javascript',json:true},css:'css',html:'htmlmixed',htm:'htmlmixed',xml:'xml',svg:'xml'};
const LANG={js:'JavaScript',mjs:'JavaScript',json:'JSON',css:'CSS',html:'HTML',htm:'HTML',xml:'XML',svg:'SVG',atlas:'Atlas',txt:'Teks'};
const ICO={js:'🟨',mjs:'🟨',json:'🧾',css:'🎨',html:'🌐',htm:'🌐',png:'🖼',jpg:'🖼',jpeg:'🖼',webp:'🖼',gif:'🖼',svg:'🖼',mp3:'🔊',ogg:'🔊',wav:'🔊',m4a:'🔊'};
const ic=p=>ICO[ext(p)]||'📄';
const T=p=>tabs.find(t=>t.p===p);
const msg=m=>{$('#s-m').textContent=m;clearTimeout(msg.t);msg.t=setTimeout(()=>$('#s-m').textContent='',3000)};

function init(){
 if(ready)return;ready=1;
 cm=CodeMirror($('#cm'),{lineNumbers:true,theme:'material-darker',matchBrackets:true,autoCloseBrackets:true,styleActiveLine:true,foldGutter:true,
  gutters:['CodeMirror-linenumbers','CodeMirror-foldgutter'],indentUnit:2,tabSize:2,
  extraKeys:{'Ctrl-S':()=>save(),'Cmd-S':()=>save(),'Ctrl-P':()=>qo(),'Cmd-P':()=>qo(),'Ctrl-Shift-F':()=>pane('sr'),'Ctrl-H':'replace','Ctrl-G':'jumpToLine','Ctrl-/':'toggleComment','Cmd-/':'toggleComment'}});
 cm.on('cursorActivity',stat);
 cm.on('change',()=>{
  const t=T(act);if(!t||!t.doc)return;
  const d=!t.doc.isClean();if(d!==t.dirty){t.dirty=d;tabsR();mark();stat()}
  clearTimeout(init.j);
  if(ext(t.p)==='json')init.j=setTimeout(()=>{try{JSON.parse(t.doc.getValue());msg('')}catch(e){$('#s-m').textContent='JSON: '+e.message.slice(0,60)}},500);
 });
 if(innerWidth<700)$('#sb').classList.add('off');
 bind();
}
function bind(){
 $('#e-sb').onclick=()=>$('#sb').classList.toggle('off');
 $('#e-sv').onclick=()=>save();$('#e-sa').onclick=()=>saveAll();$('#e-qo').onclick=()=>qo();
 $('#e-fm').onclick=()=>{const t=T(act);if(!t||!t.doc)return;if(ext(t.p)!=='json')return msg('Format hanya untuk JSON');try{t.doc.setValue(JSON.stringify(JSON.parse(t.doc.getValue()),null,2));msg('Diformat')}catch(e){msg('JSON tidak valid: '+e.message.slice(0,50))}};
 $('#e-wr').onclick=()=>cm.setOption('lineWrapping',!cm.getOption('lineWrapping'));
 $('#e-fa').onclick=()=>fsz(-1);$('#e-fb').onclick=()=>fsz(1);
 $('#e-pv').onclick=()=>{saveAll();go('pv');window.pvShow&&pvShow();window.pvRun&&pvRun()};
 $$('.ab button').forEach(b=>b.onclick=()=>pane(b.dataset.v));
 $('#n-f').oninput=treeR;
 $('#tr').onclick=e=>{const r=e.target.closest('.fi');if(r)open(r.dataset.p)};
 $('#tb').onclick=e=>{const x=e.target.closest('[data-x]');if(x)return close(x.dataset.x);const t=e.target.closest('[data-p]');if(t)open(t.dataset.p)};
 $('#n-new').onclick=()=>{const n=(prompt('Path file baru (mis. assets/host/game.js)')||'').trim();if(!n||F.has(n))return;F.set(n,{p:n,d:new Uint8Array(),k:kind(n)});treeR();open(n)};
 $('#n-ren').onclick=()=>{const t=T(act);if(!t)return;const n=(prompt('Path baru',t.p)||'').trim();if(!n||n===t.p||F.has(n))return;save();const f=F.get(t.p);F.delete(t.p);f.p=n;f.k=kind(n);f.u=null;F.set(n,f);close(t.p,1);treeR();open(n)};
 $('#n-del').onclick=()=>{const t=T(act);if(!t||!confirm('Hapus '+t.p+'?'))return;F.delete(t.p);close(t.p,1);treeR()};
 $('#s-q').oninput=search;
 $('#s-r').onclick=e=>{const r=e.target.closest('[data-p]');if(r)open(r.dataset.p,+r.dataset.l)};
 $('#qi').oninput=qlist;
 $('#qi').onkeydown=e=>{if(e.key==='Escape')$('#qo').hidden=true;if(e.key==='Enter'){const f=$('#ql [data-p]');if(f){$('#qo').hidden=true;open(f.dataset.p)}}};
 $('#ql').onclick=e=>{const r=e.target.closest('[data-p]');if(r){$('#qo').hidden=true;open(r.dataset.p)}};
}
function open(p,line){
 init();const f=F.get(p);if(!f)return;let t=T(p);
 if(!t){t={p,dirty:false};if(f.k==='code')t.doc=CodeMirror.Doc(dec(f.d),MODE[ext(p)]||null);tabs.push(t)}
 act=p;view();
 if(line&&t.doc){cm.setCursor({line:line-1,ch:0});cm.scrollIntoView(null,150);cm.focus()}
 if(innerWidth<700)$('#sb').classList.add('off');
}
function view(){
 const t=T(act);tabsR();mark();
 $('#bc').textContent=act?act.split('/').join('  ›  '):'';
 if(!t){$('#cm').hidden=true;$('#vw2').hidden=false;$('#vw2').innerHTML='<div class="em">Buka file dari Explorer, atau tekan Ctrl+P.</div>';return stat()}
 const f=F.get(t.p);
 if(t.doc){$('#vw2').hidden=true;$('#cm').hidden=false;cm.swapDoc(t.doc);cm.refresh()}
 else{$('#cm').hidden=true;$('#vw2').hidden=false;$('#vw2').innerHTML=f.k==='img'?`<img src="${url(f)}" style="max-width:100%">`:f.k==='audio'?`<audio controls src="${url(f)}"></audio>`:`<div class="em">Biner · ${fmt(f.d.length)}</div>`}
 stat();
}
function stat(){
 const t=T(act),c=cm&&t&&t.doc?cm.getCursor():null;
 $('#s-pos').textContent=c?`Ln ${c.line+1}, Col ${c.ch+1}`:'';
 $('#s-lang').textContent=t?(LANG[ext(t.p)]||'Teks biasa'):'';
 $('#s-d').textContent=tabs.filter(x=>x.dirty).length+' belum disimpan';
}
function tabsR(){$('#tb').innerHTML=tabs.map(t=>`<div class="tab${t.p===act?' on':''}" data-p="${esc(t.p)}">${esc(t.p.split('/').pop())}${t.dirty?' ●':''}<span data-x="${esc(t.p)}">✕</span></div>`).join('')}
function close(p,force){
 const t=T(p);if(!t)return;
 if(t.dirty&&!force&&!confirm('Perubahan belum disimpan. Tutup tanpa menyimpan?'))return;
 const i=tabs.indexOf(t);tabs.splice(i,1);
 if(act===p)act=tabs.length?tabs[Math.min(i,tabs.length-1)].p:null;
 view();
}
function save(p){
 const t=T(p||act);if(!t||!t.doc)return;
 const f=F.get(t.p);if(!f)return;
 f.d=enc(t.doc.getValue());f.u=null;t.doc.markClean();t.dirty=false;tabsR();mark();stat();msg('Tersimpan: '+t.p.split('/').pop());
}
function saveAll(){tabs.forEach(t=>t.doc&&t.dirty&&save(t.p))}
function treeR(){
 const q=$('#n-f').value.trim().toLowerCase(),root={};
 [...F.keys()].filter(p=>!q||p.toLowerCase().includes(q)).sort().forEach(p=>{let n=root;const s=p.split('/');s.forEach((k,i)=>{if(i===s.length-1)n[k]=p;else n=n[k]=(n[k]&&typeof n[k]==='object')?n[k]:{}})});
 $('#tr').innerHTML=nodes(root,0,'',q)||'<div class="em">Kosong. Muat ZIP di Workspace.</div>';mark();
}
function nodes(n,d,pre,q){
 return Object.entries(n).sort(([a,x],[b,y])=>(typeof x==='string')-(typeof y==='string')||a.localeCompare(b)).map(([k,v])=>
  typeof v==='string'
   ?`<div class="fi" data-p="${esc(v)}" style="padding-left:${d*12+18}px">${ic(v)} ${esc(k)}</div>`
   :`<details${d<1||q||(act&&act.startsWith(pre+k+'/'))?' open':''}><summary style="padding-left:${d*12+4}px">${esc(k)}</summary>${nodes(v,d+1,pre+k+'/',q)}</details>`).join('');
}
function mark(){$$('#tr .fi').forEach(e=>{e.classList.toggle('on',e.dataset.p===act);const t=T(e.dataset.p);e.classList.toggle('dt',!!(t&&t.dirty))})}
function pane(v){
 $$('.ab button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
 $('#p-ex').hidden=v!=='ex';$('#p-sr').hidden=v!=='sr';$('#sb').classList.remove('off');
 if(v==='sr')$('#s-q').focus();
}
function search(){
 const q=$('#s-q').value,o=[];
 if(q.length<2){$('#s-r').innerHTML='';return}
 const ql=q.toLowerCase();
 for(const f of F.values()){
  if(f.k!=='code'||f.d.length>2e6)continue;
  const t=T(f.p),L=(t&&t.doc?t.doc.getValue():dec(f.d)).split('\n');
  for(let i=0;i<L.length&&o.length<200;i++){
   const j=L[i].toLowerCase().indexOf(ql);
   if(j>=0)o.push(`<div class="sr" data-p="${esc(f.p)}" data-l="${i+1}"><b>${esc(f.p.split('/').pop())}:${i+1}</b> ${esc(L[i].slice(Math.max(0,j-30),j+60).trim())}</div>`);
  }
 }
 $('#s-r').innerHTML=o.join('')||'<div class="em">Tidak ada hasil.</div>';
}
function qo(){init();$('#qo').hidden=false;$('#qi').value='';qlist();$('#qi').focus()}
function qlist(){
 const q=$('#qi').value.toLowerCase().replace(/\s/g,''),m=[];
 for(const p of F.keys()){const s=p.toLowerCase();let i=0;for(const c of q){i=s.indexOf(c,i);if(i<0)break;i++}if(i>=0)m.push(p);if(m.length>=15)break}
 $('#ql').innerHTML=m.map(p=>`<div class="fi" data-p="${esc(p)}">${ic(p)} ${esc(p)}</div>`).join('');
}
function fsz(d){fs=Math.min(22,Math.max(10,fs+d));$('#cm').style.fontSize=fs+'px';cm.refresh()}
window.edShow=()=>{init();treeR();view();cm.refresh()};
window.edOpen=open;window.edSaveAll=saveAll;window.edCur=()=>{const t=T(act);return t&&t.doc?{p:t.p,d:t.doc.getValue()}:null};
window.edReset=()=>{tabs=[];act=null;if(ready){treeR();view()}};
})();
