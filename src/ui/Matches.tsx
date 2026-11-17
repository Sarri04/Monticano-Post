import { useState } from 'react';
import { useStore } from './store';
import type { Nav } from './App';
import type { Match } from '../core/types';
import { deleteMatch, emptyMatch, getAll, put } from '../core/db';
import { newId } from '../core/layout';
import { outcomeFor, outcomeLabel } from '../core/outcome';
import { fileToPngBlob, saveTeamLogo } from '../core/logoUpload';

export function Matches({ nav }: { nav: Nav }) {
  const { matches, categories, teams, refresh, toast } = useStore();
  const [edit, setEdit] = useState<Match | null>(null);
  const [filter, setFilter] = useState(''); const [showArch, setShowArch] = useState(false);
  if (edit) return <MatchForm m={edit} onClose={() => { setEdit(null); void refresh(); }} />;
  const list = matches.filter(m => (!filter || m.categoryId === filter) && m.archived === showArch).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const cname = (id: string) => categories.find(c => c.id === id)?.name ?? '';
  const dup = async (m: Match) => { await put('matches', { ...m, id: newId('m'), result: undefined, createdAt: Date.now(), archived: false }); await refresh(); toast('Partita duplicata (senza risultato).'); };
  return (<>
    <h1>Partite</h1>
    <div className="row"><button className="b grow" onClick={() => setEdit(emptyMatch(categories[0]?.id ?? ''))}>＋ Nuova partita</button></div>
    <div className="row" style={{ marginTop: 10 }}>
      <select value={filter} onChange={e => setFilter(e.target.value)}><option value="">Tutte le categorie</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <button className="b s sm" onClick={() => setShowArch(!showArch)}>{showArch ? 'Attive' : 'Archivio'}</button>
    </div>
    {list.length === 0 && <p className="mut">Nessuna partita.</p>}
    {list.map(m => { const o = outcomeFor(m); return (
      <div className="card" key={m.id}>
        <b>{m.homeName} – {m.awayName || '…'}{m.extraTeams.length ? ` + ${m.extraTeams.length}` : ''}</b>
        <div className="mut">{cname(m.categoryId)} · {m.date || 'data da definire'} {m.time}{m.venue && ` · ${m.venue}`}</div>
        {m.result && <div><span className="pill">{m.result.home}-{m.result.away}</span>{o && <span className="pill">{outcomeLabel[o]}</span>}</div>}
        <div className="row wrap" style={{ marginTop: 8 }}>
          <button className="b sm" onClick={() => nav.go('gen', { matchId: m.id })}>Genera grafica</button>
          <button className="b s sm" onClick={() => setEdit(m)}>Modifica / risultato</button>
          <button className="b s sm" onClick={() => dup(m)}>Duplica</button>
          <button className="b s sm" onClick={async () => { await put('matches', { ...m, archived: !m.archived }); await refresh(); }}>{m.archived ? 'Ripristina' : 'Archivia'}</button>
          <button className="b d sm" onClick={async () => { if (confirm('Eliminare la partita e i suoi progetti?')) { await deleteMatch(m.id); await refresh(); } }}>Elimina</button>
        </div></div>); })}
    <datalist id="teamlist">{teams.map(t => <option key={t.id} value={t.name} />)}</datalist>
  </>);
}

function LogoPick({ name, categoryId }: { name: string; categoryId: string }) {
  const { teams, logos, refresh, toast } = useStore();
  const t = teams.find(x => x.name.toLowerCase() === name.trim().toLowerCase());
  const l = logos.find(x => x.id === t?.logoId);
  const url = l ? URL.createObjectURL(l.blob) : '';
  const onFile = async (f: File) => { try { await saveTeamLogo(name, categoryId, await fileToPngBlob(f)); await refresh(); toast('Logo salvato per ' + name.trim()); } catch { toast('Immagine non leggibile.'); } };
  if (!name.trim()) return null;
  return (<div className="row" style={{ margin: '6px 0 2px' }}>
    {url ? <img className="logo-sm" src={url} alt={'Logo ' + name} /> : <div className="logo-sm" />}
    <label className="b s sm" style={{ margin: 0, cursor: 'pointer' }}>{url ? 'Cambia logo' : '＋ Aggiungi logo'}<input type="file" accept="image/*" hidden data-testid={'logo-' + name} onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} /></label>
    {!url && <span className="mut">nessun logo</span>}</div>);
}

