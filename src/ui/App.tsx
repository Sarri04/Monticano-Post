import { useState } from 'react';
import { StoreProvider } from './store';
import { Home } from './Home';
import { Matches } from './Matches';
import { Generator } from './Generator';
import { Editor } from './Editor';
import { Archive } from './Archive';
import { SettingsScreen } from './Settings';

export type Tab = 'home' | 'matches' | 'gen' | 'archive' | 'settings';
export interface Nav { tab: Tab; projectId?: string; matchId?: string; go: (tab: Tab, o?: { projectId?: string; matchId?: string }) => void; }
const TABS: [Tab, string, string][] = [['home', '🏠', 'Home'], ['matches', '⚽', 'Partite'], ['gen', '✨', 'Genera'], ['archive', '🗂', 'Archivio'], ['settings', '⚙️', 'Impostazioni']];

export function App() {
  const [st, setSt] = useState<{ tab: Tab; projectId?: string; matchId?: string }>({ tab: 'home' });
  const nav: Nav = { ...st, go: (tab, o) => setSt({ tab, ...o }) };
  return (
    <StoreProvider>
      <div className="app">
        <div className="main">
          {st.projectId ? <Editor key={st.projectId} nav={nav} /> :
            st.tab === 'home' ? <Home nav={nav} /> : st.tab === 'matches' ? <Matches nav={nav} /> :
            st.tab === 'gen' ? <Generator nav={nav} /> : st.tab === 'archive' ? <Archive /> : <SettingsScreen />}
        </div>
        <nav className="nav">{TABS.map(([t, i, l]) => <button key={t} className={st.tab === t && !st.projectId ? 'on' : ''} onClick={() => nav.go(t)}><span>{i}</span>{l}</button>)}</nav>
      </div>
    </StoreProvider>
  );
}
