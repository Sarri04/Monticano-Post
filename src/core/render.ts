import type { Layer, LogoLayer, Project, TextLayer } from './types';
import { H, W } from './types';
import { styleForTheme } from './themes';

export type Img = CanvasImageSource & { width: number; height: number };
export type LogoImages = Map<string, Img>;
type Ctx = CanvasRenderingContext2D;

export const FONT_LIST = ['Anton', 'Bebas Neue', 'Oswald', 'Cinzel', 'Orbitron', 'Permanent Marker', 'Black Ops One', 'Press Start 2P'];

export async function loadFonts(layers: Layer[]) {
  const fonts = new Set(layers.filter((l): l is TextLayer => l.kind === 'text').map(l => `${l.weight} 40px "${l.font}"`));
  await Promise.all([...fonts].map(f => document.fonts.load(f).catch(() => [])));
}

function setFont(ctx: Ctx, l: TextLayer) { ctx.font = `${l.weight} ${l.size}px "${l.font}", Impact, sans-serif`; }
function lineWidth(ctx: Ctx, s: string, l: TextLayer) { setFont(ctx, l); return ctx.measureText(s).width + l.letterSpacing * Math.max(0, s.length - 1); }

export function wrapLines(ctx: Ctx, l: TextLayer): string[] {
  const raw = l.upper ? l.text.toUpperCase() : l.text;
  const out: string[] = [];
  for (const para of raw.split('\n')) {
    let cur = '';
    for (const w of para.split(/\s+/)) { const t = cur ? `${cur} ${w}` : w; if (cur && lineWidth(ctx, t, l) > l.maxWidth) { out.push(cur); cur = w; } else cur = t; }
    out.push(cur);
  }
  return out;
}
export function textBounds(ctx: Ctx, l: TextLayer) {
  const lines = wrapLines(ctx, l); const lh = l.size * l.lineHeight;
  return { w: Math.max(...lines.map(s => lineWidth(ctx, s, l)), 10) + l.strokeWidth * 2, h: lines.length * lh + l.strokeWidth * 2, lines, lh };
}
export function logoBounds(l: LogoLayer, img?: { width: number; height: number }) {
  if (!img) return { w: l.size, h: l.size };
  const k = l.size / Math.max(img.width, img.height); return { w: img.width * k, h: img.height * k };
}
export function layerBounds(ctx: Ctx, l: Layer, logos: LogoImages) {
  return l.kind === 'text' ? textBounds(ctx, l) : logoBounds(l, logos.get(l.logoId));
}

function drawText(ctx: Ctx, l: TextLayer) {
  const { w, h, lines, lh } = textBounds(ctx, l);
  ctx.save(); ctx.translate(l.x, l.y); ctx.rotate((l.rotation * Math.PI) / 180);
  setFont(ctx, l); ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.textAlign = 'left';
  const grad = l.color2 ? (() => { const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, l.color); g.addColorStop(1, l.color2); return g; })() : l.color;
  const y0 = -((lines.length - 1) * lh) / 2;
  const pass = (fn: (s: string, x: number, y: number) => void) => lines.forEach((s, i) => {
    const lw = lineWidth(ctx, s, l); let x = l.align === 'center' ? -lw / 2 : l.align === 'left' ? -w / 2 : w / 2 - lw; const y = y0 + i * lh;
    if (!l.letterSpacing) { fn(s, x, y); return; }
    for (const ch of s) { fn(ch, x, y); x += ctx.measureText(ch).width + l.letterSpacing; }
  });
  if (l.glowBlur > 0 && l.glow) { ctx.shadowColor = l.glow; ctx.shadowBlur = l.glowBlur; ctx.fillStyle = l.glow; pass((s, x, y) => ctx.fillText(s, x, y)); ctx.shadowBlur = l.glowBlur * 1.8; pass((s, x, y) => ctx.fillText(s, x, y)); }
  if (l.shadow) { ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = Math.max(4, l.size * 0.05); }
  else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
  if (l.strokeWidth > 0) { ctx.lineWidth = l.strokeWidth * 2; ctx.strokeStyle = l.stroke; pass((s, x, y) => ctx.strokeText(s, x, y)); }
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = grad; pass((s, x, y) => ctx.fillText(s, x, y));
  ctx.restore();
}

