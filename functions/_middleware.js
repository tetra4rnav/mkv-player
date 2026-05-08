import { verifyToken, parseCookie, COOKIE_NAME } from './_shared/auth.js';

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);

  // Pass through non-API routes and public API endpoints
  if (!url.pathname.startsWith('/api/')) return next();
  if (url.pathname === '/api/login' || url.pathname === '/api/logout') return next();

  const token   = parseCookie(request, COOKIE_NAME);
  const payload = await verifyToken(env.JWT_SECRET, token);

  if (!payload) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status:  401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return next();
}
