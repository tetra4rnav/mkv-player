export async function onRequest({ request, next, env }) {
  void env;
  const url = new URL(request.url);
  const isApi = url.pathname.startsWith('/api/');
  if (isApi) {
    const accessEmail = request.headers.get('cf-access-authenticated-user-email');
    if (!accessEmail) {
      return new Response('Unauthorized (Cloudflare Access required)', { status: 401 });
    }
  }
  return next();
}
