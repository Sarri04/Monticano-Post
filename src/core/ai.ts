import type { Settings } from './types';

import { AiError } from './aiError';
import { puterGenerate } from './puter';
export { AiError };

/** Modello usato davvero nell'ultima richiesta (per avvisare quando scatta il ripiego veloce). */
export let lastModelUsed = '';

/** Chiede l'immagine di sfondo al proxy (Cloudflare Worker). La chiave del servizio AI resta sul Worker, mai nell'app. */
export async function generateBackground(s: Settings, prompt: string, seed: number, signal?: AbortSignal, poster?: { refs: string[] }): Promise<Blob> {
  if (s.engine === 'puter') return puterGenerate(prompt, poster?.refs ?? [], s.puterModel || 'openai/gpt-image-2.6-flare', s.puterQuality || 'medium', signal);
  if (!s.workerUrl.trim()) throw new AiError("Servizio AI non configurato: inserisci l'indirizzo del Worker in Impostazioni.", 'not-configured');
  let r: Response | undefined;
  let model = poster ? 'klein' : (s.cfModel || 'lucid');
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      r = await fetch(s.workerUrl.replace(/\/$/, '') + '/image', { method: 'POST', signal, headers: { 'content-type': 'application/json', ...(s.workerToken ? { 'x-app-token': s.workerToken } : {}) }, body: JSON.stringify(poster ? { prompt, seed: seed + attempt, mode: 'poster', model, refs: poster.refs } : { prompt, seed: seed + attempt, model, w: 768, h: 960, steps: 20 }) });
    } catch (e) { if ((e as Error).name === 'AbortError') throw e; throw new AiError("Connessione al servizio AI non riuscita. Controlla la rete e l'indirizzo del Worker.", 'network'); }
    // errori sporadici del modello (filtro automatico, errore interno): si riprova con un altro seme
    if (r.status === 429 && model !== 'schnell' && !poster) { model = 'schnell'; continue; } // quota dei modelli pesanti finita: ripiego sulla bozza veloce, molto più leggera
    if (r.status !== 502) break;
  }
  lastModelUsed = model;
  r = r!;
  if (r.status === 429) throw new AiError("Quota gratuita giornaliera esaurita. Si azzera a mezzanotte UTC (01:00 in Italia con ora solare). Intanto puoi usare lo sfondo di riserva e modificare tutto nell'editor.", 'quota');
  if (r.status === 401 || r.status === 403) throw new AiError('Accesso al servizio negato: controlla il codice di accesso in Impostazioni.', 'auth');
  if (!r.ok) throw new AiError(`Il servizio AI ha risposto con un errore (${r.status}). ${(await r.text().catch(() => '')).slice(0, 160)}`, 'server');
  const b = await r.blob(); if (!b.type.startsWith('image/')) throw new AiError('Risposta del servizio AI non valida.', 'server'); return b;
}
