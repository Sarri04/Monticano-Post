import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Category, LogoRec, Match, Project, Settings, Team } from './types';
import { newId } from './layout';
import { DEFAULT_TEMPLATES, type DescTemplates } from './description';

interface Schema extends DBSchema {
  categories: { key: string; value: Category };
  teams: { key: string; value: Team };
  logos: { key: string; value: LogoRec };
  matches: { key: string; value: Match };
  projects: { key: string; value: Project; indexes: { byMatch: string } };
  kv: { key: string; value: unknown };
}
type Store = 'categories' | 'teams' | 'logos' | 'matches' | 'projects';
let dbp: Promise<IDBPDatabase<Schema>> | null = null;
export function db() {
  dbp ??= openDB<Schema>('monticano-post', 1, {
    upgrade(d) {
      d.createObjectStore('categories', { keyPath: 'id' });
      d.createObjectStore('teams', { keyPath: 'id' });
      d.createObjectStore('logos', { keyPath: 'id' });
      d.createObjectStore('matches', { keyPath: 'id' });
      d.createObjectStore('projects', { keyPath: 'id' }).createIndex('byMatch', 'matchId');
      d.createObjectStore('kv');
    }
  });
  return dbp;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-c2', name: 'Serie C2', template: 'A', useLogos: true },
  { id: 'cat-d', name: 'Serie D', template: 'B', useLogos: false },
  { id: 'cat-u17', name: 'Under 17', template: 'B', useLogos: false },
  { id: 'cat-u15', name: 'Under 15', template: 'B', useLogos: false },
  { id: 'cat-u12', name: 'Under 12', template: 'B', useLogos: false },
  { id: 'cat-u10', name: 'Under 10', template: 'B', useLogos: false },
  { id: 'cat-eso', name: 'Esordienti', template: 'B', useLogos: false }
];

export async function ensureSeed() {
  const d = await db();
  if ((await d.count('categories')) === 0) for (const c of DEFAULT_CATEGORIES) await d.put('categories', c);
  const monti = (await d.getAll('teams')).find(t => t.isMonticano);
  if (!monti) await d.put('teams', { id: 'team-monticano', name: 'Monticano C5', short: 'Monticano', isMonticano: true });
}

export const getAll = async <K extends Store>(s: K) => (await db()).getAll(s);
export const put = async <K extends Store>(s: K, v: Schema[K]['value']) => { await (await db()).put(s, v); };
export const del = async (s: Store, id: string) => (await db()).delete(s, id);
export async function deleteMatch(id: string) {
  const d = await db(); const ps = await d.getAllFromIndex('projects', 'byMatch', id);
  for (const p of ps) await d.delete('projects', p.id); await d.delete('matches', id);
}
export const getSettings = async (): Promise<Settings> => ({ workerUrl: '', workerToken: '', ...(((await (await db()).get('kv', 'settings')) as Settings | undefined) ?? {}) });
export const saveSettings = async (s: Settings) => { await (await db()).put('kv', s, 'settings'); };
export const getTemplates = async (): Promise<DescTemplates> => ({ ...DEFAULT_TEMPLATES, ...(((await (await db()).get('kv', 'templates')) as DescTemplates | undefined) ?? {}) });
export const saveTemplates = async (t: DescTemplates) => { await (await db()).put('kv', t, 'templates'); };
export const getRecentThemes = async (): Promise<string[]> => ((await (await db()).get('kv', 'recentThemes')) as string[] | undefined) ?? [];
export async function pushTheme(t: string) { const r = (await getRecentThemes()).filter(x => x !== t); r.unshift(t); await (await db()).put('kv', r.slice(0, 30), 'recentThemes'); }

export function emptyMatch(categoryId: string): Match {
  return { id: newId('m'), categoryId, competition: '', round: '', homeName: 'Monticano C5', awayName: '', extraTeams: [], date: '', time: '', venue: '', monticanoHome: true, theme: '', archived: false, createdAt: Date.now() };
}

// ---------- Backup ----------
const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
const dataUrlToBlob = async (u: string) => (await fetch(u)).blob();

export async function exportBackup(): Promise<Blob> {
  const d = await db();
  const logos = await Promise.all((await d.getAll('logos')).map(async l => ({ ...l, blob: await blobToDataUrl(l.blob) })));
  const projects = await Promise.all((await d.getAll('projects')).map(async p => ({
    ...p, bgBlob: p.bgBlob ? await blobToDataUrl(p.bgBlob) : undefined,
    versions: await Promise.all(p.versions.map(async v => ({ ...v, bg: await blobToDataUrl(v.bg) })))
  })));
  const out = { app: 'monticano-post', version: 1, exportedAt: new Date().toISOString(), categories: await d.getAll('categories'), teams: await d.getAll('teams'), matches: await d.getAll('matches'), logos, projects, templates: await getTemplates(), recentThemes: await getRecentThemes() };
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}
export async function importBackup(file: Blob): Promise<{ matches: number; projects: number; teams: number }> {
  const data = JSON.parse(await file.text());
  if (data?.app !== 'monticano-post') throw new Error('File di backup non riconosciuto.');
  // Le conversioni data-URL -> Blob (async, fetch) vanno fatte PRIMA di aprire la transazione IndexedDB,
  // altrimenti la transazione si chiude da sola.
  const logos: LogoRec[] = await Promise.all((data.logos ?? []).map(async (l: any) => ({ ...l, blob: await dataUrlToBlob(l.blob) })));
  const projects: Project[] = await Promise.all((data.projects ?? []).map(async (p: any) => ({
    ...p, bgBlob: p.bgBlob ? await dataUrlToBlob(p.bgBlob) : undefined,
    versions: await Promise.all((p.versions ?? []).map(async (v: any) => ({ ...v, bg: await dataUrlToBlob(v.bg) })))
  })));
  const d = await db(); const tx = d.transaction(['categories', 'teams', 'logos', 'matches', 'projects', 'kv'], 'readwrite');
  for (const s of ['categories', 'teams', 'logos', 'matches', 'projects'] as const) await tx.objectStore(s).clear();
  for (const c of data.categories ?? []) await tx.objectStore('categories').put(c);
  for (const t of data.teams ?? []) await tx.objectStore('teams').put(t);
  for (const l of logos) await tx.objectStore('logos').put(l);
  for (const m of data.matches ?? []) await tx.objectStore('matches').put(m);
  for (const p of projects) await tx.objectStore('projects').put(p);
  if (data.templates) await tx.objectStore('kv').put(data.templates, 'templates');
  if (data.recentThemes) await tx.objectStore('kv').put(data.recentThemes, 'recentThemes');
  await tx.done;
  return { matches: (data.matches ?? []).length, projects: projects.length, teams: (data.teams ?? []).length };
}
