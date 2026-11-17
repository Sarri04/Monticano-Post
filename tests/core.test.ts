import { describe, expect, it } from 'vitest';
import { outcomeFor, formatDateIt } from '../src/core/outcome';
import { buildLayers, fitSize } from '../src/core/layout';
import { buildDescription } from '../src/core/description';
import { buildBackgroundPrompt } from '../src/core/prompt';
import { parseChat } from '../src/core/chat';
import { removeUniformBackground } from '../src/core/logoCutout';
import type { Category, Match, TextLayer } from '../src/core/types';

const catA: Category = { id: 'a', name: 'Serie C2', template: 'A', useLogos: true };
const catB: Category = { id: 'b', name: 'Under 15', template: 'B', useLogos: false };
const base: Match = { id: 'm', categoryId: 'a', competition: 'Campionato', round: '5', homeName: 'Monticano C5', awayName: 'Came Treviso', extraTeams: [], date: '2026-11-21', time: '18:30', venue: 'Palazzetto di Monticano', monticanoHome: true, theme: 'GTA 6', archived: false, createdAt: 0 };
const t = (ls: ReturnType<typeof buildLayers>, role: string) => ls.find(l => l.role === role) as TextLayer | undefined;
const R = (home: number, away: number) => ({ home, away, scorers: '', assists: '', notes: '' });

describe('esito (casa/trasferta)', () => {
  it('vittoria in casa', () => expect(outcomeFor({ monticanoHome: true, result: R(3, 2) })).toBe('win'));
  it('sconfitta in casa', () => expect(outcomeFor({ monticanoHome: true, result: R(1, 4) })).toBe('loss'));
  it('vittoria in trasferta', () => expect(outcomeFor({ monticanoHome: false, result: R(2, 3) })).toBe('win'));
  it('sconfitta in trasferta', () => expect(outcomeFor({ monticanoHome: false, result: R(4, 1) })).toBe('loss'));
  it('2-3 con Monticano in casa = sconfitta', () => expect(outcomeFor({ monticanoHome: true, result: R(2, 3) })).toBe('loss'));
  it('pareggio', () => expect(outcomeFor({ monticanoHome: false, result: R(2, 2) })).toBe('draw'));
  it('senza risultato', () => expect(outcomeFor({ monticanoHome: true })).toBeNull());
  it('data in italiano', () => expect(formatDateIt('2026-11-21')).toBe('Sabato 21 novembre'));
});

describe('template A: titolo = partita', () => {
  const ls = buildLayers({ match: base, category: catA, kind: 'announce', theme: 'GTA 6', homeTeam: { id: '1', name: 'x', logoId: 'L1' }, awayTeam: { id: '2', name: 'y', logoId: 'L2' } });
  it('il titolo contiene le due squadre', () => { const title = t(ls, 'title')!; expect(title.text).toContain('Monticano C5'); expect(title.text).toContain('Came Treviso'); });
  it('due loghi e dati visibili', () => { expect(ls.filter(l => l.kind === 'logo')).toHaveLength(2); expect(t(ls, 'datetime')!.text).toContain('18:30'); expect(t(ls, 'venue')!.text).toBe('Palazzetto di Monticano'); expect(t(ls, 'round')!.text).toBe('5ª giornata'); });
  it("senza loghi nell'archivio non ne crea", () => expect(buildLayers({ match: base, category: catA, kind: 'announce', theme: 'GTA 6' }).filter(l => l.kind === 'logo')).toHaveLength(0));
  it('titolo e giornata non si sovrappongono', () => { const ti = t(ls, 'title')!; const lines = ti.text.split('\n').length; const top = ti.y - (lines * ti.size * ti.lineHeight) / 2; const ro = t(ls, 'round')!; expect(top).toBeGreaterThan(ro.y + ro.size / 2); });
});

describe('template B: titolo = categoria', () => {
  const m = { ...base, categoryId: 'b', homeName: 'Monticano', awayName: 'Sacile' };
  it('2 squadre: titolo categoria + squadre come testo, nessun logo', () => {
    const ls = buildLayers({ match: m, category: catB, kind: 'announce', theme: 'Rocky', homeTeam: { id: '1', name: 'x', logoId: 'L' } });
    expect(t(ls, 'title')!.text).toBe('Under 15'); expect(t(ls, 'home')!.text).toBe('Monticano'); expect(t(ls, 'away')!.text).toBe('Sacile'); expect(ls.some(l => l.kind === 'logo')).toBe(false);
  });
  it('triangolare: 3 squadre elencate', () => {
    const ls = buildLayers({ match: { ...m, extraTeams: ['Conegliano'] }, category: catB, kind: 'announce', theme: 'Rocky' });
    expect([1, 2, 3].map(i => t(ls, `team-${i}`)?.text)).toEqual(['Monticano', 'Sacile', 'Conegliano']);
  });
  it('torneo con 6 squadre: nessuna sovrapposizione, tutto nel canvas', () => {
    const ls = buildLayers({ match: { ...m, extraTeams: ['A', 'B', 'C', 'D'] }, category: catB, kind: 'announce', theme: 'Rocky' });
    const ys = ls.filter(l => l.role.startsWith('team-')).map(l => l.y);
    expect(ys).toHaveLength(6); for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(80); expect(Math.max(...ys)).toBeLessThan(1150);
  });
  it('nomi lunghissimi vengono ridotti per stare in larghezza (font largo)', () => {
    const long = 'Associazione Sportiva Dilettantistica Polisportiva Santa Maria';
    for (const theme of ['Rocky', 'Star Wars', 'Pirati dei Caraibi']) {
      const ls = buildLayers({ match: { ...m, homeName: long }, category: catB, kind: 'announce', theme });
      const l = t(ls, 'home')!; expect(l.size).toBeLessThan(40);
    }
  });
});

