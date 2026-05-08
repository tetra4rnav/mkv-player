import { signToken, COOKIE_NAME, COOKIE_TTL } from '../_shared/auth.js';

export async function onRequestPost({ request, env }) {
  const { password } = await request.json();

  if (password !== env.AUTH_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status:  401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = await signToken(env.JWT_SECRET, 'user');

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie':
        COOKIE_NAME + '=' + token +
        '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + COOKIE_TTL,
    },
  });
}
