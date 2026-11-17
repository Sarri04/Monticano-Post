// Proxy gratuito per la generazione degli sfondi: Cloudflare Worker + Workers AI (FLUX.1 schnell).
// Variabili da impostare nella dashboard del Worker:
//   ALLOWED_ORIGIN  = https://sarri04.github.io        (obbligatoria: solo la tua app può chiamarlo)
//   APP_TOKEN       = una parola lunga a caso            (consigliata: la stessa va inserita nell'app)
// Binding richiesto: "AI" (Workers AI). Nessuna chiave API da custodire: il binding è interno a Cloudflare.
const MODEL = '@cf/black-forest-labs/flux-1-schnell';

const cors = (env, req) => {
  const origin = req.headers.get('Origin') || '';
  const ok = env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN;
  return { 'Access-Control-Allow-Origin': ok ? origin : 'null', 'Access-Control-Allow-Headers': 'content-type,x-app-token', 'Access-Control-Allow-Methods': 'POST,GET,OPTIONS', 'Vary': 'Origin' };
};
const json = (obj, status, h) => new Response(JSON.stringify(obj), { status, headers: { ...h, 'content-type': 'application/json' } });

export default {
  async fetch(req, env) {
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    if (url.pathname === '/health') return json({ ok: true, model: MODEL }, 200, h);
    if (url.pathname !== '/image' || req.method !== 'POST') return json({ error: 'not found' }, 404, h);
    if (!env.ALLOWED_ORIGIN || req.headers.get('Origin') !== env.ALLOWED_ORIGIN) return json({ error: 'origin not allowed' }, 403, h);
    if (env.APP_TOKEN && req.headers.get('x-app-token') !== env.APP_TOKEN) return json({ error: 'bad token' }, 401, h);
    let body; try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400, h); }
    const prompt = String(body.prompt || '').slice(0, 1800);
    if (prompt.length < 10) return json({ error: 'prompt too short' }, 400, h);
    try {
      const out = await env.AI.run(MODEL, { prompt, steps: 6 });
      const b64 = out && (out.image || out.result?.image);
      if (!b64) return json({ error: 'no image in model response' }, 502, h);
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      return new Response(bytes, { status: 200, headers: { ...h, 'content-type': isPng ? 'image/png' : 'image/jpeg', 'cache-control': 'no-store' } });
    } catch (e) {
      const msg = String((e && e.message) || e);
      // superamento della quota gratuita giornaliera di Workers AI
      if (/limit|quota|capacity|10000|neurons/i.test(msg)) return json({ error: 'quota', detail: msg.slice(0, 200) }, 429, h);
      return json({ error: 'ai error', detail: msg.slice(0, 200) }, 502, h);
    }
  }
};
