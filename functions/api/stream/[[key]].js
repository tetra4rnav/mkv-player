function getMime(key) {
  const ext = key.split('.').pop().toLowerCase();
  return {
    mkv:  'video/x-matroska',
    mp4:  'video/mp4',
    webm: 'video/webm',
    avi:  'video/x-msvideo',
    mov:  'video/quicktime',
    m4v:  'video/mp4',
    m3u8: 'application/vnd.apple.mpegurl',
    ts:   'video/mp2t',
  }[ext] || 'application/octet-stream';
}

export async function onRequestGet({ request, env, params }) {
  const key     = (params.key || []).join('/');
  const decoded = decodeURIComponent(key);

  const r2obj = await env.MEDIA_BUCKET.get(decoded, { range: request.headers });
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
