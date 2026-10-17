================================================================================
CATATAN FULL FINAL V2 - 1 SAMPAI 18 LENGKAP - EAJZZXHRO 74 100% OFFLINE
REPO: v1-byte/C_Ziperr | TOTAL 18 BAGIAN | SEKALI JADI SELESAI
================================================================================

--------------------------------------------------------------------------------
0. KONSEP DASAR - KENAPA GAME INI SUSAH OFFLINE
--------------------------------------------------------------------------------
Game m.eajzzxhro.com/74/ itu 3 lapis, bukan 1 file:
1. CLIENT: index.html + assets/ (JS, PNG, JPG, MP3, OGG, JSON, atlas, skel) -> bisa offline
2. SESSION TOKEN: ot=ca709..., __hv=..., __sv=..., btt, or -> umur 5 menit, anti-tamper, WAJIB HAPUS
3. SERVER LOGIC: /api/balance, /api/spin, /api/result, /api/history -> hitung menang/kalah, WAJIB GANTI

Kalau lo cuma download HTML, game blank karena nunggu server lama yang lo blokir.
Tujuan C_Ziperr: ambil CLIENT 100%, buang SESSION, ganti SERVER dengan punya lo.

--------------------------------------------------------------------------------
1. COLLECT - CARA AMBIL FILE YANG BENAR (PALING SERING GAGAL)
--------------------------------------------------------------------------------
Game ini total >60MB, >250 file, load lazy (audio & atlas load pas spin, bukan pas awal).
JANGAN pakai Collect biasa di Worker (limit Cloudflare 25MB) -> pasti corrupt.

WAJIB pakai Mode file besar · GitHub runner:
a. Prasyarat di wrangler.jsonc:
   "kv_namespaces": [{ "binding": "GC_HISTORY", "id": "ID_KV_LO" }],
   "r2_buckets": [{ "binding": "ASSETS_BUCKET", "bucket_name": "c-zipper-assets" }]
b. Set secret: npx wrangler login + npx wrangler secret put GITHUB_TOKEN -> token classic scope repo, workflow
c. Di public/index.html -> pilih "Mode file besar · GitHub runner" -> paste URL lengkap game
d. Klik Collect -> trigger workflow di github.com/v1-byte/C_Ziperr/actions -> tunggu max 60 menit
e. Cek header: X-GC-Session-Id harus ada, X-GC-Still-Missing harus 0, X-GC-Game-Files jumlah file
   Jika Still-Missing >0 -> ulangi multi-pass 400x12

Alasan runner: bypass limit 25MB, retry 3x kalau 429, handle 250 URL/pass x 8 pass.

--------------------------------------------------------------------------------
2. TOKEN & DRM - APA YANG WAJIB DIBUANG
--------------------------------------------------------------------------------
URL: https://m.eajzzxhro.com/74/index.html?ot=ca709...&__hv=...&__sv=...
Token wajib strip: ot= (one-time 5 menit), __hv= (hash), __sv= (signature), btt=2, or=, l=en

Kenapa wajib: Masuk protected resource DRM/session di SOP C_Ziperr. Kalau kebawa, protected-resource-report.json BLOCKED dan ZIP tidak boleh rilis. Jangan commit token asli, pakai OT_PLACEHOLDER.

Fix src/index.js: function stripEajzzToken(url){ const u=new URL(url); ['ot','__hv','__sv','btt','or'].forEach(k=>u.searchParams.delete(k)); return u.toString(); }
Fix hgd/core/adclean.py: PROTECTED_PATTERNS tambah r"ot=[a-f0-9]{32}", r"__hv=...", r"__sv=..."

Test: python tools/test_adclean.py -> "Stripped 3 tokens, 0 leaked" PASS

--------------------------------------------------------------------------------
3. KLASIFIKASI & REWRITE PATH
--------------------------------------------------------------------------------
Setelah collect, ekstrak ZIP:
- KETERANGAN.md & keterangan.json -> metadata
- assets/ -> >200 file -> KEEP
- server/ -> snapshot API lama -> DELETE TOTAL

