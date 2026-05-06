function parseAllowedOrigins() {
  const raw = String(process.env.CORS_ALLOWED_ORIGINS || '').trim();
  if (!raw) return ['*'];

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveAllowedOrigin(reqOrigin, allowedOrigins) {
  if (!reqOrigin) return '*';
  if (allowedOrigins.includes('*')) return '*';
  if (allowedOrigins.includes(reqOrigin)) return reqOrigin;
  return null;
}

export function applyApiHeaders(req, res, allowedMethods = ['GET']) {
  const reqOrigin = req.headers.origin;
  const allowedOrigins = parseAllowedOrigins();
  const resolvedOrigin = resolveAllowedOrigin(reqOrigin, allowedOrigins);

  if (resolvedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', resolvedOrigin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

export function handleOptionsRequest(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return null;
}