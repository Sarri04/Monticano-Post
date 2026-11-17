import { useStore } from './store';
import type { Nav } from './App';
import { formatDateIt } from '../core/outcome';

export function Home({ nav }: { nav: Nav }) {
  const { matches, projects, categories } = useStore();
  const cat = (id: string) => categories.find(c => c.id === id)?.name ?? '';
  const upcoming = matches.filter(m => !m.archived).sort((a, b) => (a.date || '9').localeCompare(b.date || '9')).slice(0, 6);
  const recentP = [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  return (<>
    <h1>Programmi Monticano</h1>
    <div className="row"><button className="b grow" onClick={() => nav.go('matches', {})}>＋ Nuova partita</button><button className="b s grow" onClick={() => nav.go('gen')}>✨ Genera grafica</button></div>
    <h2>Partite in programma</h2>
    {upcoming.length === 0 && <p className="mut">Nessuna partita. Inizia da “Nuova partita”.</p>}
    {upcoming.map(m => <div className="card" key={m.id}><b>{m.homeName} – {m.awayName || '…'}</b><div className="mut">{cat(m.categoryId)} · {m.date ? formatDateIt(m.date) : 'data da definire'} {m.time && `· ${m.time}`}{m.result && ` · risultato ${m.result.home}-${m.result.away}`}</div>
      <div className="row" style={{ marginTop: 8 }}><button className="b sm" onClick={() => nav.go('gen', { matchId: m.id })}>Genera</button></div></div>)}
    <h2>Progetti in lavorazione</h2>
    {recentP.length === 0 && <p className="mut">Ancora nessun progetto salvato.</p>}
    {recentP.map(p => { const m = matches.find(x => x.id === p.matchId); return <div className="card" key={p.id} onClick={() => nav.go('gen', { projectId: p.id })}><b>{p.kind === 'result' ? 'Risultato' : 'Partita'} · {m ? `${m.homeName} – ${m.awayName}` : '—'}</b><div className="mut">Tema: {p.theme} · {new Date(p.updatedAt).toLocaleString('it-IT')}</div></div>; })}
  </>);
}