Rewrite:
- https://m.eajzzxhro.com/74/static/ -> ./assets/static/
- //m.eajzzxhro.com/static/ -> ./assets/static/
- /74/assets/ -> ./assets/
- CSS url() dan JS import() absolut -> relative

Frame-buster neutralize (wajib):
Ganti if (top != self) top.location=self.location jadi if (false) // neutralized

Auto-click Play:
const btn=document.querySelector('.btn-play, #start-game, [class*=play], button'); if(btn) btn.click();

--------------------------------------------------------------------------------
4. KELENGKAPAN - SYARAT MUTLAK 100% OFFLINE
--------------------------------------------------------------------------------
Workspace -> Load ZIP -> kelengkapan.json WAJIB 100 semua:
- Symbols: 5 simbol + wild + scatter + bonus
- Paytable: mapping 3-5 simbol menang berapa
- Audio events: BGM, Spin Start, Reel Stop, Win Small/Big, Bonus, UI Click
- Atlas/Spine: .atlas + .png + .skel + .json
- Features: free spin, bonus, jackpot
- Engine: Phaser/Pixi/Unity

Jika <100, klik Auto Repair Deep: Path index, attr/srcset, import, JSON walk, offline bootstrap, multi-pass 250x8, Layer 3 runtime lazy.

JANGAN lanjut ke custom API kalau belum 100. Game bisu/animasi patah.

--------------------------------------------------------------------------------
5. CUSTOM API - GANTI SERVER LAMA DENGAN SERVER BARU (INTI)
--------------------------------------------------------------------------------
Lama -> Baru:
GET m.eajzzxhro.com/74/api/balance -> /api/game/balance
POST /api/spin -> /api/game/spin
GET /api/history -> /api/game/history

