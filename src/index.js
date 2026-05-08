// ============================================================
// MKV Player – Cloudflare Worker
// ============================================================
// Secrets required (set via wrangler secret put):
//   AUTH_PASSWORD  – plain-text login password
//   JWT_SECRET     – random string for token signing (e.g. openssl rand -hex 32)
// ============================================================

const COOKIE_NAME  = 'mkv_token';
const COOKIE_TTL   = 60 * 60 * 24 * 7; // 7 days

// ─── Auth helpers ───────────────────────────────────────────

async function signToken(secret, sub) {
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

async function verifyToken(secret, token) {
  try {
    const [body, sigB64] = (token || '').split('.');
    if (!body || !sigB64) return null;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sig = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const ok  = await crypto.subtle.verify('HMAC', key, sig, enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function parseCookie(req, name) {
  const h = req.headers.get('Cookie') || '';
  const m = h.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

async function isAuthed(req, env) {
  const token = parseCookie(req, COOKIE_NAME);
  return !!(await verifyToken(env.JWT_SECRET, token));
}

// ─── Subtitle conversion ─────────────────────────────────────

function srtToVtt(srt) {
  return 'WEBVTT\n\n' + srt
    .replace(/\r\n/g, '\n')
    .replace(/^\uFEFF/, '')                              // BOM
    .replace(/^(\d+)\s*\n/gm, '')                        // cue numbers
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')   // comma → dot
    .trim();
}

function assTimeToVtt(t) {
  const m = t.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
  if (!m) return '00:00:00.000';
  const ms = (parseInt(m[4]) * 10).toString().padStart(3, '0');
  return m[1].padStart(2,'0') + ':' + m[2] + ':' + m[3] + '.' + ms;
}

function assToVtt(ass) {
  const lines = ass.split('\n');
  let inEvents = false, formatCols = [];
  const entries = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '[Events]') { inEvents = true; continue; }
    if (trimmed.startsWith('[') && trimmed !== '[Events]') { inEvents = false; continue; }
    if (!inEvents) continue;

    if (trimmed.startsWith('Format:')) {
      formatCols = trimmed.replace('Format:', '').split(',').map(s => s.trim());
      continue;
    }
    if (!trimmed.startsWith('Dialogue:')) continue;

    const vals    = trimmed.replace('Dialogue:', '').split(',');
    const gi      = col => { const i = formatCols.indexOf(col); return i < 0 ? '' : vals[i] || ''; };
    const textIdx = formatCols.indexOf('Text');
    const rawText = textIdx >= 0 ? vals.slice(textIdx).join(',') : '';
    const text    = rawText
      .replace(/\{[^}]*\}/g, '')
      .replace(/\\N/g, '\n')
      .replace(/\\n/g, '\n')
      .trim();
    if (!text) continue;
    entries.push({ start: assTimeToVtt(gi('Start').trim()), end: assTimeToVtt(gi('End').trim()), text });
  }

  entries.sort((a, b) => a.start.localeCompare(b.start));
  return 'WEBVTT\n\n' + entries.map((e, i) =>
    (i + 1) + '\n' + e.start + ' --> ' + e.end + '\n' + e.text + '\n'
  ).join('\n');
}

// ─── R2 helpers ──────────────────────────────────────────────

function getMime(key) {
  const ext = key.split('.').pop().toLowerCase();
  return { mkv:'video/x-matroska', mp4:'video/mp4', webm:'video/webm',
           avi:'video/x-msvideo', mov:'video/quicktime', m4v:'video/mp4' }[ext]
         || 'application/octet-stream';
}

function fileType(key) {
  const ext = key.split('.').pop().toLowerCase();
  if (['mkv','mp4','webm','avi','mov','m4v'].includes(ext)) return 'video';
  if (['srt','ass','ssa','vtt'].includes(ext))              return 'subtitle';
  return 'other';
}

function isMedia(key) {
  return ['mkv','mp4','webm','avi','mov','m4v','srt','ass','ssa','vtt']
    .includes(key.split('.').pop().toLowerCase());
}

// ─── Route handlers ──────────────────────────────────────────

async function handleStream(req, env, key) {
  const decoded = decodeURIComponent(key);
  const r2obj   = await env.MEDIA_BUCKET.get(decoded, { range: req.headers });
  if (!r2obj) return new Response('Not Found', { status: 404 });

  const headers = new Headers({
    'Content-Type':  r2obj.httpMetadata?.contentType || getMime(decoded),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
  });

  if (r2obj.range) {
    const { offset, end } = r2obj.range;
    headers.set('Content-Range',  'bytes ' + offset + '-' + end + '/' + r2obj.size);
    headers.set('Content-Length', String(end - offset + 1));
    return new Response(r2obj.body, { status: 206, headers });
  }

  headers.set('Content-Length', String(r2obj.size));
  return new Response(r2obj.body, { status: 200, headers });
}

async function handleSubtitle(req, env, key) {
  const decoded = decodeURIComponent(key);
  const obj     = await env.MEDIA_BUCKET.get(decoded);
  if (!obj) return new Response('Not Found', { status: 404 });

  const text = await obj.text();
  const ext  = decoded.split('.').pop().toLowerCase();
  let vtt;
  if      (ext === 'srt')              vtt = srtToVtt(text);
  else if (ext === 'ass' || ext === 'ssa') vtt = assToVtt(text);
  else if (ext === 'vtt')              vtt = text;
  else return new Response('Unsupported subtitle format', { status: 400 });

  return new Response(vtt, {
    headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'private, max-age=3600' }
  });
}

async function handleListFiles(req, env) {
  const url    = new URL(req.url);
  const prefix = url.searchParams.get('prefix') || '';

  const listed = await env.MEDIA_BUCKET.list({ prefix, delimiter: '/', limit: 1000 });

  const files   = listed.objects.filter(o => isMedia(o.key)).map(o => ({
    key: o.key, name: o.key.split('/').pop(),
    size: o.size, uploaded: o.uploaded, type: fileType(o.key),
  }));
  const folders = (listed.delimitedPrefixes || []).map(p => ({
    key: p, name: p.slice(prefix.length).replace(/\/$/, ''), type: 'folder',
  }));

  return new Response(JSON.stringify({ folders, files, prefix, truncated: listed.truncated }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── HTML templates ──────────────────────────────────────────

const SHARED_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:      #0c0c10;
    --surface: #16161e;
    --border:  #22222e;
    --muted:   #5a5a72;
    --text:    #dddde8;
    --accent:  #7c6ef5;
    --accent2: #6a5de0;
  }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: var(--bg); color: var(--text); min-height: 100vh; }
  a { color: inherit; text-decoration: none; }
  button { cursor: pointer; border: none; outline: none; font-family: inherit; }
  ::selection { background: var(--accent); color: #fff; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
`;

function renderLogin(error) {
  return '<!DOCTYPE html>\n<html lang="ja">\n<head>\n' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>MKV Player</title>\n<style>\n' + SHARED_CSS + `
    body { display:flex; align-items:center; justify-content:center; padding:16px; }
    .card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 20px; padding: 44px 40px; width: 100%; max-width: 380px;
      box-shadow: 0 24px 80px rgba(0,0,0,.55);
    }
    .icon { font-size: 2.4rem; margin-bottom: 14px; }
    h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -.02em; }
    .sub { color: var(--muted); font-size: .875rem; margin: 6px 0 28px; }
    label { display:block; font-size:.75rem; font-weight:600; letter-spacing:.08em;
            color:var(--muted); text-transform:uppercase; margin-bottom:6px; }
    input[type=password] {
      width:100%; padding:11px 14px; background:var(--bg);
      border:1px solid var(--border); border-radius:10px;
      color:var(--text); font-size:1rem; margin-bottom:20px;
      transition:border-color .2s, box-shadow .2s;
    }
    input[type=password]:focus { outline:none; border-color:var(--accent);
      box-shadow:0 0 0 3px rgba(124,110,245,.2); }
    .btn {
      width:100%; padding:13px; background:var(--accent); color:#fff;
      border-radius:10px; font-size:1rem; font-weight:600; letter-spacing:-.01em;
      transition:background .2s, transform .1s;
    }
    .btn:hover { background:var(--accent2); }
    .btn:active { transform:scale(.98); }
    .error { background:#2a1020; border:1px solid #6a2040; color:#f090a0;
             border-radius:10px; padding:10px 14px; margin-bottom:18px; font-size:.85rem; }
` + '\n</style>\n</head>\n<body>\n<div class="card">\n' +
    '<div class="icon">🎬</div>\n' +
    '<h1>MKV Player</h1>\n' +
    '<p class="sub">プライベート動画ライブラリ</p>\n' +
    (error ? '<div class="error">⚠️ ' + error + '</div>\n' : '') +
    '<form method="POST" action="/login">\n' +
    '<label>パスワード</label>\n' +
    '<input type="password" name="password" placeholder="••••••••" autofocus autocomplete="current-password">\n' +
    '<button type="submit" class="btn">ログイン →</button>\n' +
    '</form>\n</div>\n</body>\n</html>';
}

function renderBrowser() {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MKV Player</title>
<style>
${SHARED_CSS}
header {
  position:sticky; top:0; z-index:10;
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 24px; background:rgba(12,12,16,.85);
  backdrop-filter:blur(12px); border-bottom:1px solid var(--border);
}
.logo { display:flex; align-items:center; gap:10px; font-weight:700; font-size:1.05rem; }
.logo-icon { font-size:1.4rem; }
.actions { display:flex; gap:8px; }
.btn-sm {
  padding:6px 14px; border-radius:8px; font-size:.8rem; font-weight:500;
  border:1px solid var(--border); color:var(--muted); background:transparent;
  transition:all .2s;
}
.btn-sm:hover { border-color:var(--accent); color:var(--text); }

.container { max-width:860px; margin:0 auto; padding:28px 16px; }

.breadcrumb {
  display:flex; align-items:center; gap:6px; flex-wrap:wrap;
  font-size:.83rem; color:var(--muted); margin-bottom:22px;
  padding:10px 14px; background:var(--surface); border:1px solid var(--border);
  border-radius:10px;
}
.crumb { cursor:pointer; transition:color .15s; padding:2px 4px; border-radius:4px; }
.crumb:hover { color:var(--text); background:var(--border); }
.crumb-sep { color:var(--border); }

.section-label {
  font-size:.7rem; font-weight:600; letter-spacing:.1em; text-transform:uppercase;
  color:var(--muted); margin:16px 0 8px 2px;
}

.grid { display:flex; flex-direction:column; gap:3px; }
.item {
  display:flex; align-items:center; gap:14px;
  padding:11px 14px; border-radius:10px; cursor:pointer;
  transition:background .15s, border-color .15s;
  border:1px solid transparent;
}
.item:hover { background:var(--surface); border-color:var(--border); }
.item-icon { font-size:1.3rem; flex-shrink:0; width:32px; text-align:center; }
.item-info { flex:1; min-width:0; }
.item-name { font-size:.93rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.item-meta { font-size:.73rem; color:var(--muted); margin-top:2px; }
.badge {
  padding:3px 9px; border-radius:20px; font-size:.68rem; font-weight:700;
  letter-spacing:.04em; flex-shrink:0;
}
.badge-video { background:#1a1a3a; color:#8888ee; }
.badge-sub   { background:#0e2a1a; color:#50b870; }

.empty { text-align:center; padding:60px 20px; color:var(--muted); font-size:.9rem; }
.loading { text-align:center; padding:48px; color:var(--muted); }
.spinner { display:inline-block; width:24px; height:24px; border:2px solid var(--border);
           border-top-color:var(--accent); border-radius:50%; animation:spin .7s linear infinite; margin-right:10px; }
@keyframes spin { to { transform:rotate(360deg) } }

@media (max-width:600px) {
  header { padding:12px 16px; }
  .logo span { display:none; }
}
</style>
</head>
<body>
<header>
  <div class="logo"><span class="logo-icon">🎬</span> <span>MKV Player</span></div>
  <div class="actions">
    <button class="btn-sm" onclick="location.href='/logout'">ログアウト</button>
  </div>
</header>
<div class="container">
  <div class="breadcrumb" id="bc">
    <span class="crumb" onclick="nav('')">🏠 Home</span>
  </div>
  <div id="grid"><div class="loading"><span class="spinner"></span>読み込み中...</div></div>
</div>

<script>
var currentPrefix = '';

function fmtSize(b) {
  if (b < 1024)       return b + ' B';
  if (b < 1048576)    return (b/1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b/1048576).toFixed(1) + ' MB';
  return (b/1073741824).toFixed(1) + ' GB';
}

function renderBreadcrumb(prefix) {
  var el = document.getElementById('bc');
  var parts = prefix ? prefix.split('/').filter(Boolean) : [];
  var html = '<span class="crumb" onclick="nav(\\'\\')">🏠 Home</span>';
  var path = '';
  for (var i = 0; i < parts.length; i++) {
    path += parts[i] + '/';
    html += '<span class="crumb-sep">/</span>';
    html += '<span class="crumb" onclick="nav(\'' + path + '\')">' + esc(parts[i]) + '</span>';
  }
  el.innerHTML = html;
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function nav(prefix) {
  currentPrefix = prefix;
  renderBreadcrumb(prefix);
  document.getElementById('grid').innerHTML = '<div class="loading"><span class="spinner"></span>読み込み中...</div>';

  var res  = await fetch('/api/files?prefix=' + encodeURIComponent(prefix));
  var data = await res.json();
  var html = '';

  if (data.folders.length) {
    html += '<div class="section-label">📁 フォルダ</div><div class="grid">';
    for (var i = 0; i < data.folders.length; i++) {
      var f = data.folders[i];
      html += '<div class="item" onclick="nav(\'' + esc(f.key) + '\')">' +
        '<div class="item-icon">📁</div>' +
        '<div class="item-info"><div class="item-name">' + esc(f.name) + '</div></div>' +
        '</div>';
    }
    html += '</div>';
  }

  var videos = data.files.filter(function(f){ return f.type === 'video'; });
  var subs   = data.files.filter(function(f){ return f.type === 'subtitle'; });

  if (videos.length) {
    html += '<div class="section-label">🎥 動画</div><div class="grid">';
    for (var i = 0; i < videos.length; i++) {
      var f = videos[i];
      html += '<div class="item" onclick="openPlayer(\'' + encodeURIComponent(f.key) + '\',\'' + esc(f.name).replace(/'/g,"\\'") + '\')">' +
        '<div class="item-icon">🎬</div>' +
        '<div class="item-info"><div class="item-name">' + esc(f.name) + '</div>' +
        '<div class="item-meta">' + fmtSize(f.size) + '</div></div>' +
        '<span class="badge badge-video">MKV</span>' +
        '</div>';
    }
    html += '</div>';
  }

  if (subs.length) {
    html += '<div class="section-label">💬 字幕</div><div class="grid">';
    for (var i = 0; i < subs.length; i++) {
      var f = subs[i];
      html += '<div class="item">' +
        '<div class="item-icon">💬</div>' +
        '<div class="item-info"><div class="item-name">' + esc(f.name) + '</div>' +
        '<div class="item-meta">' + fmtSize(f.size) + '</div></div>' +
        '<span class="badge badge-sub">SUB</span>' +
        '</div>';
    }
    html += '</div>';
  }

  if (!data.folders.length && !data.files.length) {
    html = '<div class="empty">ファイルが見つかりません</div>';
  }

  document.getElementById('grid').innerHTML = html;
}

function openPlayer(encodedKey, name) {
  location.href = '/player?key=' + encodedKey + '&title=' + encodeURIComponent(name);
}

nav('');
</script>
</body>
</html>`;
}

