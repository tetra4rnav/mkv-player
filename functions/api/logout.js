import { COOKIE_NAME } from '../_shared/auth.js';

export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': COOKIE_NAME + '=; Path=/; HttpOnly; Secure; Max-Age=0',
    },
  });
}
