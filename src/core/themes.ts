export interface ThemeStyle { name: string; kind: 'film' | 'game'; font: string; weight: number; color: string; color2?: string; stroke: string; glow: string; palette: string; scene: string; }

/** Catalogo iniziale: l'estetica è descritta a parole, senza riprodurre artwork, personaggi o attori reali. */
export const THEMES: ThemeStyle[] = [
  { name: 'GTA 6', kind: 'game', font: 'Anton', weight: 400, color: '#ffd1f0', color2: '#ff5fa8', stroke: '#2a0a3a', glow: '#ff3d9a', palette: 'neon pink and teal sunset, tropical Florida coast', scene: 'sun-drenched neon-lit Miami-style beachfront with palm trees, sports cars, glossy heat haze' },
  { name: 'Pokémon', kind: 'game', font: 'Press Start 2P', weight: 400, color: '#ffe14d', color2: '#ffb300', stroke: '#1f4fb8', glow: '#ffe14d', palette: 'bright primary colors, grass green, sky blue', scene: 'vibrant fantasy meadow with glowing energy orbs, anime-style creatures silhouettes, adventure feeling' },
  { name: 'Fast & Furious', kind: 'film', font: 'Anton', weight: 400, color: '#ffffff', color2: '#9fb4c8', stroke: '#0b0f14', glow: '#2fa8ff', palette: 'night city blue and orange, chrome', scene: 'street racing at night, tuned cars, light streaks, wet asphalt reflections, motion blur' },
  { name: 'Mission: Impossible', kind: 'film', font: 'Oswald', weight: 700, color: '#e8ecef', color2: '#7f8c96', stroke: '#050709', glow: '#ff3b2f', palette: 'cold steel grey with red fuse accents', scene: 'secret agent action, rooftop chase, dramatic skyline, burning fuse light, high tension' },
  { name: 'John Wick', kind: 'film', font: 'Bebas Neue', weight: 400, color: '#f2f2f2', color2: '#9a9a9a', stroke: '#000000', glow: '#ff2a2a', palette: 'black, deep blue neon, blood red accents', scene: 'rainy neon noir city night, hotel lobby, cinematic silhouette, moody smoke' },
  { name: 'Rocky', kind: 'film', font: 'Black Ops One', weight: 400, color: '#f6e7c1', color2: '#d9a441', stroke: '#2b1608', glow: '#ffb347', palette: 'gritty warm gold and brown, vintage 70s film', scene: 'dusty boxing gym, stone steps at dawn, grainy golden light, determination' },
  { name: 'Pirati dei Caraibi', kind: 'film', font: 'Cinzel', weight: 700, color: '#f7e3a0', color2: '#b9892f', stroke: '#2a1706', glow: '#ffcf6b', palette: 'weathered gold, teal sea, parchment', scene: 'stormy sea, wooden galleon with torn sails, treasure and lanterns, mist' },
  { name: 'Il Signore degli Anelli', kind: 'film', font: 'Cinzel', weight: 700, color: '#f4ecd0', color2: '#c9a74f', stroke: '#1b1608', glow: '#ffd36b', palette: 'epic fantasy gold, misty green, ancient stone', scene: 'epic fantasy landscape, misty mountains, ancient ruins, golden glowing ring light' },
  { name: 'Top Gun', kind: 'film', font: 'Oswald', weight: 700, color: '#ffffff', color2: '#ffc27a', stroke: '#0a1a33', glow: '#ff9a3c', palette: 'golden hour orange sky, navy blue', scene: 'fighter jets over a carrier at golden hour, contrails, lens flare, aviator sunglasses silhouette' },
  { name: 'Star Wars', kind: 'film', font: 'Orbitron', weight: 800, color: '#ffe81f', color2: '#ffb800', stroke: '#050505', glow: '#ffe81f', palette: 'deep space black, yellow, laser blue and red', scene: 'epic space battle, desert planet with twin suns, starfighters, glowing laser swords silhouettes' },
  { name: 'Jurassic Park', kind: 'film', font: 'Black Ops One', weight: 400, color: '#f3d9a4', color2: '#d6681a', stroke: '#1a0d04', glow: '#ff8a1f', palette: 'jungle green, amber, warning orange', scene: 'dense jungle, giant prehistoric reptile silhouette, amber glow, rain and fog, electric fence' }
];

export function findTheme(name: string): ThemeStyle | undefined {
  const n = name.trim().toLowerCase();
  return THEMES.find(t => t.name.toLowerCase() === n);
}

/** Per temi non in catalogo si sceglie uno stile tipografico stabile a partire dal nome. */
export function styleForTheme(name: string): ThemeStyle {
  const known = findTheme(name);
  if (known) return known;
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { ...THEMES[h % THEMES.length], name, scene: 'cinematic atmosphere faithful to the mood of the title' };
}

export function randomTheme(exclude: string[] = []): ThemeStyle {
  const c = THEMES.filter(t => !exclude.includes(t.name));
  const p = c.length ? c : THEMES;
  return p[Math.floor(Math.random() * p.length)];
}
