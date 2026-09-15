// Verifies the admin password server-side instead of comparing it to a
// constant sitting in the page's own JS (readable by anyone via "view
// source" — no dev tools needed). The password itself never ships to the
// browser; only a short-lived signed token does, once, after a correct
// check.
//
// POST { password } -> { ok: true, token } | 401
// POST { token }     -> { ok: true } | { ok: false }   (used to restore an
//                        admin session across a page reload without asking
//                        for the password again)
//
// Requires two Netlify environment variables, set in the site dashboard,
// never committed to the repo:
//   ADMIN_PASSWORD     - the admin password itself
//   ADMIN_TOKEN_SECRET - a random string used to sign issued tokens

const crypto = require('crypto');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function issueToken(secret) {
  const payload = String(Date.now() + TOKEN_TTL_MS);
  return Buffer.from(payload + '.' + sign(payload, secret)).toString('base64');
}

function verifyToken(token, secret) {
  try {
    const decoded = Buffer.from(String(token), 'base64').toString('utf8');
    const dot = decoded.lastIndexOf('.');
    if (dot === -1) return false;
    const payload = decoded.slice(0, dot);
    const sig = decoded.slice(dot + 1);
    if (!timingSafeEqual(sig, sign(payload, secret))) return false;
    const exp = parseInt(payload, 10);
    return Number.isFinite(exp) && Date.now() < exp;
  } catch (e) {
    return false;
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const secret = process.env.ADMIN_TOKEN_SECRET;
  const password = process.env.ADMIN_PASSWORD;
  if (!secret || !password) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Admin-login er ikke konfigureret på serveren (mangler ADMIN_PASSWORD/ADMIN_TOKEN_SECRET).' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig anmodning' }) };
  }

  if (typeof body.token === 'string' && body.token) {
    return { statusCode: 200, body: JSON.stringify({ ok: verifyToken(body.token, secret) }) };
  }

  if (typeof body.password !== 'string' || !body.password || !timingSafeEqual(body.password, password)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Forkert kode' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, token: issueToken(secret) }) };
};

exports._internals = { issueToken, verifyToken, timingSafeEqual };
