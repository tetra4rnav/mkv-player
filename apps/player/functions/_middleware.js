import { verifyCloudflareAccess } from './_shared/access.js';

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) {
    return next();
  }

  const result = await verifyCloudflareAccess(request, env);
  if (!result.ok) {
    return new Response(result.message, { status: result.status });
  }

  return next();
}
