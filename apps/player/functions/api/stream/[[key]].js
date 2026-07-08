import { getMime, getObject } from '../../_shared/gcs.js';

export async function onRequestGet({ request, env, params }) {
  const key     = (params.key || []).join('/');
  const decoded = decodeURIComponent(key);

  const objectRes = await getObject(env, decoded, { range: request.headers, alt: 'media' });
  if (!objectRes) return new Response('Not Found', { status: 404 });

  const headers = new Headers({
    'Content-Type':  objectRes.headers.get('content-type') || getMime(decoded),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
  });

  const contentRange = objectRes.headers.get('content-range');
  const contentLength = objectRes.headers.get('content-length');
  if (contentRange) {
    headers.set('Content-Range', contentRange);
    if (contentLength) headers.set('Content-Length', contentLength);
    return new Response(objectRes.body, { status: 206, headers });
  }

  if (contentLength) headers.set('Content-Length', contentLength);
  return new Response(objectRes.body, { status: 200, headers });
}
