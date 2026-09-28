// C_ziperr Worker: dispatch job ke GitHub Actions, lacak status, stream artifact.
// Tidak ada unzip/proses berat di sini (aman untuk limit CPU 10ms Free plan).
const RL = new Map(); // rate limit best-effort per isolate
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
const GH = (env, p, init = {}) => fetch(`https://api.github.com/repos/${env.GH_REPO}${p}`, {
  ...init,
  headers: { authorization: `Bearer ${env.GH_TOKEN}`, accept: 'application/vnd.github+json',
    'user-agent': 'c-ziperr', 'x-github-api-version': '2022-11-28', ...(init.headers || {}) },
});
async function findRun(env, tag) {
  if (!tag) return null;
  const r = await GH(env, '/actions/workflows/collect.yml/runs?event=workflow_dispatch&per_page=30');
  if (!r.ok) throw new Error('GitHub HTTP ' + r.status);
  return ((await r.json()).workflow_runs || []).find((x) => (x.display_title || '').includes(tag)) || null;
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url), p = u.pathname;
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (!env.GH_TOKEN || !env.GH_REPO) return J({ error: 'GH_TOKEN / GH_REPO belum diset' }, 500);
    if (env.ACCESS_TOKEN && req.headers.get('x-token') !== env.ACCESS_TOKEN) return J({ error: 'Token akses salah' }, 401);
    try {
      if (p === '/api/collect' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        if (!/^https?:\/\//.test(b.url || '')) return J({ error: 'URL tidak valid' }, 400);
        const ip = req.headers.get('cf-connecting-ip') || 'x', now = Date.now(), hits = (RL.get(ip) || []).filter((t) => now - t < 6e5);
        if (hits.length >= 5) return J({ error: 'Terlalu sering, coba lagi beberapa menit lagi' }, 429);
        RL.set(ip, [...hits, now]);
        const tag = crypto.randomUUID().slice(0, 8);
        const num = (v, d, max) => String(Math.min(max, Math.max(1, +v || d)));
        const r = await GH(env, '/actions/workflows/collect.yml/dispatches', {
          method: 'POST',
          body: JSON.stringify({ ref: env.GH_REF || 'main', inputs: {
            game_url: b.url, folder: String(b.folder || 'game-1').replace(/[^\w-]/g, '').slice(0, 40) || 'game-1',
            play_seconds: num(b.play_seconds, 90, 600), spins: num(b.spins, 30, 500),
            spin_x: String(+b.spin_x || ''), spin_y: String(+b.spin_y || ''), har: '0', tag } }),
        });
        if (r.status !== 204) return J({ error: 'Dispatch gagal (HTTP ' + r.status + ')', detail: await r.text() }, 502);
        return J({ tag });
      }
      if (p === '/api/status') {
        const run = await findRun(env, u.searchParams.get('tag'));
        return J(run ? { found: true, status: run.status, conclusion: run.conclusion, url: run.html_url } : { found: false });
      }
      if (p === '/api/download') {
        const run = await findRun(env, u.searchParams.get('tag'));
        if (!run || run.conclusion !== 'success') return J({ error: 'Run belum sukses' }, 409);
        const art = ((await (await GH(env, `/actions/runs/${run.id}/artifacts`)).json()).artifacts || [])[0];
        if (!art) return J({ error: 'Artifact tidak ada / sudah kedaluwarsa' }, 404);
        const z = await GH(env, `/actions/artifacts/${art.id}/zip`, { redirect: 'manual' });
        const loc = z.headers.get('location');
        if (!loc) return J({ error: 'Link artifact gagal (HTTP ' + z.status + ')' }, 502);
        const f = await fetch(loc);
        const h = { 'content-type': 'application/zip' };
        if (f.headers.get('content-length')) h['content-length'] = f.headers.get('content-length');
        return new Response(f.body, { headers: h });
      }
      return J({ error: 'Tidak ditemukan' }, 404);
    } catch (e) { return J({ error: String(e.message || e) }, 500); }
  },
};
