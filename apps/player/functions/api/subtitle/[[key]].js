function srtToVtt(srt) {
  return 'WEBVTT\n\n' + srt
    .replace(/\r\n/g, '\n')
    .replace(/^\uFEFF/, '')
    .replace(/^(\d+)\s*\n/gm, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .trim();
}

function assTimeToVtt(t) {
  const m = t.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
  if (!m) return '00:00:00.000';
  return m[1].padStart(2,'0') + ':' + m[2] + ':' + m[3] + '.' +
         (parseInt(m[4]) * 10).toString().padStart(3,'0');
}

function assToVtt(ass) {
  const lines = ass.split('\n');
  let inEvents = false, formatCols = [];
  const entries = [];

  for (const line of lines) {
    const t = line.trim();
    if (t === '[Events]')                        { inEvents = true;  continue; }
    if (t.startsWith('[') && t !== '[Events]')   { inEvents = false; continue; }
    if (!inEvents)                               continue;
    if (t.startsWith('Format:')) {
      formatCols = t.replace('Format:', '').split(',').map(s => s.trim());
      continue;
    }
    if (!t.startsWith('Dialogue:')) continue;

    const vals    = t.replace('Dialogue:', '').split(',');
    const gi      = col => { const i = formatCols.indexOf(col); return i < 0 ? '' : vals[i] || ''; };
    const textIdx = formatCols.indexOf('Text');
    const raw     = textIdx >= 0 ? vals.slice(textIdx).join(',') : '';
    const text    = raw.replace(/\{[^}]*\}/g, '').replace(/\\N/g, '\n').replace(/\\n/g, '\n').trim();
    if (!text) continue;
    entries.push({ start: assTimeToVtt(gi('Start').trim()), end: assTimeToVtt(gi('End').trim()), text });
  }

  entries.sort((a, b) => a.start.localeCompare(b.start));
  return 'WEBVTT\n\n' + entries.map((e, i) =>
    (i + 1) + '\n' + e.start + ' --> ' + e.end + '\n' + e.text + '\n'
  ).join('\n');
}

export async function onRequestGet({ env, params }) {
  const key     = (params.key || []).join('/');
  const decoded = decodeURIComponent(key);

  const obj = await env.MEDIA_BUCKET.get(decoded);
  if (!obj) return new Response('Not Found', { status: 404 });

  const text = await obj.text();
  const ext  = decoded.split('.').pop().toLowerCase();

  let vtt;
  if      (ext === 'srt')              vtt = srtToVtt(text);
  else if (ext === 'ass' || ext === 'ssa') vtt = assToVtt(text);
  else if (ext === 'vtt')              vtt = text;
  else return new Response('Unsupported subtitle format', { status: 400 });

  return new Response(vtt, {
    headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'private, max-age=3600' },
  });
}