Struktur C_Ziperr:
native-game/api/spin.js -> RNG + ledger + idempotency
native-game/api/balance.js -> baca ledger
native-game/api/index.js -> router /api/game/*
native-game/config/host.json -> {original_host, new_host, api_prefix}
native-game/manifests/asset-manifest.json -> list asset baru

Logic spin.js server-authoritative:
- Idempotency: header X-Idempotency-Key = crypto.randomUUID(), simpan di KV GC_HISTORY TTL 24 jam
- RNG: crypto.getRandomValues, seeded dari sessionId+spinCount, bukan Math.random() client
- Ledger: {balance, spinCount, totalWin, totalBet, lastSpin} di GC_HISTORY key ledger:sessionId TTL 7 hari
- Paytable buat sendiri, jangan copy 100% asli, contoh WILD 3=10 4=50 5=200
- Reels: 5 reel x 7 simbol, ambil 3 visible per reel

Frontend: fetch('/api/game/spin', {method:'POST', headers:{'X-Idempotency-Key':crypto.randomUUID()}, body:JSON.stringify({bet:100})})

Keamanan: Jangan copy private key/cookie asli, pakai native substitute, release gate BLOCKED kalau token asli kebawa.

--------------------------------------------------------------------------------
6. SITE PLUGIN KHUSUS EAJZZXHRO.COM - CODE LENGKAP
--------------------------------------------------------------------------------
File: hgd/core/site_plugins.py atau src/plugins/eajzzxhro.py
class EajzzxhroPlugin:
  DOMAIN="eajzzxhro.com"; PATH_PREFIX="/74/"; STRIP_PARAMS=["ot","__hv","__sv","btt","or"]
  def can_handle(url): return DOMAIN in url and PATH_PREFIX in url
  def clean_url(url): hapus STRIP_PARAMS
  def rewrite_html(html): rewrite //m.eajzzxhro.com/static/ -> ./assets/, neutralize frame-buster, inject auto-click
  def get_asset_patterns(): [r'/74/assets/.*\.(js|json|png|mp3|atlas|skel)']

Registrasi PLUGINS=[EajzzxhroPlugin(), ...]
Worker src/index.js: function eajzzxhroPlugin(url,html){ strip token; rewrite; neutralize; return html; }

--------------------------------------------------------------------------------
7. HOSTING SERVER SENDIRI - DEPLOY LENGKAP
--------------------------------------------------------------------------------
Prasyarat: wrangler login, KV gc-history, R2 c-zipper-assets opsional, wrangler.jsonc set kv_namespaces, secret GITHUB_TOKEN
Deploy: 1) npm run validate:native-package PASS 2) npm run package:native -> artifacts/native/*.zip 3) npx wrangler deploy -> c-zipper.corelink-ai.workers.dev 4) curl /api/health -> kv:active 5) Test game /native-game/?game=eajzzxhro-74 matikan internet tetap jalan 6) Custom domain Dashboard -> Domains & Routes
VPS alternatif: python3 -m http.server 4173 --directory native-game / pm2 serve
JANGAN upload ZIP masih ada server/ api asli, jangan upload token asli.

--------------------------------------------------------------------------------
8. VALIDASI FINAL - CHECKLIST 1-11
--------------------------------------------------------------------------------
[ ] Collect GitHub runner X-GC-Still-Missing=0
[ ] kelengkapan.json 100 (Symbols, Paytable, Audio, Atlas, Features, Engine)
[ ] protected-resource-report.json 0 leaked
[ ] server/ folder dihapus
[ ] Auto Repair Deep jalan, no path absolut eajzzxhro.com
[ ] native-game/api/spin.js, balance.js, index.js ada
[ ] npm run validate:native-package PASS
[ ] Test offline airplane mode DevTools Network 0 request eajzzxhro.com
[ ] Test API spin 20x idempotent
[ ] Packaging artifacts/native/*.zip ada

--------------------------------------------------------------------------------
9. YANG KURANG DI REPO C_ZIPERR SAAT INI (PRIORITAS FIX)
--------------------------------------------------------------------------------
Sudah ada: Collect GH Actions, KV, klasifikasi, SW+asset-proxy, native shell, validate
Belum: 1) Site Plugin eajzzxhro.com 2) Engine-specific repair skill/SKILL.md 3) Custom API scaffold 4) Protected report pattern 5) GUI checkbox Strip token 6) Test tests/eajzzxhro-74.test.mjs

--------------------------------------------------------------------------------
10. TROUBLESHOOTING UMUM GAME 74
--------------------------------------------------------------------------------
- Audio bisu: .mp3 lazy load pas spin, multi-pass 300x8
- Atlas patah: .atlas region tidak parse, parser LibGDX
- Unity data.br gagal: layer 3 runtime lazy Brotli
- Frame blank: frame-buster belum neutralize
- Spin gagal: masih manggil api lama, cek Network
- Balance minus: ledger tidak idempotent
- ZIP corrupt >25MB: collect via Worker biasa, wajib runner

--------------------------------------------------------------------------------
11. LEGAL & SOP C_ZIPERR
--------------------------------------------------------------------------------
Hanya untuk game client-side yang resource memang dikirim ke browser. Tidak untuk bypass DRM, anti-cheat, login orang lain, multiplayer tanpa server resmi. API baru native substitute non-monetary demo. Tidak klaim 100% offline kalau kelengkapan <100.

================================================================================
LANJUTAN V2 - TAMBAHAN 12 SAMPAI 18 - YANG BIKIN 100% BENERAN
================================================================================

--------------------------------------------------------------------------------
12. WASM & BROTLI LOADER - WAJIB UNTUK GAME 74
--------------------------------------------------------------------------------
Game pakai Unity WebGL / Phaser WASM: 74.wasm.br, 74.data.br, 74.loader.js fetch streaming. Kalau tidak handle, offline blank.

Fix di shell/index.html sebelum loader:
<script>
const originalFetch=window.fetch;
window.fetch=async (url, opts)=>{
  if(typeof url==='string' && url.endsWith('.br')){
    const res=await originalFetch(url,opts);
    const buf=await res.arrayBuffer();
    const decompressed=await decompressBrotli(new Uint8Array(buf));
    return new Response(decompressed, {headers:res.headers});
  }
  return originalFetch(url,opts);
};
</script>
Tambah assets/brotli-decoder.js dari google/brotli
Cek Network filter .wasm harus 200 dari ./assets/, bukan eajzzxhro.com

--------------------------------------------------------------------------------
13. SERVICE WORKER OFFLINE 100% - PRE-CACHE SEMUA ASSETS
--------------------------------------------------------------------------------
Tanpa SW, refresh offline = 404. Buat native-game/sw.js:
const CACHE='eajzzxhro-74-v2'; const MANIFEST_URL='./manifests/asset-manifest.json';
self.addEventListener('install', e=>{ e.waitUntil(fetch(MANIFEST_URL).then(r=>r.json()).then(files=>caches.open(CACHE).then(c=>c.addAll(files)))); self.skipWaiting(); });
self.addEventListener('fetch', e=>{ e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request))); });
Daftar di index.html: if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
File manifests/asset-manifest.json berisi 250+ path. Generate: python scripts/generate_manifest.py --dir native-game/assets

--------------------------------------------------------------------------------
14. WEBSOCKET & XHR HIJACK - GAME PAKAI WS BUKAN CUMA FETCH
--------------------------------------------------------------------------------
Game pakai WebSocket wss://m.eajzzxhro.com/74/ws untuk spin real-time, bukan cuma fetch.

Wajib hijack di rewrite_html:
const origOpen=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(m,url){ if(url.includes('eajzzxhro.com')) arguments[1]=url.replace(/https:\/\/m\.eajzzxhro\.com\/74\/api\/.*/,'/api/game/spin'); return origOpen.apply(this,arguments); };
const OrigWS=window.WebSocket;
window.WebSocket=function(url,proto){ if(url.includes('eajzzxhro.com')){ console.log('[EAJZZ] WS hijacked'); return {send:(data)=>fetch('/api/game/spin',{method:'POST',body:data,headers:{'X-Idempotency-Key':crypto.randomUUID()}}).then(r=>r.json()).then(j=>this.onmessage&&this.onmessage({data:JSON.stringify(j)})), close:()=>{}, addEventListener:(e,cb)=>{if(e==='message') this.onmessage=cb;}}; } return new OrigWS(url,proto); };

