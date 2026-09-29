(()=>{
const $=s=>document.querySelector(s);
const LS={get:k=>{try{return localStorage.getItem(k)||''}catch{return''}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}}};
const DEF={anthropic:['https://api.anthropic.com','claude-sonnet-5'],openai:['https://api.openai.com/v1','']};
const SYS='Kamu asisten yang menganalisis dan mengedit isi ZIP game web. Jawab bahasa Indonesia, ringkas. Untuk mengubah file, sertakan blok ```json {"edits":[{"path":"...","find":"teks persis","replace":"pengganti"}]} ```.';
window.kindOf=u=>/login|auth|token|session/i.test(u)?'login':/balance|wallet/i.test(u)?'balance':/spin|bet|play|action/i.test(u)?'spin':/init|config|state|load/i.test(u)?'state':'lain';

/* ===== Kelengkapan 6 lapisan ===== */
window.renderLy=()=>{
 const kel=F.get('kelengkapan.json');let src='';try{src=new URL(JSON.parse(dec(kel.d)).source).hostname}catch{}
 const c={html:0,js:0,data:0,img:0,font:0,audio:0,video:0,model:0,cdn:0,api:0},kinds={};
 F.forEach((f,p)=>{
  if(/^server\/.*\.json$/.test(p)){c.api++;try{const k=kindOf(JSON.parse(dec(f.d)).url||'');kinds[k]=(kinds[k]||0)+1}catch{}return}
  const m=p.match(/^assets\/([^/]+)\//);if(!m)return;
  const e=p.split('.').pop().toLowerCase();
  if(src&&m[1]!==src)c.cdn++;
  if(/^html?$/.test(e))c.html++;else if(/^(m?js|css|map)$/.test(e))c.js++;
  else if(/^(json|atlas|skel|xml|txt|csv)$/.test(e))c.data++;
  else if(/^(png|jpe?g|webp|gif|svg|ico|ktx2?|basis)$/.test(e))c.img++;
  else if(/^(woff2?|ttf|otf)$/.test(e))c.font++;
  else if(/^(mp3|ogg|wav|m4a|aac)$/.test(e))c.audio++;
  else if(/^(mp4|webm)$/.test(e))c.video++;
  else if(/^(glb|gltf|bin|wasm)$/.test(e))c.model++;
 });
 const row=(n,v)=>`<div class="it"><span>${v?'✅':'⚠️'} ${n}</span><small>${v}</small></div>`;
 $('#ly').innerHTML='<b>Kelengkapan</b>'+row('1 HTML',c.html)+row('2 JavaScript / CSS',c.js)+row('3 Asset: gambar / sprite / SVG',c.img)+row('&nbsp;&nbsp;&nbsp;Font',c.font)+row('&nbsp;&nbsp;&nbsp;Audio',c.audio)+row('&nbsp;&nbsp;&nbsp;Video',c.video)+row('&nbsp;&nbsp;&nbsp;3D / wasm / bin',c.model)+row('4 Data (JSON / atlas / manifest)',c.data)+row('5 CDN (domain lain)',c.cdn)+row('6 Server / API',c.api)+`<small>API: ${Object.entries(kinds).map(([k,v])=>k+' '+v).join(', ')||'-'}</small>`;
};

/* ===== Setelan ===== */
const cm=m=>{$('#k-msg').textContent=m};
window.cfgShow=()=>{const k=LS.get('cz_kind')||'anthropic';$('#k-kind').value=k;$('#k-base').value=LS.get('cz_base')||DEF[k][0];$('#k-model').value=LS.get('cz_model')||DEF[k][1];$('#k-key').value=LS.get('cz_key');$('#k-tok').value=LS.get('cz_tok');if($('#gh-owner')){$('#gh-owner').value=LS.get('cz_gh_owner');$('#gh-repo').value=LS.get('cz_gh_repo');$('#gh-ref').value=LS.get('cz_gh_ref')||'main';$('#gh-token').value=LS.get('cz_gh_token')}};
$('#k-kind').onchange=()=>{const k=$('#k-kind').value;$('#k-base').value=DEF[k][0];$('#k-model').value=DEF[k][1]};
$('#k-save').onclick=()=>{[['kind','k-kind'],['base','k-base'],['model','k-model'],['key','k-key'],['tok','k-tok']].forEach(([a,b])=>LS.set('cz_'+a,$('#'+b).value.trim()));cm('Tersimpan')};
if($('#gh-save'))$('#gh-save').onclick=()=>{[['gh_owner','gh-owner'],['gh_repo','gh-repo'],['gh_ref','gh-ref'],['gh_token','gh-token']].forEach(([a,b])=>LS.set('cz_'+a,$('#'+b).value.trim()));$('#gh-msg').textContent='GitHub tersimpan'};
$('#k-test').onclick=async()=>{$('#k-save').click();cm('…');try{cm('OK: '+(await ai('Balas satu kata: siap','')).slice(0,40))}catch(e){cm(e.message)}};
$('#k-apply').onclick=()=>{
 const a=$('#k-from').value,b=$('#k-to').value;if(!a)return;
 window.edSaveAll&&edSaveAll();let n=0;
 F.forEach(f=>{if(f.k!='code')return;const t=dec(f.d);if(t.includes(a)){f.d=enc(t.split(a).join(b));n++}});
 rules.forEach(r=>{r.body=String(r.body||'').split(a).join(b)});
 window.edReset&&edReset();cm(n+' file diubah');
};

/* ===== Panggilan AI (Anthropic / OpenAI-compatible) ===== */
async function ai(user,system,hist=[]){
 const k=LS.get('cz_kind')||'anthropic',base=(LS.get('cz_base')||DEF[k][0]).replace(/\/$/,''),key=LS.get('cz_key'),model=LS.get('cz_model')||DEF[k][1];
 if(!key)throw new Error('Isi API key di menu 🔑 dulu');
 const msgs=[...hist,{role:'user',content:user}];
 const r=k=='anthropic'
  ?await fetch(base+'/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model,max_tokens:4000,...(system?{system}:{}),messages:msgs})})
  :await fetch(base+'/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+key},body:JSON.stringify({model,messages:[...(system?[{role:'system',content:system}]:[]),...msgs]})});
 const j=await r.json();if(!r.ok)throw new Error((j.error&&(j.error.message||j.error))||'HTTP '+r.status);
 return k=='anthropic'?j.content.map(x=>x.text||'').join(''):j.choices[0].message.content;
}
function apply(txt){
 const m=txt.match(/```json\s*([\s\S]*?)```/);if(!m)return'Tidak ada blok edit';
 let n=0;
 try{JSON.parse(m[1]).edits.forEach(e=>{const f=F.get(e.path);if(!f||f.k!='code')return;const t=dec(f.d);if(t.includes(e.find)){f.d=enc(t.replace(e.find,()=>e.replace));n++}})}catch{return'JSON edit tidak valid'}
 return n+' edit diterapkan';
}

/* ===== Chat AI (Workspace) ===== */
let HS=[],last='';
const cl=$('#cl'),add=(w,t)=>cl.insertAdjacentHTML('beforeend',`<div class="it"><b>${w}</b>&nbsp;<span style="white-space:pre-wrap">${esc(t)}</span></div>`);
$('#cs').onclick=async()=>{
 const q=$('#ci').value.trim();if(!q)return;$('#ci').value='';add('Kamu',q);
 let ctx='Daftar file:\n'+[...F.keys()].slice(0,200).join('\n');
 const cur=$('#cf').checked&&window.edCur&&edCur();if(cur)ctx+=`\n\nFile terbuka ${cur.p}:\n`+cur.d.slice(0,12000);
 const u=ctx+'\n\nPermintaan: '+q;add('AI','…');
 try{const a=await ai(u,SYS,HS);HS.push({role:'user',content:u},{role:'assistant',content:a});HS=HS.slice(-6);last=a;cl.lastChild.remove();add('AI',a)}
 catch(e){cl.lastChild.remove();add('Error',e.message)}
 cl.scrollTop=1e9;
};
$('#ce').onclick=()=>{window.edSaveAll&&edSaveAll();const r=apply(last);window.edReset&&edReset();add('Sistem',r)};

/* ===== Preview: error + perbaikan ===== */
window.pvErr=()=>{const d=pvData();$('#pcnt').textContent=d.errs.length;$('#perr').textContent=d.errs.slice(-30).join('\n')};
const suf=(a,b)=>{let i=0;while(i<a.length&&i<b.length&&a[a.length-1-i]==b[b.length-1-i])i++;return i};
$('#pfx').onclick=()=>{
 const {miss}=pvData(),host=$('#pe').value.split('/')[1]||'',out=[];let n=0;
 for(const s of new Set(miss)){
  const [meth,u]=s.split(' ');let x;try{x=new URL(u)}catch{continue}
  const same=x.origin===location.origin,h=same?host:x.host,pth=decodeURIComponent(same?x.pathname.replace(/^\/__game/,''):x.pathname),full='assets/'+h+pth,base=pth.split('/').pop().toLowerCase();
  if(F.has(full))continue;
  if(/\.[a-z0-9]{2,5}$/i.test(base)){
   const c=[...F.keys()].filter(k=>k.startsWith('assets/')&&k.split('/').pop().toLowerCase()==base);
   if(c.length){const b=c.sort((a,z)=>suf(z,pth)-suf(a,pth))[0];F.set(full,{...F.get(b),p:full,u:null});out.push('alias '+pth+' ← '+b);n++}else out.push('tidak ada di ZIP: '+pth);
  }else if(!rules.some(r=>r.match===pth)){rules.push({match:pth,method:meth,status:200,body:'{}',manual:1});out.push('stub API '+meth+' '+pth);n++}
 }
 $('#prep').textContent=out.join('\n')||'Tidak ada yang bisa diperbaiki otomatis';
 if(n)pvRun();
};
$('#pai').onclick=async()=>{
 const {miss,errs}=pvData(),sel=$('#pe').value,f=F.get(sel);$('#prep').textContent='AI menganalisis…';
 try{
  const q=`Game web di preview bermasalah.\nEntry: ${sel}\nError JS:\n${errs.slice(-15).join('\n')}\nRequest 404:\n${miss.slice(-25).join('\n')}\nFile (${F.size}):\n${[...F.keys()].slice(0,120).join('\n')}\nAwal entry:\n${f?dec(f.d).slice(0,3000):''}\nBalas HANYA satu blok \`\`\`json {"edits":[{"path","find","replace"}],"rules":[{"match","method","status","body"}]} \`\`\``;
  const a=await ai(q,SYS),m=a.match(/```json\s*([\s\S]*?)```/);$('#prep').textContent=a;
  if(m&&confirm('Terapkan perbaikan AI dan jalankan ulang?')){
   const j=JSON.parse(m[1]);(j.rules||[]).forEach(r=>rules.push({...r,manual:1}));
   apply('```json\n'+JSON.stringify({edits:j.edits||[]})+'\n```');pvRun();
  }
 }catch(e){$('#prep').textContent='Gagal: '+e.message}
};
})();
