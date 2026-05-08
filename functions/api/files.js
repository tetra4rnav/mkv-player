const MEDIA_EXTS    = new Set(['mkv','mp4','webm','avi','mov','m4v','m3u8']);
const SUBTITLE_EXTS = new Set(['srt','ass','ssa','vtt']);

function fileType(key) {
  const ext = key.split('.').pop().toLowerCase();
  if (MEDIA_EXTS.has(ext))    return 'video';
  if (SUBTITLE_EXTS.has(ext)) return 'subtitle';
  return 'other';
}

function isVisible(key) {
  const ext = key.split('.').pop().toLowerCase();
  return MEDIA_EXTS.has(ext) || SUBTITLE_EXTS.has(ext);
}

export async function onRequestGet({ request, env }) {
  const url    = new URL(request.url);
  const prefix = url.searchParams.get('prefix') || '';

  const listed = await env.MEDIA_BUCKET.list({ prefix, delimiter: '/', limit: 1000 });

  const files = listed.objects
    .filter(o => isVisible(o.key))
    .map(o => ({
      key:      o.key,
      name:     o.key.split('/').pop(),
      size:     o.size,
      uploaded: o.uploaded,
      type:     fileType(o.key),
    }));

  const folders = (listed.delimitedPrefixes || []).map(p => ({
    key:  p,
    name: p.slice(prefix.length).replace(/\/$/, ''),
    type: 'folder',
  }));

  return new Response(JSON.stringify({ folders, files, prefix, truncated: listed.truncated }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
