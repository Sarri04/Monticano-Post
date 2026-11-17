import type { Layer, TextLayer } from './types';
import { H, W } from './types';

export type ChatAction =
  | { type: 'edit'; summary: string; apply: (layers: Layer[]) => Layer[] }
  | { type: 'regenerate'; summary: string; extra: string; keepScene: boolean; newScene: boolean }
  | { type: 'unknown'; summary: string };

const has = (s: string, ...w: string[]) => w.some(x => s.includes(x));
const FONTS: Record<string, string> = { anton: 'Anton', bebas: 'Bebas Neue', oswald: 'Oswald', cinzel: 'Cinzel', orbitron: 'Orbitron', marker: 'Permanent Marker', 'black ops': 'Black Ops One', pixel: 'Press Start 2P', 'press start': 'Press Start 2P' };
const COLORS: Record<string, string> = { rosso: '#ff2d2d', blu: '#2f7bff', azzurro: '#35c6ff', giallo: '#ffe14d', oro: '#f2b632', bianco: '#ffffff', nero: '#111111', verde: '#35d36b', rosa: '#ff5fa8', arancione: '#ff8a1f', viola: '#9a5bff' };
const ROLE_WORDS: [string, string[]][] = [
  ['title', ['titolo', 'scritta principale']], ['round', ['giornata']], ['datetime', ['data', 'orario', 'ora ']], ['venue', ['luogo', 'palazzetto', 'campo']],
  ['score', ['risultato', 'punteggio']], ['competition', ['competizione', 'categoria']], ['scorers', ['marcatori']]
];

function targetRoles(s: string): string[] | null {
  const r = ROLE_WORDS.filter(([, w]) => has(s, ...w)).map(([k]) => k);
  return r.length ? r : null;
}
function mapText(layers: Layer[], roles: string[] | null, fn: (l: TextLayer) => TextLayer): Layer[] {
  return layers.map(l => l.kind === 'text' && (!roles || roles.includes(l.role)) ? fn(l) : l);
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Interpreta un comando in italiano. Le modifiche di layout/tipografia vengono eseguite dall'editor SENZA servizio AI;
 * solo ambientazione/sfondo/atmosfera richiedono una nuova generazione.
 */
export function parseChat(input: string): ChatAction {
  const s = input.toLowerCase().trim();
  if (!s) return { type: 'unknown', summary: 'Scrivi una richiesta.' };
  const roles = targetRoles(s);
  const sel = (l: Layer) => !roles || roles.includes(l.role);

  if (has(s, 'ambientazione', 'sfondo', 'scenario', 'cinematografic', 'atmosfera', 'inquadratura', 'luce', 'illuminazione', 'scena')) {
    const wantsNew = has(s, 'cambia', 'nuov', 'diverso', 'differente', 'rigenera');
    const extra: string[] = [];
    if (has(s, 'cinematografic')) extra.push('more cinematic, epic scale, anamorphic lens look, dramatic color grading');
    if (has(s, 'notte', 'notturn')) extra.push('night scene');
    if (has(s, 'giorno', 'diurn', 'sole')) extra.push('bright daylight');
    if (has(s, 'scur', 'dramm')) extra.push('darker, more dramatic');
    if (has(s, 'chiar', 'luminos')) extra.push('brighter and more luminous');
    return { type: 'regenerate', summary: 'Rigenero lo sfondo (testi e loghi restano uguali).', extra: extra.join(', '), keepScene: !wantsNew && !!extra.length, newScene: wantsNew || !extra.length };
  }

  if (has(s, 'più in alto', 'piu in alto', 'sposta su', 'alza')) return { type: 'edit', summary: 'Sposto in alto.', apply: ls => ls.map(l => sel(l) ? { ...l, y: clamp(l.y - 80, 40, H - 40) } : l) };
  if (has(s, 'più in basso', 'piu in basso', 'sposta giù', 'sposta giu', 'abbassa')) return { type: 'edit', summary: 'Sposto in basso.', apply: ls => ls.map(l => sel(l) ? { ...l, y: clamp(l.y + 80, 40, H - 40) } : l) };
  if (has(s, 'a sinistra')) return { type: 'edit', summary: 'Sposto a sinistra.', apply: ls => ls.map(l => sel(l) ? { ...l, x: clamp(l.x - 80, 40, W - 40) } : l) };
  if (has(s, 'a destra')) return { type: 'edit', summary: 'Sposto a destra.', apply: ls => ls.map(l => sel(l) ? { ...l, x: clamp(l.x + 80, 40, W - 40) } : l) };

  if (has(s, 'più grande', 'piu grande', 'ingrandisci', 'più evidente', 'piu evidente', 'aumenta'))
    return { type: 'edit', summary: 'Ingrandisco.', apply: ls => ls.map(l => (l.kind === 'text' ? sel(l) : !roles) ? { ...l, size: Math.round(l.size * 1.15) } : l) };
  if (has(s, 'più piccolo', 'piu piccolo', 'riduci', 'rimpicciolisci'))
    return { type: 'edit', summary: 'Rimpicciolisco.', apply: ls => ls.map(l => (l.kind === 'text' ? sel(l) : !roles) ? { ...l, size: Math.max(20, Math.round(l.size * 0.87)) } : l) };

  if (has(s, 'font', 'carattere', 'scritta')) {
    const f = Object.keys(FONTS).find(k => s.includes(k));
    if (f) return { type: 'edit', summary: `Font ${FONTS[f]}.`, apply: ls => mapText(ls, roles, l => ({ ...l, font: FONTS[f], weight: FONTS[f] === 'Oswald' || FONTS[f] === 'Cinzel' ? 700 : 400 })) };
  }
  const c = Object.keys(COLORS).find(k => s.includes(k));
  if (c && has(s, 'colore', 'metti', 'rendi', 'cambia')) return { type: 'edit', summary: `Colore ${c}.`, apply: ls => mapText(ls, roles, l => ({ ...l, color: COLORS[c], color2: undefined })) };

  if (has(s, 'più glow', 'piu glow', 'bagliore', 'più luminos', 'piu luminos')) return { type: 'edit', summary: 'Più bagliore.', apply: ls => mapText(ls, roles, l => ({ ...l, glowBlur: l.glowBlur + 20 })) };
  if (has(s, 'senza ombra', 'togli ombra')) return { type: 'edit', summary: 'Tolgo ombra.', apply: ls => mapText(ls, roles, l => ({ ...l, shadow: false })) };
  if (has(s, 'integra', 'integrare') && has(s, 'logh')) return { type: 'edit', summary: 'Aumento ombra e bagliore dei loghi per integrarli nella scena (i loghi non vengono modificati).', apply: ls => ls.map(l => l.kind === 'logo' ? { ...l, glowBlur: l.glowBlur + 25, shadow: true } : l) };
  if (has(s, 'perso', 'sconfitta', 'vinto', 'vittoria')) return { type: 'regenerate', summary: "L'atmosfera dipende dall'esito: rigenero lo sfondo.", extra: has(s, 'perso', 'sconfitta') ? 'visibly dramatic and somber atmosphere' : 'visibly triumphant atmosphere', keepScene: true, newScene: false };

  return { type: 'unknown', summary: 'Non ho capito. Prova: "titolo più in alto", "font Cinzel", "giornata più grande", "cambia ambientazione", "rendi più cinematografica".' };
}
