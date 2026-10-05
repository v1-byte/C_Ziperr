export async function ghFetch(env, path, opts = {}, sessionToken = "") {
  const token = String(sessionToken || env.GITHUB_TOKEN || env.GH_TOKEN || "").trim();
  if (!token) {
    return {
      ok: false,
      status: 401,
      data: {
        error: "GitHub belum terhubung. Masukkan token sesi atau set GITHUB_TOKEN di Worker.",
        code: "GITHUB_TOKEN_REQUIRED"
      }
    };
  }
  if (token.length > 1024) {
    return { ok: false, status: 400, data: { error: "Token GitHub terlalu panjang", code: "GITHUB_TOKEN_INVALID" } };
  }
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "game-collector-pro",
      ...(opts.headers || {})
    }
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (res.status === 401) {
    return { ok: false, status: 401, data: { error: "Token GitHub tidak valid", code: "GITHUB_TOKEN_INVALID" }, headers: res.headers };
  }
  if (res.status === 403 && /resource not accessible|insufficient permission|must have|not permitted/i.test(String(data?.message || ""))) {
    return { ok: false, status: 403, data: { error: "Token tidak memiliki izin Actions read/write pada repository ini", code: "GITHUB_TOKEN_SCOPE" }, headers: res.headers };
  }
  return { ok: res.ok, status: res.status, data, headers: res.headers };
}
