import { createRemoteJWKSet, jwtVerify } from 'jose';

function normalizeTeamDomain(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('https://')) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/\/$/, '')}`;
}

export function getAccessConfig(env) {
  const aud = String(env.CF_ACCESS_AUD || '').trim();
  const teamDomain = normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  return { aud, teamDomain };
}

export async function verifyCloudflareAccess(request, env) {
  const { aud, teamDomain } = getAccessConfig(env);
  const token = request.headers.get('cf-access-jwt-assertion');
  const emailHeader = request.headers.get('cf-access-authenticated-user-email');

  if (!aud) {
    if (emailHeader) return { ok: true, email: emailHeader };
    return {
      ok: false,
      status: 401,
      message: 'Unauthorized (Cloudflare Access required)',
    };
  }

  if (!token) {
    return {
      ok: false,
      status: 401,
      message: 'Missing Cloudflare Access JWT',
    };
  }

  if (!teamDomain) {
    return {
      ok: false,
      status: 500,
      message: 'CF_ACCESS_TEAM_DOMAIN is not configured',
    };
  }

  try {
    const JWKS = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: teamDomain,
      audience: aud,
    });

    const email = payload.email || payload.common_name || emailHeader || '';
    return { ok: true, email, payload };
  } catch {
    return {
      ok: false,
      status: 401,
      message: 'Invalid Cloudflare Access token',
    };
  }
}
