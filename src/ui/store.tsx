import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Category, LogoRec, Match, Project, Settings, Team } from '../core/types';
import { getAll, getSettings, getTemplates, getRecentThemes } from '../core/db';
import type { DescTemplates } from '../core/description';

export interface Store { categories: Category[]; teams: Team[]; logos: LogoRec[]; matches: Match[]; projects: Project[]; settings: Settings; templates: DescTemplates | null; recent: string[]; refresh: () => Promise<void>; toast: (m: string) => void; }
const Ctx = createContext<Store>(null as never);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Omit<Store, 'refresh' | 'toast'>>({ categories: [], teams: [], logos: [], matches: [], projects: [], settings: { workerUrl: '', workerToken: '' }, templates: null, recent: [] });
  const [msg, setMsg] = useState('');
  const refresh = useCallback(async () => {
    const [categories, teams, logos, matches, projects, settings, templates, recent] = await Promise.all([getAll('categories'), getAll('teams'), getAll('logos'), getAll('matches'), getAll('projects'), getSettings(), getTemplates(), getRecentThemes()]);
    setS({ categories, teams, logos, matches, projects, settings, templates, recent });
  }, []);
  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4200); }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <Ctx.Provider value={{ ...s, refresh, toast }}>{children}{msg && <div className="toast" onClick={() => setMsg('')}>{msg}</div>}</Ctx.Provider>;
}
