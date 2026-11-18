import { AiError } from './aiError';

/* Puter.js: servizio gratuito "user-pays". L'utente accede con il proprio account Puter gratuito e usa la sua quota mensile:
   nessuna chiave API nell'app, nessun server nostro. Il codice di Puter viene caricato da js.puter.com solo se scegli questo motore. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PuterApi = any;
declare global { interface Window { puter?: PuterApi } }

let loader: Promise<PuterApi> | null = null;
export function loadPuter(): Promise<PuterApi> {
  if (window.puter) return Promise.resolve(window.puter);
  if (!loader) loader = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://js.puter.com/v2/'; s.async = true;
    s.onload = () => (window.puter ? res(window.puter) : rej(new AiError('Puter non si è avviato.', 'server')));
    s.onerror = () => { loader = null; rej(new AiError('Impossibile caricare Puter: controlla la connessione.', 'network')); };
    document.head.appendChild(s);
  });
  return loader;
}
export async function puterSignedIn(): Promise<boolean> { try { return !!(await loadPuter()).auth.isSignedIn(); } catch { return false; } }
/** Va chiamata da un tocco dell'utente (apre la finestra di accesso di Puter). */
export async function puterSignIn(): Promise<void> { const p = await loadPuter(); await p.auth.signIn(); }
export async function puterUsage(): Promise<string> {
  const p = await loadPuter();
  try { const u = await (p.auth.getMonthlyUsage?.() ?? Promise.resolve(null)); return u ? JSON.stringify(u).slice(0, 600) : 'Non disponibile.'; } catch (e) { return 'Non disponibile: ' + String((e as Error)?.message ?? e).slice(0, 160); }
}

const b64 = (d: string) => d.split(',').pop() ?? d;
const errText = (e: unknown) => { try { return typeof e === 'string' ? e : JSON.stringify(e, Object.getOwnPropertyNames(Object(e))); } catch { return String(e); } };

export async function puterGenerate(prompt: string, refs: string[], model: string, quality: string, signal?: AbortSignal): Promise<Blob> {
  const p = await loadPuter();
  if (!p.auth.isSignedIn()) throw new AiError('Accedi a Puter: Impostazioni → "Accedi a Puter" (account gratuito).', 'auth');
  const opts: Record<string, unknown> = { model, quality };
  if (refs.length === 1) { opts.input_image = b64(refs[0]); opts.input_image_mime_type = 'image/png'; }
  else if (refs.length > 1) { opts.input_images = refs.map(b64); opts.input_image_mime_type = 'image/png'; }
  let img: HTMLImageElement;
  try {
    img = await p.ai.txt2img(prompt, opts);
  } catch (e) {
    const t = errText(e);
    if (/insufficient|402|credit|balance|allowance/i.test(t)) throw new AiError("Quota mensile gratuita di Puter esaurita. Si rinnova ogni mese; intanto puoi usare il motore Cloudflare o lo sfondo di riserva.", 'quota');
    if (/429|too_many|rate/i.test(t)) throw new AiError('Troppe richieste in poco tempo: riprova tra qualche secondo.', 'quota');
    if (/auth|401|sign/i.test(t)) throw new AiError('Accesso a Puter scaduto: rifai "Accedi a Puter" in Impostazioni.', 'auth');
    throw new AiError('Puter ha risposto con un errore: ' + t.slice(0, 220), 'server');
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const r = await fetch(img.src); const blob = await r.blob();
  if (!blob.type.startsWith('image/')) throw new AiError('Risposta di Puter non valida.', 'server');
  return blob;
}