describe('template C: risultato', () => {
  const r = { ...base, result: { home: 2, away: 3, scorers: 'Rossi 2', assists: 'Bianchi', notes: '' } };
  it('punteggio protagonista', () => { const ls = buildLayers({ match: r, category: catA, kind: 'result', theme: 'GTA 6' }); expect(t(ls, 'score')!.text).toBe('2-3'); expect(t(ls, 'score')!.size).toBeGreaterThan(300); expect(t(ls, 'scorers')!.text).toContain('Rossi 2'); });
  it('nessuno slogan aggiunto', () => { const ls = buildLayers({ match: r, category: catA, kind: 'result', theme: 'GTA 6' }); expect(ls.filter(l => l.kind === 'text').map(l => (l as TextLayer).text).join(' ')).not.toMatch(/forza|vinciamo|insieme/i); });
  it('con loghi disponibili li usa', () => { const ls = buildLayers({ match: r, category: catA, kind: 'result', theme: 'GTA 6', homeTeam: { id: '1', name: 'x', logoId: 'L1' }, awayTeam: { id: '2', name: 'y', logoId: 'L2' } }); expect(ls.filter(l => l.kind === 'logo')).toHaveLength(2); });
});

describe('descrizioni', () => {
  it('annuncio prima squadra contiene tutti i dati', () => { const d = buildDescription(base, catA, 'announce'); for (const s of ['Serie C2', '5ª giornata', 'Monticano C5', 'Came Treviso', 'Sabato 21 novembre', '18:30', 'Palazzetto di Monticano']) expect(d).toContain(s); });
  it('tono diverso per vittoria e sconfitta', () => { const w = buildDescription({ ...base, result: { ...R(3, 2), scorers: 'Rossi' } }, catA, 'result'); const l = buildDescription({ ...base, result: { ...R(1, 2), scorers: 'Rossi' } }, catA, 'result'); expect(w).toContain('Vittoria'); expect(l).not.toContain('Vittoria'); expect(l).toContain('prossima'); });
  it('rimuove righe vuote (assist assenti)', () => { const d = buildDescription({ ...base, result: { ...R(3, 2), scorers: 'Rossi' } }, catA, 'result'); expect(d).not.toContain('🅰'); expect(d).not.toMatch(/\n{3,}/); });
  it('triangolare elenca tutte le squadre', () => { const d = buildDescription({ ...base, extraTeams: ['Terza'] }, catB, 'announce'); expect(d).toContain('Terza'); });
});

describe('prompt AI', () => {
  it('vieta testi/loghi nello sfondo e varia con il seed', () => { const a = buildBackgroundPrompt({ theme: 'Star Wars', template: 'A', seed: 1 }); const b = buildBackgroundPrompt({ theme: 'Star Wars', template: 'A', seed: 2 }); expect(a).toContain('no text'); expect(a).not.toBe(b); });
  it('atmosfera coerente con esito', () => { expect(buildBackgroundPrompt({ theme: 'Rocky', template: 'R', seed: 3, outcome: 'loss' })).toContain('melancholic'); expect(buildBackgroundPrompt({ theme: 'Rocky', template: 'R', seed: 3, outcome: 'win' })).toContain('triumphant'); });
});

describe('chat', () => {
  const layers = buildLayers({ match: base, category: catA, kind: 'announce', theme: 'GTA 6' });
  it('"titolo più in alto" sposta SOLO il titolo, senza AI', () => {
    const a = parseChat('Metti il titolo più in alto'); if (a.type !== 'edit') throw new Error('atteso edit');
    const out = a.apply(layers); const before = layers.find(l => l.role === 'title')!, after = out.find(l => l.role === 'title')!;
    expect(after.y).toBeLessThan(before.y); expect(out.find(l => l.role === 'datetime')!.y).toBe(layers.find(l => l.role === 'datetime')!.y);
  });
  it('ambientazione = rigenerazione', () => expect(parseChat("Cambia l'ambientazione ma mantieni il tema GTA 6").type).toBe('regenerate'));
  it('font della giornata', () => { const a = parseChat('Cambia il font della giornata in Cinzel'); if (a.type !== 'edit') throw new Error('atteso edit'); const out = a.apply(layers); expect((out.find(l => l.role === 'round') as TextLayer).font).toBe('Cinzel'); expect((out.find(l => l.role === 'title') as TextLayer).font).not.toBe('Cinzel'); });
  it('sconosciuto', () => expect(parseChat('blabla').type).toBe('unknown'));
});

describe('ritaglio logo', () => {
  it('rende trasparente solo lo sfondo esterno, non il bianco interno', () => {
    const w = 7, h = 7, d = new Uint8ClampedArray(w * h * 4).fill(255);
    const set = (x: number, y: number) => { const i = (y * w + x) * 4; d[i] = 0; d[i + 1] = 0; d[i + 2] = 200; };
    for (let x = 1; x <= 5; x++) { set(x, 1); set(x, 5); } for (let y = 1; y <= 5; y++) { set(1, y); set(5, y); }
    removeUniformBackground(d, w, h);
    expect(d[3]).toBe(0); expect(d[(3 * w + 3) * 4 + 3]).toBe(255); expect(d[(1 * w + 1) * 4 + 3]).toBe(255);
  });
  it('non tocca immagini senza sfondo uniforme', () => { const d = new Uint8ClampedArray(4 * 4 * 4).fill(255); d[0] = 0; d[1] = 0; d[2] = 0; expect(removeUniformBackground(d, 4, 4)).toBe(0); });
});
describe('fitSize', () => { it('rispetta minimo e base', () => { expect(fitSize('a', 100, 900)).toBe(100); expect(fitSize('x'.repeat(200), 100, 900, 30)).toBe(30); }); });
