export const COOKIE_NAME = 'mkv_token';
export const COOKIE_TTL  = 60 * 60 * 24 * 7; // 7 days

export async function signToken(secret, sub) {
  const payload = { sub, exp: Date.now() + COOKIE_TTL * 1000 };
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const body = btoa(JSON.stringify(payload));
  const sig  = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return body + '.' + btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function verifyToken(secret, token) {
  try {
    const [body, sigB64] = (token || '').split('.');
    if (!body || !sigB64) return null;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sig  = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const ok   = await crypto.subtle.verify('HMAC', key, sig, enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

export function parseCookie(req, name) {
  const h = req.headers.get('Cookie') || '';
  const m = h.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}
