// Proxy gratuito per la generazione delle grafiche: Cloudflare Worker + Workers AI.
// Variabili: ALLOWED_ORIGIN (https://sarri04.github.io), APP_TOKEN (codice scelto da te). Binding: "AI".
// Modelli (campo "model" nel body): schnell (default), klein, phoenix, lucid, flux2dev.
const M = {
  schnell: '@cf/black-forest-labs/flux-1-schnell',
  klein: '@cf/black-forest-labs/flux-2-klein-4b',
  flux2dev: '@cf/black-forest-labs/flux-2-dev',
  phoenix: '@cf/leonardo/phoenix-1.0',
  lucid: '@cf/leonardo/lucid-origin',
};
const cors = (env, req) => {
  const o = req.headers.get('Origin') || '';
  const ok = env.ALLOWED_ORIGIN && o === env.ALLOWED_ORIGIN;
  return { 'Access-Control-Allow-Origin': ok ? o : 'null', 'Access-Control-Allow-Headers': 'content-type,x-app-token', 'Access-Control-Allow-Methods': 'POST,GET,OPTIONS', Vary: 'Origin' };
};
const json = (obj, status, h) => new Response(JSON.stringify(obj), { status, headers: { ...h, 'content-type': 'application/json' } });
const dataToBlob = async (u) => { const r = await fetch(u); return new Uint8Array(await r.arrayBuffer()); };
const sniff = (b) => (b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : 'image/jpeg');
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export default {
  async fetch(req, env) {
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    if (url.pathname === '/health') return json({ ok: true, models: Object.keys(M), poster: true }, 200, h);
    if (url.pathname !== '/image' || req.method !== 'POST') return json({ error: 'not found' }, 404, h);
    if (!env.ALLOWED_ORIGIN || req.headers.get('Origin') !== env.ALLOWED_ORIGIN) return json({ error: 'origin not allowed' }, 403, h);
    if (env.APP_TOKEN && req.headers.get('x-app-token') !== env.APP_TOKEN) return json({ error: 'bad token' }, 401, h);
    let body; try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400, h); }
    const prompt = String(body.prompt || '').slice(0, 3500);
    if (prompt.length < 10) return json({ error: 'prompt too short' }, 400, h);
    const key = body.mode === 'poster' && !body.model ? 'klein' : (M[body.model] ? body.model : 'schnell');
    const model = M[key];
    const seed = Number.isFinite(+body.seed) ? Math.abs(Math.trunc(+body.seed)) % 4294967295 : undefined;
    try {
      let out;
      if (key === 'schnell') {
        out = await env.AI.run(model, { prompt: prompt.slice(0, 2000), steps: 6 });
      } else if (key === 'klein' || key === 'flux2dev') {
        const fd = new FormData();
        fd.append('prompt', prompt); fd.append('width', '1024'); fd.append('height', '1280');
        const refs = Array.isArray(body.refs) ? body.refs.slice(0, 4) : [];
        for (let i = 0; i < refs.length; i++) fd.append('input_image_' + i, new Blob([await dataToBlob(refs[i])], { type: 'image/png' }), 'r' + i + '.png');
        const r = new Response(fd);
        out = await env.AI.run(model, { multipart: { body: r.body, contentType: r.headers.get('content-type') } });
      } else {
        const cl = (v, a, b, d) => { v = Math.round(+v / 64) * 64; return v >= a && v <= b ? v : d; }; const p = { prompt, width: cl(body.w, 512, 1024, 768), height: cl(body.h, 512, 1280, 960), num_steps: Math.min(30, Math.max(8, Math.trunc(+body.steps) || 20)), guidance: 4.5 };
        if (seed !== undefined) p.seed = seed;
        out = await env.AI.run(model, p);
      }
      let bytes;
      if (out && typeof out === 'object' && (out.image || out.result?.image)) bytes = fromB64(out.image || out.result.image);
      else if (out instanceof ReadableStream) bytes = new Uint8Array(await new Response(out).arrayBuffer());
      else if (out instanceof Response) bytes = new Uint8Array(await out.arrayBuffer());
      else if (out instanceof ArrayBuffer || ArrayBuffer.isView(out)) bytes = new Uint8Array(out.buffer || out);
      if (!bytes || bytes.length < 100) return json({ error: 'no image in model response' }, 502, h);
      return new Response(bytes, { status: 200, headers: { ...h, 'content-type': sniff(bytes), 'cache-control': 'no-store', 'x-model': key } });
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (/limit|quota|capacity|10000|neurons/i.test(msg)) return json({ error: 'quota', detail: msg.slice(0, 200) }, 429, h);
      return json({ error: 'ai error', detail: msg.slice(0, 300) }, 502, h);
    }
  },
};
