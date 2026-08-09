export default async function handler(req, res) {
  const host = req.headers.host || '';
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const sameHost = (u) => { try { return new URL(u).host === host; } catch { return false; } };

  // CORS: same-origin only (no wildcard). Reflect the deployment origin when it matches.
  if (origin && sameHost(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-tkn-hub');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Anti-abuse gate: only serve requests that came from a page on THIS deployment
  // (the hub sets x-tkn-hub and the browser sends a same-host Origin/Referer). Blocks the
  // open-proxy abuse where anyone could curl this endpoint and burn the company key.
  // NOTE: stopgap harm-reduction, not real auth — proper fix is an SSO gate on the hub.
  const fromHub = req.headers['x-tkn-hub'] === '1' && (sameHost(origin) || sameHost(referer));
  if (!fromHub) return res.status(403).json({ error: 'Forbidden' });

  try {
    const body = { ...req.body };
    // Cost guardrail: clamp max_tokens so the proxy can't be driven to large/expensive calls.
    body.max_tokens = Math.min(Number(body.max_tokens) || 512, 1024);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reach Claude API' });
  }
}
