export async function onRequest({ request, next, env }) {
  void request;
  void env;
  return next();
}