function renderPlayer() {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Player – MKV Player</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/plyr/3.7.8/plyr.min.css">
<style>
${SHARED_CSS}
:root { --plyr-color-main: #7c6ef5; --plyr-font-family: inherit; }
body { background:#080810; }

header {
  display:flex; align-items:center; gap:12px;
  padding:12px 20px; background:rgba(8,8,16,.9);
  backdrop-filter:blur(12px); border-bottom:1px solid var(--border);
  position:sticky; top:0; z-index:20;
}
.back-btn {
  padding:7px 14px; border-radius:8px; font-size:.82rem; font-weight:500;
  border:1px solid var(--border); color:var(--muted); background:transparent;
  transition:all .2s; white-space:nowrap;
}
.back-btn:hover { border-color:var(--accent); color:var(--text); }
.title-text { font-size:.92rem; color:#bbb; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; }

.player-wrap { max-width:1120px; margin:0 auto; padding:20px 16px; }
.plyr { border-radius:14px; overflow:hidden; box-shadow:0 24px 80px rgba(0,0,0,.7); }

.controls-panel {
  margin-top:16px; display:flex; align-items:center; gap:16px;
  flex-wrap:wrap; padding:14px 18px;
  background:var(--surface); border:1px solid var(--border); border-radius:12px;
}
.ctrl-group { display:flex; align-items:center; gap:8px; }
.ctrl-label { font-size:.75rem; color:var(--muted); font-weight:500; white-space:nowrap; }
.ctrl-select {
  padding:6px 10px; background:var(--bg); border:1px solid var(--border);
  border-radius:8px; color:var(--text); font-size:.82rem;
  transition:border-color .2s;
}
.ctrl-select:focus { outline:none; border-color:var(--accent); }

.resume-toast {
  position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
  background:var(--surface); border:1px solid var(--border);
  border-radius:14px; padding:14px 20px;
  display:flex; align-items:center; gap:12px;
  font-size:.85rem; z-index:1000;
  box-shadow:0 12px 40px rgba(0,0,0,.5);
  animation:slideup .3s ease; white-space:nowrap;
}
@keyframes slideup { from { transform:translateX(-50%) translateY(16px); opacity:0; } }
.toast-resume { padding:5px 14px; border-radius:7px; background:var(--accent); color:#fff; font-size:.82rem; font-weight:600; }
.toast-dismiss { padding:5px 12px; border-radius:7px; border:1px solid var(--border); color:var(--muted); background:transparent; font-size:.82rem; }
.toast-dismiss:hover { border-color:var(--muted); }

@media (max-width:600px) {
  .player-wrap { padding:12px 8px; }
  .controls-panel { padding:10px 12px; }
}
</style>
</head>
<body>
<header>
  <button class="back-btn" onclick="history.back()">← 戻る</button>
  <span class="title-text" id="title-el">Loading...</span>
</header>
<div class="player-wrap">
  <video id="player" controls playsinline></video>
  <div class="controls-panel" id="ctrl-panel" style="display:none">
    <div class="ctrl-group">
      <span class="ctrl-label">💬 字幕</span>
      <select class="ctrl-select" id="sub-sel">
        <option value="">なし</option>
      </select>
    </div>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/plyr/3.7.8/plyr.min.js"></script>
<script>
var params  = new URLSearchParams(location.search);
var key     = params.get('key') || '';
var title   = params.get('title') || decodeURIComponent(key).split('/').pop() || 'Video';
var storeKey = 'mkv_pos_' + key;
var player;
var activeTrackUrl = null;

document.getElementById('title-el').textContent = title;
document.title = title + ' – MKV Player';

// ── Subtitle loader (fetch → Blob URL avoids CORS issues with <track>) ──
async function loadSubtitleTrack(subKey) {
  var video = document.getElementById('player');
  // Remove old tracks
  var tracks = video.querySelectorAll('track');
  for (var i = 0; i < tracks.length; i++) tracks[i].remove();
  if (activeTrackUrl) { URL.revokeObjectURL(activeTrackUrl); activeTrackUrl = null; }
  if (!subKey) return;

  var res = await fetch('/api/subtitle/' + encodeURIComponent(subKey));
  if (!res.ok) return;
  var vtt  = await res.text();
  var blob = new Blob([vtt], { type: 'text/vtt; charset=utf-8' });
  activeTrackUrl = URL.createObjectURL(blob);

  var track = document.createElement('track');
  track.kind    = 'subtitles';
  track.label   = decodeURIComponent(subKey).split('/').pop();
  track.srclang = 'ja';
  track.src     = activeTrackUrl;
  track.default = true;
  video.appendChild(track);

  // Force track active (Plyr may reset it)
  setTimeout(function() {
    if (video.textTracks && video.textTracks[0]) {
      video.textTracks[0].mode = 'showing';
    }
  }, 300);
}

// ── Find subtitle files in same directory ──
async function findSubtitles() {
  var decoded = decodeURIComponent(key);
  var slashIdx = decoded.lastIndexOf('/');
  var dir      = slashIdx >= 0 ? decoded.substring(0, slashIdx + 1) : '';
  var baseStem = decoded.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase().slice(0, 20);

  var res  = await fetch('/api/files?prefix=' + encodeURIComponent(dir));
  var data = await res.json();
  return data.files.filter(function(f) {
    return f.type === 'subtitle' &&
           f.name.replace(/\.[^.]+$/, '').toLowerCase().indexOf(baseStem.slice(0,8)) >= 0;
  });
}

// ── Resume toast ──
function showResume(pos) {
  var m = Math.floor(pos / 60);
  var s = Math.floor(pos % 60);
  var toast = document.createElement('div');
  toast.className = 'resume-toast';
  toast.innerHTML =
    '<span>⏱ ' + m + ':' + String(s).padStart(2,'0') + ' から再開しますか？</span>' +
    '<button class="toast-resume" id="t-resume">再開</button>' +
    '<button class="toast-dismiss" id="t-dismiss">最初から</button>';
  document.body.appendChild(toast);
  document.getElementById('t-resume').onclick  = function() { player.currentTime = pos; player.play(); toast.remove(); };
  document.getElementById('t-dismiss').onclick = function() { toast.remove(); };
  // Auto dismiss after 8s
  setTimeout(function() { if (toast.parentNode) toast.remove(); }, 8000);
}

// ── Main init ──
async function init() {
  if (!key) { alert('動画キーが指定されていません'); return; }

  var video = document.getElementById('player');
  video.src = '/api/stream/' + key;

  player = new Plyr(video, {
    controls: ['play-large','play','rewind','fast-forward','progress',
               'current-time','duration','mute','volume','captions','settings','pip','fullscreen'],
    settings: ['captions','quality','speed'],
    speed: { selected:1, options:[0.5,0.75,1,1.25,1.5,2] },
    captions: { active:true, language:'auto', update:true },
    keyboard: { focused:true, global:true },
    tooltips: { controls:true, seek:true },
  });

  // Save/resume position
  var savedPos = parseFloat(localStorage.getItem(storeKey) || '0');

  video.addEventListener('loadedmetadata', function() {
    if (savedPos > 15 && savedPos < video.duration - 30) showResume(savedPos);
  });
  video.addEventListener('timeupdate', function() {
    if (video.currentTime > 5) localStorage.setItem(storeKey, video.currentTime.toFixed(1));
  });
  video.addEventListener('ended', function() { localStorage.removeItem(storeKey); });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'ArrowLeft')  { player.rewind(10);   e.preventDefault(); }
    if (e.key === 'ArrowRight') { player.forward(10);  e.preventDefault(); }
    if (e.key === ' ')          { player.togglePlay();  e.preventDefault(); }
    if (e.key === 'f')          { player.fullscreen.toggle(); }
    if (e.key === 'm')          { player.muted = !player.muted; }
  });

  // Find and load subtitles
  var subs = await findSubtitles();
  if (subs.length > 0) {
    var panel = document.getElementById('ctrl-panel');
    var sel   = document.getElementById('sub-sel');
    panel.style.display = 'flex';
    for (var i = 0; i < subs.length; i++) {
      var opt = document.createElement('option');
      opt.value = subs[i].key;
      opt.textContent = subs[i].name;
      sel.appendChild(opt);
    }
    sel.value = subs[0].key;
    await loadSubtitleTrack(subs[0].key);
    sel.addEventListener('change', function() { loadSubtitleTrack(sel.value); });
  }
}

init();
</script>
</body>
</html>`;
}

// ─── Main fetch handler ───────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url  = new URL(request.url);
    const path = url.pathname;

    // Login (public)
    if (path === '/login') {
      if (request.method === 'POST') {
        const form = await request.formData();
        const pw   = form.get('password');
        if (pw === env.AUTH_PASSWORD) {
          const token = await signToken(env.JWT_SECRET, 'user');
          return new Response(null, {
            status: 302,
            headers: {
              'Location':   '/',
              'Set-Cookie': COOKIE_NAME + '=' + token +
                '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + COOKIE_TTL,
            },
          });
        }
        return new Response(renderLogin('パスワードが正しくありません'), {
          status: 401,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return new Response(renderLogin(''), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Logout
    if (path === '/logout') {
      return new Response(null, {
        status: 302,
        headers: {
          'Location':   '/login',
          'Set-Cookie': COOKIE_NAME + '=; Path=/; HttpOnly; Secure; Max-Age=0',
        },
      });
    }

    // Auth guard
    if (!(await isAuthed(request, env))) {
      return new Response(null, {
        status: 302,
        headers: { 'Location': '/login' },
      });
    }

    // Protected routes
    if (path === '/' || path === '')
      return new Response(renderBrowser(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

    if (path === '/player')
      return new Response(renderPlayer(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

    if (path === '/api/files')
      return handleListFiles(request, env);

    if (path.startsWith('/api/stream/'))
      return handleStream(request, env, path.slice('/api/stream/'.length));

    if (path.startsWith('/api/subtitle/'))
      return handleSubtitle(request, env, path.slice('/api/subtitle/'.length));

    return new Response('Not Found', { status: 404 });
  },
};