Jika tidak, tab WS di DevTools masih koneksi ke eajzzxhro.com = belum 100% offline.

--------------------------------------------------------------------------------
15. AUDIO UNLOCK - CHROME BLOKIR AUTOPLAY
--------------------------------------------------------------------------------
Offline bisu kalau tidak unlock. Tambah di shell/index.html:
function unlockAudio(){ if(window.Howl && Howler.ctx && Howler.ctx.state==='suspended') Howler.ctx.resume(); if(window.PIXI && PIXI.sound) PIXI.sound.unmuteAll(); document.removeEventListener('click',unlockAudio); }
document.addEventListener('click',unlockAudio); document.addEventListener('touchstart',unlockAudio);
const overlay=document.createElement('div'); overlay.innerHTML='<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;color:white;font-size:24px;cursor:pointer">TAP TO START GAME</div>'; overlay.onclick=()=>{unlockAudio(); overlay.remove();}; document.body.appendChild(overlay);

Test: Matikan WiFi -> buka game -> tap overlay -> suara spin bunyi.

--------------------------------------------------------------------------------
16. LOCALSTORAGE MIGRASI & SAVE STATE
--------------------------------------------------------------------------------
Balance/history simpan di localStorage key eajzzxhro_*. Pas pindah domain, localStorage kosong = balance 0.

Migrasi:
(function migrateSave(){ const oldKeys=Object.keys(localStorage).filter(k=>k.includes('eajzzxhro')||k.includes('74')); oldKeys.forEach(k=>{ const newKey=k.replace('eajzzxhro','c-ziperr').replace('74','game'); if(!localStorage.getItem(newKey)) localStorage.setItem(newKey,localStorage.getItem(k)); }); if(!localStorage.getItem('ledger:player1')){ fetch('/api/game/balance?sessionId=player1').then(r=>r.json()).then(d=>localStorage.setItem('ledger:player1',JSON.stringify(d))); } })();

Backup ke IndexedDB pakai localForage biar tidak hilang pas clear cache.

--------------------------------------------------------------------------------
17. FILE WAJIB YANG BELUM DISEBUT - START-GAME.SH & MANIFEST
--------------------------------------------------------------------------------
File native-game/start-game.sh: #!/bin/bash echo "[C_Ziperr V2] Starting 100% offline server..." python3 -m http.server 4173 --directory "$(dirname "$0")"
chmod +x native-game/start-game.sh

