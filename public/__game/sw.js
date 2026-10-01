const O=self.location.origin,BASE=new URL('./',self.location.href).pathname,GAME=BASE,K=(h,p)=>O+GAME+'f/'+encodeURIComponent(h+p),bc=new BroadcastChannel('cz');
let meta=null;
async function M(){if(!meta){const r=await(await caches.open('cz-game')).match(O+GAME+'meta');meta=r?await r.json():{host:'',rules:[]}}return meta}
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('message',e=>{if(e.data==='reset')meta=null});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(u.origin===O&&(u.pathname===GAME+'sw.js'||u.pathname.startsWith(GAME+'f/')||u.pathname===GAME+'meta'))return;
 e.respondWith((async()=>{
  const m=await M(),same=u.origin===O;
  let p;try{p=decodeURIComponent(u.pathname)}catch{p=u.pathname}
 if(same&&p.startsWith(GAME))p=p.slice(GAME.length);
  const host=same?m.host:u.host,meth=e.request.method;
  const bd=meth==='GET'?'':await e.request.clone().text().catch(()=>''),cand=m.rules.filter(r=>r.match&&p.endsWith(r.match)&&(!r.when||bd.includes(r.when))).sort((a,b)=>!!b.when-!!a.when),rule=cand.find(r=>r.method===meth)||cand[0];
  if(rule)return new Response(rule.body,{status:+rule.status||200,headers:{'content-type':'application/json','access-control-allow-origin':'*'}});
  const c=await caches.open('cz-game');
  const r=await c.match(K(host,p))||(p.endsWith('/')?await c.match(K(host,p+'index.html')):null);
  if(r){
  if((r.headers.get('content-type')||'').includes('text/html')){const t=await r.clone().text(),h='<script>addEventListener("error",e=>new BroadcastChannel("cz").postMessage("ERR "+e.message+" @"+(e.filename||"").split("/").pop()+":"+e.lineno));addEventListener("unhandledrejection",e=>new BroadcastChannel("cz").postMessage("ERR "+(e.reason&&e.reason.message||e.reason)))</script>';return new Response(/<head[^>]*>/i.test(t)?t.replace(/<head[^>]*>/i,x=>x+h):h+t,{headers:r.headers})}
  const rg=e.request.headers.get('range'),mm=rg&&/bytes=(\d+)-(\d*)/.exec(rg);
  if(mm){const b=await r.clone().arrayBuffer(),s=+mm[1],en=mm[2]?+mm[2]:b.byteLength-1;return new Response(b.slice(s,en+1),{status:206,headers:{'content-type':r.headers.get('content-type')||'application/octet-stream','content-range':`bytes ${s}-${en}/${b.byteLength}`,'accept-ranges':'bytes'}})}
  return r}
  bc.postMessage(meth+' '+e.request.url);
  return new Response('miss',{status:404});
 })());
});
