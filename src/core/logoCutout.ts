/**
 * Rimozione di uno sfondo uniforme dal logo: flood-fill dai bordi sui pixel simili al colore d'angolo.
 * Non modifica nessun pixel interno al disegno: rende trasparenti solo i pixel raggiungibili dall'esterno.
 * data = RGBA (come ImageData.data). Ritorna il numero di pixel resi trasparenti.
 */
export function removeUniformBackground(data: Uint8ClampedArray | Uint8Array, w: number, h: number, tolerance = 28): number {
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map(p => p * 4);
  const ref = [data[corners[0]], data[corners[0] + 1], data[corners[0] + 2]];
  const dist = (i: number) => Math.max(Math.abs(data[i] - ref[0]), Math.abs(data[i + 1] - ref[1]), Math.abs(data[i + 2] - ref[2]));
  if (data[corners[0] + 3] < 10) return 0; // già trasparente
  if (corners.some(c => dist(c) > tolerance)) return 0; // angoli discordi: nessuno sfondo uniforme
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => { const p = y * w + x; if (!seen[p]) { seen[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  let cleared = 0;
  while (stack.length) {
    const p = stack.pop()!; const i = p * 4;
    if (dist(i) > tolerance) continue;
    data[i + 3] = 0; cleared++;
    const x = p % w, y = (p - x) / w;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  return cleared;
}
