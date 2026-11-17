import type { Outcome, TemplateKind } from './types';
import { styleForTheme } from './themes';

const SHOTS = ['wide establishing shot', 'low-angle hero shot', 'dramatic aerial view', 'tight cinematic close framing', 'symmetrical centered composition', 'dutch angle dynamic composition', 'silhouette against strong backlight'];
const TIMES = ['golden hour', 'blue hour twilight', 'night with neon lights', 'stormy overcast', 'harsh midday sun', 'foggy dawn'];
const MOOD: Record<Outcome, string> = {
  win: 'triumphant, energetic, dominant mood with bright warm highlights',
  loss: 'dramatic, intense and melancholic mood, darker tones, respectful and not offensive',
  draw: 'balanced, tense face-off mood with two opposing light colors'
};
const NEG = 'no text, no letters, no numbers, no watermark, no logo, no captions, no recognizable real people faces, no copyrighted characters';

export interface PromptOptions { theme: string; template: TemplateKind | 'R'; outcome?: Outcome | null; seed: number; extra?: string; sceneOverride?: string; }

/** Prompt dello SFONDO: i testi e i loghi sono sempre aggiunti dall'app, mai dall'AI. */
export function buildBackgroundPrompt(o: PromptOptions): string {
  const st = styleForTheme(o.theme);
  const shot = SHOTS[o.seed % SHOTS.length];
  const time = TIMES[Math.floor(o.seed / 7) % TIMES.length];
  const parts = [
    `Cinematic vertical movie poster background artwork, 4:5 portrait, inspired by the visual aesthetic of "${o.theme}" (original artwork, not a copy)`,
    `Scene: ${o.sceneOverride ?? st.scene}`,
    `Color palette: ${st.palette}`,
    `${shot}, ${time}`,
    'wide empty space in the upper third and lower third for typography, strong depth, professional lighting, ultra detailed',
    'sports futsal atmosphere subtly hinted (indoor court light, football) without any text'
  ];
  if (o.outcome) parts.push(MOOD[o.outcome]);
  if (o.extra) parts.push(o.extra);
  parts.push(NEG);
  return parts.join('. ');
}