function MatchForm({ m: init, onClose }: { m: Match; onClose: () => void }) {
  const { categories, teams, refresh, toast } = useStore();
  const [m, setM] = useState<Match>(init);
  const [hasRes, setHasRes] = useState(!!init.result);
  const set = <K extends keyof Match>(k: K, v: Match[K]) => setM(x => ({ ...x, [k]: v }));
  const cat = categories.find(c => c.id === m.categoryId);
  const pickTeam = (side: 'home' | 'away', name: string) => { const t = teams.find(x => x.name.toLowerCase() === name.trim().toLowerCase()); setM(x => ({ ...x, [side === 'home' ? 'homeName' : 'awayName']: name, [side === 'home' ? 'homeTeamId' : 'awayTeamId']: t?.id })); };
  const save = async () => {
    if (!m.homeName.trim() || !m.awayName.trim()) { toast('Inserisci entrambe le squadre.'); return; }
    const known = await getAll('teams');
    const has = (n: string) => known.some(t => t.name.toLowerCase() === n.trim().toLowerCase());
    // le squadre nuove entrano nell'archivio così non vanno reinserite
    for (const name of [m.homeName, m.awayName, ...m.extraTeams]) {
      if (name.trim() && !has(name)) { await put('teams', { id: newId('team'), name: name.trim(), categoryId: m.categoryId }); known.push({ id: '', name }); }
    }
    const all = await getAll('teams'); const byName = (n: string) => all.find(t => t.name.toLowerCase() === n.trim().toLowerCase())?.id;
    const fin: Match = { ...m, homeTeamId: byName(m.homeName), awayTeamId: byName(m.awayName), extraTeams: m.extraTeams.map(s => s.trim()).filter(Boolean), result: hasRes ? (m.result ?? { home: 0, away: 0, scorers: '', assists: '', notes: '' }) : undefined };
    await put('matches', fin); await refresh(); toast('Partita salvata.'); onClose();
  };
  const r = m.result ?? { home: 0, away: 0, scorers: '', assists: '', notes: '' };
  return (<>
    <h1>{init.homeName && init.awayName ? 'Modifica partita' : 'Nuova partita'}</h1>
    <label>Categoria</label><select value={m.categoryId} onChange={e => set('categoryId', e.target.value)}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    {cat && <div className="mut">Template {cat.template === 'A' ? 'A – prima squadra (la partita è il titolo)' : 'B – il titolo è la categoria'}</div>}
    <label>Competizione</label><input value={m.competition} onChange={e => set('competition', e.target.value)} placeholder="Campionato, Coppa Italia…" />
    <label>Giornata</label><input value={m.round} onChange={e => set('round', e.target.value)} placeholder="es. 5" inputMode="numeric" />
    <label>Squadra di casa</label><input list="teamlist" value={m.homeName} onChange={e => pickTeam('home', e.target.value)} /><LogoPick name={m.homeName} categoryId={m.categoryId} />
    <label>Squadra ospite</label><input list="teamlist" value={m.awayName} onChange={e => pickTeam('away', e.target.value)} /><LogoPick name={m.awayName} categoryId={m.categoryId} />
    <datalist id="teamlist">{teams.map(t => <option key={t.id} value={t.name} />)}</datalist>
    {m.extraTeams.map((t, i) => <div key={i}><label>Squadra {i + 3}</label><div className="row"><input list="teamlist" value={t} onChange={e => set('extraTeams', m.extraTeams.map((x, j) => (j === i ? e.target.value : x)))} /><button className="b d sm" onClick={() => set('extraTeams', m.extraTeams.filter((_, j) => j !== i))}>✕</button></div></div>)}
    <button className="b s sm" style={{ marginTop: 8 }} onClick={() => set('extraTeams', [...m.extraTeams, ''])}>＋ Aggiungi squadra (triangolare / torneo)</button>
    <div className="row"><div className="grow"><label>Data</label><input type="date" value={m.date} onChange={e => set('date', e.target.value)} /></div><div className="grow"><label>Ora</label><input type="time" value={m.time} onChange={e => set('time', e.target.value)} /></div></div>
    <label>Luogo</label><input value={m.venue} onChange={e => set('venue', e.target.value)} />
    <label><input type="checkbox" checked={m.monticanoHome} onChange={e => set('monticanoHome', e.target.checked)} /> Il Monticano gioca in casa (prima squadra nominata)</label>
    <h2>Risultato</h2>
    <label><input type="checkbox" checked={hasRes} onChange={e => setHasRes(e.target.checked)} /> Partita giocata: inserisci il risultato</label>
    {hasRes && <>
      <div className="row"><div className="grow"><label>Gol {m.homeName || 'casa'}</label><input type="number" min={0} value={r.home} onChange={e => set('result', { ...r, home: Math.max(0, +e.target.value) })} /></div><div className="grow"><label>Gol {m.awayName || 'ospite'}</label><input type="number" min={0} value={r.away} onChange={e => set('result', { ...r, away: Math.max(0, +e.target.value) })} /></div></div>
      <label>Marcatori</label><input value={r.scorers} onChange={e => set('result', { ...r, scorers: e.target.value })} placeholder="Rossi 2, Bianchi" />
      <label>Assist</label><input value={r.assists} onChange={e => set('result', { ...r, assists: e.target.value })} />
      <label>Note sulla partita</label><input value={r.notes} onChange={e => set('result', { ...r, notes: e.target.value })} />
    </>}
    <div className="row" style={{ marginTop: 16 }}><button className="b grow" onClick={save}>Salva</button><button className="b s" onClick={onClose}>Annulla</button></div>
  </>);
}
