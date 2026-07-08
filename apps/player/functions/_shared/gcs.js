const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GCS_API_BASE = 'https://storage.googleapis.com/storage/v1';
const GCS_UPLOAD_BASE = 'https://storage.googleapis.com/upload/storage/v1';

function base64UrlEncode(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function importPrivateKey(pem) {
  const cleaned = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const raw = Uint8Array.from(atob(cleaned), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    raw.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function signJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.read_write',
    aud: GOOGLE_OAUTH_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  return `${signingInput}.${encodedSignature}`;
}

async function fetchAccessToken(serviceAccount) {
  const assertion = await signJwt(serviceAccount);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Failed to fetch GCS access token: ${message || res.statusText}`);
  }
  const json = await res.json();
  return {
    token: json.access_token,
    expiresAt: Date.now() + Math.max(0, (json.expires_in || 3600) - 60) * 1000,
  };
}

function escapeKeySegment(key) {
  return key
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

function parseServiceAccount(env) {
  const raw = env.GCS_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('Missing GCS_SERVICE_ACCOUNT_JSON');
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid GCS_SERVICE_ACCOUNT_JSON');
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GCS_SERVICE_ACCOUNT_JSON missing client_email/private_key');
  }
  return parsed;
}

function getBucket(env) {
  return env.GCS_BUCKET || 'mkv-player';
}

function ensureCache(env) {
  if (!env.__gcsTokenCache) {
    Object.defineProperty(env, '__gcsTokenCache', {
      value: { token: null, expiresAt: 0 },
      writable: true,
      configurable: true,
    });
  }
  return env.__gcsTokenCache;
}

async function getAuthHeader(env) {
  const cache = ensureCache(env);
  if (cache.token && cache.expiresAt > Date.now()) {
    return `Bearer ${cache.token}`;
  }
  const serviceAccount = parseServiceAccount(env);
  const fresh = await fetchAccessToken(serviceAccount);
  cache.token = fresh.token;
  cache.expiresAt = fresh.expiresAt;
  return `Bearer ${fresh.token}`;
}

export function getMime(key) {
  const ext = key.split('.').pop()?.toLowerCase() || '';
  return {
    mkv: 'video/x-matroska',
    mp4: 'video/mp4',
    webm: 'video/webm',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
    m4v: 'video/mp4',
    m3u8: 'application/vnd.apple.mpegurl',
    ts: 'video/mp2t',
    vtt: 'text/vtt; charset=utf-8',
    srt: 'application/x-subrip; charset=utf-8',
    ass: 'text/plain; charset=utf-8',
    ssa: 'text/plain; charset=utf-8',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    json: 'application/json; charset=utf-8',
  }[ext] || 'application/octet-stream';
}

export async function getObject(env, key, options = {}) {
  const bucket = getBucket(env);
  const auth = await getAuthHeader(env);
  const objectPath = escapeKeySegment(key);
  const alt = options.alt || 'media';
  const url = `${GCS_API_BASE}/b/${encodeURIComponent(bucket)}/o/${objectPath}?alt=${encodeURIComponent(alt)}`;

  const headers = new Headers({ Authorization: auth });
  if (options.range) {
    const range = options.range.get?.('range') || options.range.range;
    if (range) headers.set('Range', range);
  }

  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok && res.status !== 206) {
    const message = await res.text();
    throw new Error(`Failed to fetch GCS object "${key}": ${message || res.statusText}`);
  }
  return res;
}

export async function putObject(env, key, body, contentType = 'application/octet-stream') {
  const bucket = getBucket(env);
  const auth = await getAuthHeader(env);
  const objectName = key.startsWith('/') ? key.slice(1) : key;
  const uploadUrl =
    `${GCS_UPLOAD_BASE}/b/${encodeURIComponent(bucket)}/o` +
    `?uploadType=media&name=${encodeURIComponent(objectName)}`;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': contentType,
    },
    body,
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Failed to upload GCS object "${key}": ${message || res.statusText}`);
  }
  return res.json();
}

export async function listObjects(env, options = {}) {
  const bucket = getBucket(env);
  const auth = await getAuthHeader(env);
  const params = new URLSearchParams();
  if (options.prefix) params.set('prefix', options.prefix);
  if (options.delimiter) params.set('delimiter', options.delimiter);
  if (options.pageToken) params.set('pageToken', options.pageToken);
  if (options.maxResults) params.set('maxResults', String(options.maxResults));

  const url = `${GCS_API_BASE}/b/${encodeURIComponent(bucket)}/o?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: auth },
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Failed to list GCS objects: ${message || res.statusText}`);
  }
  const payload = await res.json();
  return {
    items: payload.items || [],
    prefixes: payload.prefixes || [],
    nextPageToken: payload.nextPageToken,
  };
}
