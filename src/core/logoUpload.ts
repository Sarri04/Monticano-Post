import { getAll, put } from './db';
import { newId } from './layout';

/** Legge un'immagine e la riduce (max 800px) in PNG, senza alterarne le proporzioni. */
export async function fileToPngBlob(f: Blob, max = 800): Promise<Blob> {
  const bm = await createImageBitmap(f);
  const k = Math.min(1, max / Math.max(bm.width, bm.height));
  const c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
  c.getContext('2d')!.drawImage(bm, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('png'))), 'image/png'));
}

/** Salva il logo e lo collega alla squadra con quel nome (la crea se non esiste). Restituisce l'id squadra. */
export async function saveTeamLogo(teamName: string, categoryId: string | undefined, blob: Blob): Promise<string> {
  const name = teamName.trim();
  const logoId = newId('logo');
  await put('logos', { id: logoId, name, blob });
  const teams = await getAll('teams');
  const t = teams.find(x => x.name.toLowerCase() === name.toLowerCase());
  const team = t ? { ...t, logoId } : { id: newId('team'), name, categoryId, logoId };
  await put('teams', team);
  return team.id;
}
