import type { Category, Frame, Layer, LogoLayer, Match, Project, ProjectKind, TextLayer, Team } from './types';
import { W } from './types';
import { formatDateIt, ordinalRound } from './outcome';
import { styleForTheme } from './themes';

/** Larghezza media di un carattere in em, per font (stima usata per adattare i testi alla larghezza). */
export const FONT_W: Record<string, number> = { 'Anton': 0.46, 'Bebas Neue': 0.42, 'Oswald': 0.5, 'Cinzel': 0.74, 'Orbitron': 0.8, 'Permanent Marker': 0.58, 'Black Ops One': 0.7, 'Press Start 2P': 1.0, 'Luckiest Guy': 0.56, 'Pirata One': 0.42, 'Bangers': 0.47 };
let uid = 0;
export const newId = (p = 'id') => `${p}_${Date.now().toString(36)}_${(uid++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function allTeamNames(m: Pick<Match, 'homeName' | 'awayName' | 'extraTeams'>): string[] {
  return [m.homeName, m.awayName, ...m.extraTeams].map(s => s.trim()).filter(Boolean);
}
export const isMulti = (m: Pick<Match, 'extraTeams'>) => m.extraTeams.some(s => s.trim());

/** Riduce la dimensione del carattere finché il testo sta in maxWidth. */
export function fitSize(text: string, base: number, maxWidth: number, min = 28, factor = 0.5): number {
  const longest = Math.max(1, ...text.split('\n').map(l => l.length));
  const fit = maxWidth / (longest * factor);
  return Math.max(min, Math.min(base, Math.floor(fit)));
}

type St = ReturnType<typeof styleForTheme>;
type TOver = Partial<TextLayer> & Pick<TextLayer, 'name' | 'role' | 'text' | 'x' | 'y'>;
function text(over: TOver, st: St): TextLayer {
  return {
    id: newId('t'), kind: 'text', rotation: 0, visible: true,
    font: st.font, size: 60, weight: st.weight, color: st.color, color2: st.color2,
    stroke: st.stroke, strokeWidth: 6, glow: st.glow, glowBlur: 24, shadow: true,
    letterSpacing: 2, lineHeight: 1.05, maxWidth: 940, align: 'center', upper: true, ...over
  };
}
function frameFor(st: St, size: number): Frame { return { shape: st.frame, fill: st.plateFill, border: st.plateBorder, borderWidth: Math.max(6, Math.round(size / 36)), opacity: 0.9, pad: Math.round(size * 0.08) }; }
function logo(role: string, name: string, logoId: string, x: number, y: number, size: number, st: St): LogoLayer {
  return { id: newId('l'), kind: 'logo', name, role, logoId, x, y, size, rotation: 0, visible: true, glow: st.glow, glowBlur: 30, shadow: true, frame: frameFor(st, size) };
}
const plate = (st: St, padX: number, padY: number) => ({ fill: st.plateFill, border: st.plateBorder, borderWidth: 5, opacity: 0.86, padX, padY, radius: 22 });
const d3 = (st: St, size: number) => ({ depth: Math.max(6, Math.min(20, Math.round(size * 0.055))), depthColor: st.depth });

export interface LayoutInput { match: Match; category: Category; kind: ProjectKind; theme: string; homeTeam?: Team; awayTeam?: Team; }

const infoLine = (m: Match) => [formatDateIt(m.date), m.time && `ore ${m.time}`].filter(Boolean).join(' · ');

/** Genera i livelli editabili secondo le regole dei template A, B e C. */
export function buildLayers(inp: LayoutInput): Layer[] {
  const { match: m, category: cat, kind } = inp;
  const st = styleForTheme(inp.theme);
  const k = FONT_W[st.font] ?? 0.6;
  const fz = (t: string, base: number, w: number, min = 28, f = k) => fitSize(t, base, w, min, f);
  const L: Layer[] = [];
  const hasHomeLogo = cat.useLogos && !!inp.homeTeam?.logoId;
  const hasAwayLogo = cat.useLogos && !!inp.awayTeam?.logoId;
  const multi = isMulti(m);
  const small = (o: TOver, size: number) => text({ strokeWidth: 4, glowBlur: 14, size, ...o }, st);

  // ---------- RISULTATO (template C) ----------
  if (kind === 'result') {
    const r = m.result ?? { home: 0, away: 0, scorers: '', assists: '', notes: '' };
    const head = [cat.name, m.competition].filter(Boolean).join(' · ');
    L.push(small({ name: 'Categoria', role: 'category', text: head, x: W / 2, y: 90 }, fz(head, 54, 940)));
    if (m.round) L.push(small({ name: 'Giornata', role: 'round', text: ordinalRound(m.round), x: W / 2, y: 160 }, 40));
    L.push(text({ name: 'Risultato', role: 'score', text: `${r.home}-${r.away}`, x: W / 2, y: 560, size: 380, strokeWidth: 14, glowBlur: 50, letterSpacing: 6, maxWidth: 1000, ...d3(st, 380) }, st));
    if (hasHomeLogo && hasAwayLogo) {
      L.push(logo('logo-home', 'Logo casa', inp.homeTeam!.logoId!, 230, 930, 260, st));
      L.push(logo('logo-away', 'Logo ospite', inp.awayTeam!.logoId!, 850, 930, 260, st));
      L.push(small({ name: 'Casa', role: 'home', plate: plate(st, 28, 8), text: m.homeName, x: 230, y: 1100 }, fz(m.homeName, 40, 380)));
      L.push(small({ name: 'Ospite', role: 'away', plate: plate(st, 28, 8), text: m.awayName, x: 850, y: 1100 }, fz(m.awayName, 40, 380)));
    } else {
      L.push(small({ name: 'Casa', role: 'home', plate: plate(st, 28, 8), text: m.homeName, x: 270, y: 840, maxWidth: 480 }, fz(m.homeName, 56, 480)));
      L.push(small({ name: 'Ospite', role: 'away', plate: plate(st, 28, 8), text: m.awayName, x: 810, y: 840, maxWidth: 480 }, fz(m.awayName, 56, 480)));
    }
    const sc = r.scorers.trim(), asx = r.assists.trim();
    const lines = [sc && `⚽ ${sc}`, asx && `🅰 ${asx}`].filter(Boolean).join('\n');
    if (lines) L.push(small({ name: 'Marcatori', role: 'scorers', text: lines, x: W / 2, y: 1210, upper: false, maxWidth: 960, lineHeight: 1.25, font: 'Oswald', weight: 700 }, fz(lines, 38, 960, 24, 0.42)));
    if (r.notes.trim()) L.push(small({ name: 'Note', role: 'notes', text: r.notes.trim(), x: W / 2, y: 1290, upper: false, font: 'Oswald', weight: 700, maxWidth: 960 }, fz(r.notes, 32, 960, 22, 0.42)));
    return L;
  }

  // ---------- TEMPLATE A: titolo = partita ----------
  if (cat.template === 'A') {
    const title = `${m.homeName}\nVS\n${m.awayName}`;
    L.push(text({ name: 'Titolo partita', role: 'title', text: title, x: W / 2, y: hasHomeLogo || hasAwayLogo ? 480 : 560, size: fz(title, 150, 960), maxWidth: 960, strokeWidth: 10, glowBlur: 40, lineHeight: 1.0, ...d3(st, 150) }, st));
    if (hasHomeLogo) L.push(logo('logo-home', 'Logo casa', inp.homeTeam!.logoId!, 260, 925, 290, st));
    if (hasAwayLogo) L.push(logo('logo-away', 'Logo ospite', inp.awayTeam!.logoId!, 820, 925, 290, st));
    const head = [cat.name, m.competition].filter(Boolean).join(' · ');
    L.push(small({ name: 'Competizione', role: 'competition', text: head, x: W / 2, y: 90 }, fz(head, 54, 940)));
    if (m.round) L.push(small({ name: 'Giornata', role: 'round', text: ordinalRound(m.round), x: W / 2, y: 160 }, 44));
    L.push(small({ name: 'Data e ora', role: 'datetime', plate: plate(st, 28, 8), text: infoLine(m), x: W / 2, y: 1160 }, fz(infoLine(m), 52, 980)));
    if (m.venue) L.push(small({ name: 'Luogo', role: 'venue', plate: plate(st, 28, 8), text: m.venue, x: W / 2, y: 1245, font: 'Oswald', weight: 700 }, fz(m.venue, 42, 980, 24, 0.45)));
    return L;
  }

  // ---------- TEMPLATE B: titolo = categoria, squadre come testo ----------
  L.push(text({ name: 'Titolo categoria', role: 'title', text: cat.name, x: W / 2, y: 300, size: fz(cat.name, 230, 960, 60), maxWidth: 960, strokeWidth: 12, glowBlur: 44, ...d3(st, 230) }, st));
  const sub = [m.competition, m.round && ordinalRound(m.round)].filter(Boolean).join(' · ');
  if (sub) L.push(small({ name: 'Competizione', role: 'competition', text: sub, x: W / 2, y: 90 }, fz(sub, 48, 940)));
  const names = allTeamNames(m);
  if (!multi && names.length === 2) {
    L.push(small({ name: 'Casa', role: 'home', plate: plate(st, 28, 8), text: names[0], x: W / 2, y: 650, maxWidth: 980 }, fz(names[0], 90, 980)));
    L.push(small({ name: 'VS', role: 'vs', text: 'VS', x: W / 2, y: 760, color: st.glow, color2: undefined }, 64));
    L.push(small({ name: 'Ospite', role: 'away', plate: plate(st, 28, 8), text: names[1], x: W / 2, y: 870, maxWidth: 980 }, fz(names[1], 90, 980)));
  } else {
    const n = names.length;
    const gap = Math.min(130, Math.floor(620 / Math.max(n, 1)));
    const y0 = 600 + (n <= 4 ? 40 : 0);
    names.forEach((nm, i) => L.push(small({ name: `Squadra ${i + 1}`, role: `team-${i + 1}`, plate: plate(st, 28, 8), text: nm, x: W / 2, y: y0 + i * gap, maxWidth: 980 }, fz(nm, Math.min(84, gap - 18), 980, 24))));
  }
  L.push(small({ name: 'Data e ora', role: 'datetime', plate: plate(st, 28, 8), text: infoLine(m), x: W / 2, y: 1160 }, fz(infoLine(m), 52, 980)));
  if (m.venue) L.push(small({ name: 'Luogo', role: 'venue', plate: plate(st, 28, 8), text: m.venue, x: W / 2, y: 1245, font: 'Oswald', weight: 700 }, fz(m.venue, 42, 980, 24, 0.45)));
  return L;
}

export function newProject(match: Match, kind: ProjectKind, theme: string, layers: Layer[], seed: number, prompt: string): Project {
  const now = Date.now();
  return { id: newId('p'), matchId: match.id, kind, theme, layers, versions: [], prompt, seed, description: '', createdAt: now, updatedAt: now };
}
