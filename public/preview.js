(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const O=location.origin,KEY=(h,p)=>O+'/__game/f/'+encodeURIComponent(h+p);
const MT={html:'text/html',htm:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css',json:'application/json',atlas:'text/plain',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',mp3:'audio/mpeg',ogg:'audio/ogg',wav:'audio/wav',m4a:'audio/mp4',mp4:'video/mp4',webm:'video/webm',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',wasm:'application/wasm'};
let miss=[],errs=[];
new BroadcastChannel('cz').onmessage=e=>{const d=String(e.data);if(d.startsWith('ERR ')){errs.push(d.slice(4));window.pvErr&&pvErr()}else{miss.push(d);$('#pm').textContent=miss.length;$('#pl').textContent=miss.slice(-40).join('\n')}};
window.pvShow=()=>{
 const hs=[...F.keys()].filter(p=>/^assets\/[^/]+\/.*\.html?$/i.test(p));
 const cur=$('#pe').value;
 $('#pe').innerHTML=hs.map(p=>`<option${p===cur?' selected':''}>${esc(p)}</option>`).join('')||'<option value="">(tidak ada HTML di assets/)</option>';
};
window.pvRun=async()=>{
 const sel=$('#pe').value;
 if(!sel)return showErr('Preview',['Tidak ada file HTML di assets/. Selesaikan download atau muat ZIP di Workspace.']);
 if(!('serviceWorker' in navigator)||!isSecureContext)return showErr('Preview',['Preview butuh HTTPS (alamat Workers/Pages), bukan file:// atau http biasa.']);
 try{
  const seg=sel.split('/'),host=seg[1],entry=seg.slice(2).map(encodeURIComponent).join('/');
  miss=[];errs=[];window.pvErr&&pvErr();$('#pl').textContent='';$('#pm').textContent='0';$('#pf').src='about:blank';
  const c=await caches.open('cz-game');
  for(const k of await c.keys())await c.delete(k);
  for(const f of F.values()){
   const m=f.p.match(/^assets\/([^/]+)(\/.*)$/);if(!m)continue;
   await c.put(KEY(m[1],m[2]),new Response(f.d,{headers:{'content-type':MT[f.p.split('.').pop().toLowerCase()]||'application/octet-stream'}}));
  }
  await c.put(O+'/__game/meta',new Response(JSON.stringify({host,rules:rules.map(({match,method,status,body,when})=>({match,method,status,body,when}))})));
  const reg=await navigator.serviceWorker.register('/__game/sw.js',{scope:'/__game/'});
  let sw=reg.active||reg.waiting||reg.installing;
  while(sw.state!=='activated')await new Promise(r=>sw.addEventListener('statechange',r,{once:true}));
  sw.postMessage('reset');
  $('#pf').src='/__game/'+entry;
 }catch(e){showErr('Preview gagal',[e.message])}
};
window.pvData=()=>({miss,errs});$('#pr').onclick=()=>pvRun();
$$('#pd button[data-w]').forEach(b=>b.onclick=()=>{$$('#pd button[data-w]').forEach(x=>x.classList.toggle('on',x==b));$('#pf').style.width=b.dataset.w});
})();
