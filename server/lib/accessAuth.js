'use strict';

// Express middleware verifying that a request came through Cloudflare Access.
//
// Access sits in front of this app at the edge (see docs/adr for the Tunnel +
// Access setup) and, once a request passes its login policy, attaches a
// signed JWT: the `Cf-Access-Jwt-Assertion` header (and a `CF_Authorization`
// cookie for browser navigations). Verifying it here is defense in depth —
// it guarantees a request genuinely passed Access even if the edge policy is
// ever misconfigured or the app is reached some other way — and it's what
// lets routes read the caller's identity (`req.accessEmail`) without any
// user database of our own.
//
// If CF_ACCESS_AUD isn't set, verification is skipped (once-logged warning)
// so local development (`npm start` without Access in front of it) keeps
// working. Set both CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD to enforce it.

const { createRemoteJWKSet, jwtVerify } = require('jose');

let warnedNoAud = false;
let jwks = null;
let jwksTeamDomain = null;

function getJwks(teamDomain) {
  if (!jwks || jwksTeamDomain !== teamDomain) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksTeamDomain = teamDomain;
  }
  return jwks;
}

function tokenFromRequest(req) {
  const header = req.get('Cf-Access-Jwt-Assertion');
  if (header) return header;
  const cookieHeader = req.get('Cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function accessAuth(req, res, next) {
  const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN;
  const aud = process.env.CF_ACCESS_AUD;

  if (!teamDomain || !aud) {
    if (!warnedNoAud) {
      warnedNoAud = true;
      console.warn(
        'accessAuth: CF_ACCESS_TEAM_DOMAIN/CF_ACCESS_AUD not set — skipping Access ' +
          'verification (fine for local dev, NOT for a publicly reachable deployment).'
      );
    }
    return next();
  }

  const token = tokenFromRequest(req);
  if (!token) {
    return res.status(403).json({ error: 'Not authenticated (no Access token).' });
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      issuer: `https://${teamDomain}`,
      audience: aud,
    });
    req.accessEmail = payload.email || null;
    next();
  } catch (err) {
    res.status(403).json({ error: `Not authenticated (${err.message}).` });
  }
}

module.exports = accessAuth;
