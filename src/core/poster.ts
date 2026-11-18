import type { Category, LogoRec, Match, Outcome, ProjectKind, Team } from './types';
import { formatDateIt, ordinalRound } from './outcome';
import { styleForTheme } from './themes';
import { allTeamNames, isMulti } from './layout';

/** Modalità "integrata": l'AI disegna l'intera grafica (titolo a tema, stemmi nella scena, barra info) come nei tuoi post. */
export interface PosterOptions { match: Match; cat: Category; kind: ProjectKind; theme: string; outcome?: Outcome | null; seed: number; hasHomeLogo: boolean; hasAwayLogo: boolean; extra?: string; }

const MOOD: Record<Outcome, string> = {
  win: 'triumphant, explosive, victorious energy, bright warm light',
  loss: 'dramatic, darker and tense mood, respectful and not offensive',
  draw: 'balanced tense face-off, two opposing colors'
};

export function buildPosterPrompt(o: PosterOptions): string {
  const { match: m, cat, kind } = o; const st = styleForTheme(o.theme);
  const head = [cat.name, m.competition && m.competition.toLowerCase() !== cat.name.toLowerCase() ? m.competition : '', m.round ? ordinalRound(m.round) : ''].filter(Boolean).join(' · ').toUpperCase();
  const info = [formatDateIt(m.date), m.time && `ORE ${m.time}`, m.venue].filter(Boolean).join(' · ').toUpperCase();
  const names = allTeamNames(m).map(s => s.toUpperCase());
  const p: string[] = [
    `Vertical 4:5 Instagram sports poster for a futsal match, fully integrated artwork in the visual universe of "${o.theme}" (${st.scene}). Color palette: ${st.palette}. Vivid saturated colors, dramatic lighting, polished illustrated game-art look, the lettering, shields and info bar all share the theme's style so everything looks like one single piece`
  ];
  const crests = (o.hasHomeLogo || o.hasAwayLogo) && cat.useLogos;
  if (kind === 'result') {
    const r = m.result ?? { home: 0, away: 0 };
    p.push(`Top small line: "${head}"`);
    p.push(`Huge central title lettering in the theme's logo style reading exactly: "${r.home}-${r.away}"`);
    p.push(`Team names written exactly: "${m.homeName.toUpperCase()}" and "${m.awayName.toUpperCase()}"`);
    if (o.outcome) p.push(`Mood: ${MOOD[o.outcome]}`);
  } else if (cat.template === 'A') {
    p.push(`Top small line: "${head}"`);
    p.push(`Huge title lettering in the theme's logo style reading exactly: "${m.homeName.toUpperCase()} VS ${m.awayName.toUpperCase()}"`);
    p.push('Symmetrical face-off scene: iconic elements of the theme on the left and on the right, a glowing emblematic object in the center');
  } else {
    p.push(`Huge title lettering in the theme's logo style reading exactly: "${cat.name.toUpperCase()}"`);
    if (head && head !== cat.name.toUpperCase()) p.push(`Small line: "${head.replace(cat.name.toUpperCase() + ' · ', '')}"`);
    p.push(isMulti(m) ? `Team names stacked as a list on themed plates, written exactly: ${names.map(n => `"${n}"`).join(', ')}` : `Team names on themed banners, written exactly: "${names[0]}" and "${names[1]}", separated by a lettering "VS"`);
    p.push('Symmetrical face-off scene with iconic elements of the theme on the left and right');
  }
  if (crests && kind !== 'result' && cat.template === 'A') {
    const refs: string[] = []; if (o.hasHomeLogo) refs.push('the crest of the home team'); if (o.hasAwayLogo) refs.push('the crest of the away team');
    p.push(`The reference images are ${refs.join(' and ')}, in this order: reproduce each crest exactly as provided (same shape, colors and lettering, undistorted), large, integrated in the scene like a shield or a flag, home on the left and away on the right`);
  } else if (crests && kind === 'result') {
    p.push('The reference images are the two team crests, home then away: reproduce them exactly as provided, undistorted, integrated in the scene');
  }
  if (info) p.push(`Bottom: a themed info bar with exactly this text: "${info}"`);
  p.push('Spell all quoted text exactly, letter by letter. No other text, no watermark, no extra logos');
  if (o.extra) p.push(o.extra);
  return p.join('. ');
}

async function toRef(blob: Blob): Promise<string> {
  const bm = await createImageBitmap(blob); const k = Math.min(1, 448 / Math.max(bm.width, bm.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bm.width * k)); c.height = Math.max(1, Math.round(bm.height * k));
  c.getContext('2d')!.drawImage(bm, 0, 0, c.width, c.height); return c.toDataURL('image/png');
}
/** Loghi (casa, ospite) come immagini di riferimento, sotto i 512px richiesti dal modello. */
export async function logoRefs(home: Team | undefined, away: Team | undefined, logos: LogoRec[]): Promise<{ refs: string[]; hasHome: boolean; hasAway: boolean }> {
  const find = (t?: Team) => logos.find(l => l.id === t?.logoId);
  const h = find(home), a = find(away); const refs: string[] = [];
  if (h) refs.push(await toRef(h.blob)); if (a) refs.push(await toRef(a.blob));
  return { refs, hasHome: !!h, hasAway: !!a };
}