/** Il logo è disegnato con le sue proporzioni originali: nessuna deformazione né ritocco dei pixel, solo luce/ombra attorno. */
function drawLogo(ctx: Ctx, l: LogoLayer, img?: Img) {
  if (!img) return; const { w, h } = logoBounds(l, img);
  ctx.save(); ctx.translate(l.x, l.y); ctx.rotate((l.rotation * Math.PI) / 180);
  if (l.glowBlur > 0 && l.glow) { ctx.shadowColor = l.glow; ctx.shadowBlur = l.glowBlur; ctx.drawImage(img, -w / 2, -h / 2, w, h); }
  if (l.shadow) { ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12; } else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
  ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
}

export function drawBackground(ctx: Ctx, bg: Img | null, theme: string) {
  const st = styleForTheme(theme);
  if (bg) { const k = Math.max(W / bg.width, H / bg.height); const w = bg.width * k, h = bg.height * k; ctx.drawImage(bg, (W - w) / 2, (H - h) / 2, w, h); }
  else { // sfondo di riserva procedurale: NON è generato dall'AI
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0b1f3a'); g.addColorStop(0.5, st.stroke === '#000000' ? '#18222f' : st.stroke); g.addColorStop(1, '#050b16'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.45, 760); r.addColorStop(0, st.glow + '66'); r.addColorStop(1, 'transparent'); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  }
}
/** Integrazione: grading con il colore del tema, scrim alto/basso, vignettatura. */
function drawGrade(ctx: Ctx, theme: string) {
  const st = styleForTheme(theme);
  ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.28; ctx.fillStyle = st.glow; ctx.fillRect(0, 0, W, H); ctx.restore();
  const top = ctx.createLinearGradient(0, 0, 0, 330); top.addColorStop(0, 'rgba(0,0,0,.62)'); top.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = top; ctx.fillRect(0, 0, W, 330);
  const bot = ctx.createLinearGradient(0, H - 380, 0, H); bot.addColorStop(0, 'rgba(0,0,0,0)'); bot.addColorStop(1, 'rgba(0,0,0,.72)'); ctx.fillStyle = bot; ctx.fillRect(0, H - 380, W, 380);
  const v = ctx.createRadialGradient(W / 2, H / 2, 420, W / 2, H / 2, 960); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

export function drawProject(ctx: Ctx, p: Pick<Project, 'layers' | 'theme'>, bg: Img | null, logos: LogoImages, opts: { selectedId?: string | null } = {}) {
  ctx.clearRect(0, 0, W, H); drawBackground(ctx, bg, p.theme); drawGrade(ctx, p.theme);
  for (const l of p.layers) { if (!l.visible) continue; if (l.kind === 'text') drawText(ctx, l); else drawLogo(ctx, l, logos.get(l.logoId)); }
  if (opts.selectedId) {
    const l = p.layers.find(x => x.id === opts.selectedId); if (l && l.visible) {
      const b = layerBounds(ctx, l, logos); ctx.save(); ctx.translate(l.x, l.y); ctx.rotate((l.rotation * Math.PI) / 180);
      ctx.setLineDash([14, 10]); ctx.lineWidth = 3; ctx.strokeStyle = '#35c6ff'; ctx.strokeRect(-b.w / 2 - 8, -b.h / 2 - 8, b.w + 16, b.h + 16); ctx.restore();
    }
  }
}

export function hitTest(ctx: Ctx, layers: Layer[], logos: LogoImages, px: number, py: number): Layer | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i]; if (!l.visible) continue; const b = layerBounds(ctx, l, logos);
    const a = (-l.rotation * Math.PI) / 180; const dx = px - l.x, dy = py - l.y;
    const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= b.w / 2 + 14 && Math.abs(ly) <= b.h / 2 + 14) return l;
  }
  return null;
}

export async function exportPng(p: Pick<Project, 'layers' | 'theme'>, bg: Blob | null, logoBlobs: Map<string, Blob>): Promise<Blob> {
  await loadFonts(p.layers);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d')!;
  const bgImg = bg ? await createImageBitmap(bg) : null; const logos: LogoImages = new Map();
  for (const [id, b] of logoBlobs) logos.set(id, await createImageBitmap(b));
  drawProject(ctx, p, bgImg, logos);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Esportazione non riuscita'))), 'image/png'));
}