File native-game/manifests/asset-manifest.json: { "version":"v2-final", "game":"eajzzxhro-74", "totalFiles":267, "offlineReady":true, "server":"custom /api/game/*", "files":["./assets/static/74.loader.js","./assets/static/74.wasm","./assets/sounds/spin.mp3"] }

File native-game/config/host.json lengkap: { "original_host":"m.eajzzxhro.com", "new_host":"c-zipper.corelink-ai.workers.dev", "api_prefix":"/api/game", "strip_tokens":["ot","__hv","__sv","btt","or"], "wasm_brotli":true, "websocket_hijack":true, "service_worker":true, "audio_unlock":true, "offlineReady":true, "version":"v2-final-100-percent" }

--------------------------------------------------------------------------------
18. ANTI-DEBUG & OBFUSCATION NEUTRALIZE
--------------------------------------------------------------------------------
Game ada proteksi anti-devtools: setInterval(()=>{debugger;},100); console.clear reload.

Neutralize di rewrite_html:
html=html.replace(/debugger\s*;/g,'//debugger neutralized;').replace(/console\.clear\s*\(\s*\)/g,'//console.clear neutralized').replace(/setInterval\s*\(\s*\(\s*\)\s*=>\s*\{\s*debugger\s*\}/g,'setInterval(()=>{},9999999)').replace(/__hv\s*&&\s*__hv\.length/g,'false && __hv.length')

Tambah: window.console.clear=()=>{};

Test: Buka DevTools game tetap jalan tidak reload.

================================================================================
CHECKLIST FINAL V2 - 18 POINT - 100% OFFLINE TANPA UPDATE LAGI
================================================================================
[ ] 1 Collect GitHub runner Still-Missing=0
[ ] 2 Token strip ot/__hv/__sv 0 leaked
[ ] 3 Klasifikasi assets KEEP server DELETE rewrite path
[ ] 4 Kelengkapan.json 100
[ ] 5 Custom API /api/game/spin idempotent ledger
[ ] 6 Site Plugin EajzzxhroPlugin ada
[ ] 7 Hosting wrangler deploy PASS
[ ] 8 Validasi 1-11 PASS
[ ] 9 Fix repo P1-P3 selesai
[ ] 10 Troubleshooting umum clear
[ ] 11 Legal SOP clear
[ ] 12 WASM .br load offline 200 dari ./assets/
[ ] 13 Service Worker ter-register CacheStorage 250 file refresh offline jalan
[ ] 14 WebSocket hijack tab WS 0 koneksi ke eajzzxhro.com semua ke /api/game/
[ ] 15 Audio unlock overlay tap suara bunyi offline
[ ] 16 localStorage migrasi balance tidak 0 pas pindah domain
[ ] 17 start-game.sh executable asset-manifest.json 250 file host.json v2
[ ] 18 Anti-debug neutralize buka DevTools tidak reload

Jika 18 PASS = 100% FULL SELESAI, SEKALI JADI TIDAK PERLU UPDATE LAGI.

================================================================================
END - CATATAN FULL 1-18 FINAL
================================================================================


TAMBAHAN LEVEL TERATAS 19-30 - YANG BIKIN 100% SEMPURNA TANPA CELAH
================================================================================

--------------------------------------------------------------------------------
19. CSP & CORS HEADER - BLOKIR TOTAL KE EAJZZXHRO.COM
--------------------------------------------------------------------------------
Biar 100% offline, tambah di src/index.js Worker atau _headers file:

Headers:
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; connect-src 'self' /api/game/*; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'self'
X-Frame-Options: SAMEORIGIN
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp

Tambah di public/_headers atau wrangler.jsonc headers:
{
  "/native-game/*": {
    "headers": {
      "Content-Security-Policy": "default-src 'self'; connect-src 'self' /api/game/*",
      "X-Frame-Options": "SAMEORIGIN"
    }
  }
}

Efek: Browser akan BLOCK otomatis kalau JS masih coba fetch ke eajzzxhro.com -> kelihatan langsung di console CSP violation, gampang debug.

--------------------------------------------------------------------------------
20. INTEGRITY HASH & SUBRESOURCE INTEGRITY (SRI) - CEGAH FILE CORRUPT
--------------------------------------------------------------------------------
Game 74 sering corrupt pas collect karena file besar. Wajib hash SHA256 semua assets.

Buat script: scripts/generate_sri.py
import hashlib, json, os
manifest={}
for root,_,files in os.walk('native-game/assets'):
  for f in files:
    path=os.path.join(root,f)
    h=hashlib.sha256(open(path,'rb').read()).hexdigest()
    manifest[path]=f"sha256-{h}"

Simpan ke native-game/manifests/integrity.json
Isi: { "./assets/static/74.wasm": "sha256-abc123..." }

Di loader, cek:
fetch(url).then(r=>r.arrayBuffer()).then(buf=>{
  const hash=sha256(buf);
  if(hash!==manifest[url]) throw new Error('Corrupt '+url);
})

Cek validasi: npm run validate:native-package akan cek hash ini.

--------------------------------------------------------------------------------
21. PERFORMANCE OPTIMIZATION - LOAD 60MB JADI CEPAT
--------------------------------------------------------------------------------
60MB kalau load sekaligus = 20 detik blank. Wajib lazy + progressive.

a. Code splitting:
- 74.loader.js load dulu (kecil, 50KB)
- 74.wasm load streaming: WebAssembly.instantiateStreaming(fetch('./assets/74.wasm'))
- Atlas & PNG load on-demand: hanya reel yang visible dulu
- Audio load deferred: BGM dulu, SFX pas spin

b. Compression:
- WASM Brotli sudah handle di No 12, tapi tambah Gzip fallback
- PNG -> WebP convert untuk offline lebih kecil: python scripts/convert_png_to_webp.py
- MP3 -> OGG lebih kecil 30%

c. Preload critical:
<link rel="preload" href="./assets/static/74.wasm" as="fetch" crossorigin>
<link rel="preload" href="./assets/images/symbols.png" as="image">

Test: Lighthouse -> Performance harus >90 meski offline.

--------------------------------------------------------------------------------
22. OFFLINE ANALYTICS & DEBUG PANEL - LIHAT APA YANG MASIH MANGIL SERVER LAMA
--------------------------------------------------------------------------------
Buat file: native-game/debug-panel.js
(function(){
  const panel=document.createElement('div');
  panel.id='c-ziperr-debug';
  panel.style='position:fixed;bottom:0;left:0;width:100%;background:rgba(0,0,0,0.9);color:lime;padding:10px;font-family:monospace;z-index:99999;max-height:200px;overflow:auto';
  panel.innerHTML='<b>[C_Ziperr Debug] Offline Check</b><div id="debug-log"></div>';
  document.body.appendChild(panel);
  
  const log=(msg)=>{ document.getElementById('debug-log').innerHTML+=msg+'<br>'; console.log(msg); };
  
  // Intercept semua fetch
  const origFetch=window.fetch;
  window.fetch=(...args)=>{
    const url=args[0].toString();
    if(url.includes('eajzzxhro.com')){ log('❌ BLOCKED: '+url); return Promise.reject('Blocked by C_Ziperr'); }
    else { log('✅ OK: '+url); }
    return origFetch(...args);
  };
  
  // Intercept WebSocket
  const OrigWS=window.WebSocket;
  window.WebSocket=function(url){ if(url.includes('eajzzxhro.com')) log('❌ WS BLOCKED: '+url); return new OrigWS(url); };
  
  // Cek kelengkapan
  fetch('./manifests/asset-manifest.json').then(r=>r.json()).then(m=>log('📦 Total files: '+m.totalFiles+' OfflineReady: '+m.offlineReady));
})();
Include di index.html: <script src="./debug-panel.js"></script>

Pas test airplane mode, panel harus hanya ✅ OK, tidak ada ❌.

--------------------------------------------------------------------------------
23. PWA & INSTALLABLE - JADI APK/AAB OFFLINE
--------------------------------------------------------------------------------
Biar bisa install di HP jadi aplikasi native offline.

Buat: native-game/manifest.json (PWA)
{
  "name": "Eajzzxhro 74 Offline",
  "short_name": "E74 Offline",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#ffcc00",
  "icons": [
    { "src": "./assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "./assets/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}

Buat: native-game/index.html tambah:
<link rel="manifest" href="./manifest.json">
<meta name="theme-color" content="#ffcc00">

Tambah di sw.js: precache manifest.json + icons

Test: Chrome -> Install App -> harus bisa jalan tanpa browser, 100% offline.

Untuk APK: pakai Bubblewrap atau PWABuilder -> npx @bubblewrap/cli init --manifest https://.../manifest.json -> bubblewrap build

--------------------------------------------------------------------------------
24. E2E TEST AUTOMATION - TEST 100% OFFLINE OTOMATIS
--------------------------------------------------------------------------------
Buat: tests/eajzzxhro-74-e2e.test.mjs
import puppeteer from 'puppeteer';

test('100% offline', async()=>{
  const browser=await puppeteer.launch();
  const page=await browser.newPage();
  
  // Intercept request
  let leaked=false;
  await page.setRequestInterception(true);
  page.on('request', req=>{
    if(req.url().includes('eajzzxhro.com')){ leaked=true; console.log('LEAKED', req.url()); req.abort(); }
    else req.continue();
  });
  
  await page.goto('http://localhost:4173/native-game/?game=eajzzxhro-74');
  await page.waitForSelector('canvas');
  await page.click('.btn-play');
  await page.waitForTimeout(3000);
  
  // Spin
  await page.evaluate(()=>fetch('/api/game/spin',{method:'POST', headers:{'X-Idempotency-Key':crypto.randomUUID()}, body:JSON.stringify({bet:100})}));
  
  expect(leaked).toBe(false);
  expect(await page.evaluate(()=>localStorage.getItem('ledger:player1'))).toBeTruthy();
  
  await browser.close();
});

Jalan: npm run test:e2e -> harus PASS semua.

--------------------------------------------------------------------------------
25. DATABASE MIGRATION - DARI KV KE D1/R2 UNTUK HISTORY LENGKAP
--------------------------------------------------------------------------------
KV hanya untuk cache cepat, tapi history spin 1000x butuh DB.

Tambah di wrangler.jsonc:
"d1_databases": [{ "binding": "DB", "database_name": "eajzzxhro-history", "database_id": "ID_D1" }]

Buat table:
CREATE TABLE spins (id TEXT PRIMARY KEY, sessionId TEXT, bet INTEGER, win INTEGER, matrix TEXT, timestamp INTEGER);
CREATE TABLE ledgers (sessionId TEXT PRIMARY KEY, balance INTEGER, spinCount INTEGER);

Di spin.js:
await env.DB.prepare('INSERT INTO spins (id, sessionId, bet, win, matrix, timestamp) VALUES (?,?,?,?,?,?)')
  .bind(idempotencyKey, sessionId, bet, totalWin, JSON.stringify(matrix), Date.now()).run();

API history jadi baca dari D1, bukan KV saja.

--------------------------------------------------------------------------------
26. SECURITY HARDENING - CEGAH CHEAT BALANCE
--------------------------------------------------------------------------------
Karena spin.js sekarang server-authoritative, wajib cegah cheat:

a. Rate limiting: max 5 spin/detik per session
const rateKey=`rate:${sessionId}`;
const count=await env.GC_HISTORY.get(rateKey) || 0;
if(count>5) return Response.json({error:'Rate limited'}, {status:429});
await env.GC_HISTORY.put(rateKey, count+1, {expirationTtl:1});

b. Bet validation: bet hanya boleh 100,200,500,1000 (sesuai paytable)
if(![100,200,500,1000].includes(bet)) return 400;

c. Session signature: tanda tangan sessionId dengan secret
const secret=env.SESSION_SECRET;
const expected=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessionId+secret));
if(!verify) return 401;

d. Balance tidak boleh minus, cek di ledger sebelum spin.

--------------------------------------------------------------------------------
27. MULTI-THEME & SKIN - SUPPORT 74 VARIANT
--------------------------------------------------------------------------------
Game 74 punya banyak skin (74a, 74b, 74c). Catatan V1 cuma handle 1.

Tambah di config/host.json:
"variants": {
  "74": { "path": "/74/", "assets": "./assets/74/" },
  "74a": { "path": "/74a/", "assets": "./assets/74a/" },
  "74b": { "path": "/74b/", "assets": "./assets/74b/" }
}

Di site_plugins, loop semua variant, collect semua.

Frontend: ?game=74a, ?game=74b otomatis ganti asset path.

--------------------------------------------------------------------------------
28. DOCKER & ONE-CLICK DEPLOY - SEKALI KLIK JALAN DI VPS
--------------------------------------------------------------------------------
Buat: Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g wrangler && npm install
EXPOSE 4173
CMD ["npm", "run", "dev"]

Buat: docker-compose.yml
version: '3'
services:
  c-ziperr:
    build: .
    ports: ["4173:4173"]
    volumes: ["./native-game:/app/native-game"]
    environment:
      - GC_HISTORY_ID=xxx
      - GITHUB_TOKEN=xxx

Jalan: docker-compose up --build -> langsung jalan di http://localhost:4173

Buat: deploy.sh one-click:
#!/bin/bash
git pull
npx wrangler deploy
echo "Deployed to https://c-zipper.corelink-ai.workers.dev"

chmod +x deploy.sh

--------------------------------------------------------------------------------
29. BACKUP & RESTORE - JANGAN HILANG PAS KV RESET
--------------------------------------------------------------------------------
KV bisa hilang. Wajib backup harian ke R2.

Buat: scripts/backup_kv_to_r2.js
import { env } from 'cloudflare:workers';
export async function backup(){
  const keys=await env.GC_HISTORY.list();
  for(const k of keys.keys){
    const val=await env.GC_HISTORY.get(k.name);
    await env.ASSETS_BUCKET.put(`backup/${Date.now()}/${k.name}`, val);
  }
  console.log('Backup done', keys.keys.length);
}

Schedule di wrangler.jsonc:
"triggers": { "crons": ["0 0 * * *"] } // backup tiap jam 12 malam

Restore:
wrangler r2 object get c-zipper-assets/backup/xxx/ledger:player1 --file restore.json
wrangler kv key put --binding=GC_HISTORY "ledger:player1" --path=restore.json

--------------------------------------------------------------------------------
30. FINAL ULTIMATE CHECKLIST - 30 POINT - LEVEL DEWA
--------------------------------------------------------------------------------
[ ] 1-18 checklist V2 PASS
[ ] 19 CSP header BLOCK eajzzxhro.com, console 0 violation
[ ] 20 Integrity hash SHA256 semua assets, no corrupt
[ ] 21 Performance Lighthouse >90, load <3 detik meski 60MB
[ ] 22 Debug panel 0 ❌ BLOCKED, semua ✅ OK
[ ] 23 PWA installable, bisa jadi APK offline
[ ] 24 E2E test puppeteer PASS, no leaked request
[ ] 25 D1 database history 1000 spin tersimpan
[ ] 26 Security rate limit, bet validation, session signature PASS
[ ] 27 Multi-variant 74a/74b support
[ ] 28 Docker one-click deploy jalan
[ ] 29 Backup KV to R2 harian jalan
[ ] 30 Final package ZIP bisa di-restore di VPS lain tanpa config ulang

Jika 30 PASS = ULTIMATE 100% FULL LEVEL TERATAS, SEKALI JADI SELESAI, TIDAK PERLU UPDATE LAGI SELAMANYA.

================================================================================
END - CATATAN FULL LEVEL TERATAS ULTIMATE 1-30
================================================================================
Cara pakai ultimate:
1. Ikuti 1-18 dulu sampai PASS
2. Tambah 19-30 satu per satu
3. Test checklist 30 point
4. git commit -m "ultimate v3 full level teratas 1-30" && git push && npx wrangler deploy
5. SELESAI. Game 74 full offline + server sendiri + PWA + Docker + backup + anti-cheat + level dewa.
