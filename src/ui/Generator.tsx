import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import type { Nav } from './App';
import { THEMES, randomTheme } from '../core/themes';
import { buildLayers, newProject } from '../core/layout';
import { buildBackgroundPrompt } from '../core/prompt';
import { buildDescription } from '../core/description';
import { generateBackground, AiError } from '../core/ai';
import { outcomeFor } from '../core/outcome';
import { pushTheme, put } from '../core/db';
import type { ProjectKind } from '../core/types';

export function Generator({ nav }: { nav: Nav }) {
  const { matches, categories, teams, settings, templates, recent, refresh, toast } = useStore();
  const [matchId, setMatchId] = useState(nav.matchId ?? '');
  const [kind, setKind] = useState<ProjectKind>('announce');
  const [theme, setTheme] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const abort = useRef<AbortController | null>(null);
  const active = matches.filter(m => !m.archived);
  const match = matches.find(m => m.id === matchId);
  useEffect(() => { if (match && !theme) setTheme(match.theme); }, [matchId]); // eslint-disable-line
  useEffect(() => { if (!match?.result && kind === 'result') setKind('announce'); }, [match, kind]);

  const go = async () => {
    if (!match) return; const t = theme.trim() || randomTheme(recent).name; setTheme(t);
    const cat = categories.find(c => c.id === match.categoryId); if (!cat) return;
    setBusy(true); setErr(''); abort.current = new AbortController();
    const seed = Math.floor(Math.random() * 1e6);
    const o = kind === 'result' ? outcomeFor(match) : null;
    const prompt = buildBackgroundPrompt({ theme: t, template: kind === 'result' ? 'R' : cat.template, outcome: o, seed });
    const layers = buildLayers({ match, category: cat, kind, theme: t, homeTeam: teams.find(x => x.id === match.homeTeamId), awayTeam: teams.find(x => x.id === match.awayTeamId) });
    const p = newProject({ ...match, theme: t }, kind, t, layers, seed, prompt);
    p.description = buildDescription(match, cat, kind, templates ?? undefined);
    try {
      const bg = await generateBackground(settings, prompt, seed, abort.current.signal);
      p.bgBlob = bg; p.versions.push({ id: 'v1', createdAt: Date.now(), seed, prompt, bg });
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setBusy(false); return; }
      const ae = e as AiError;
      if (ae.code === 'not-configured' || ae.code === 'quota' || ae.code === 'network') toast(`${ae.message} Uso lo sfondo di riserva (non generato dall'AI).`);
      else { setErr(ae.message); setBusy(false); return; }
    }
    await put('matches', { ...match, theme: t }); await pushTheme(t); await put('projects', p); await refresh(); setBusy(false);
    nav.go('gen', { projectId: p.id });
  };

  return (<>
    <h1>Genera grafica</h1>
    <label>Partita</label>
    <select value={matchId} onChange={e => setMatchId(e.target.value)}><option value="">Scegli una partita…</option>{active.map(m => <option key={m.id} value={m.id}>{m.homeName} – {m.awayName} ({categories.find(c => c.id === m.categoryId)?.name})</option>)}</select>
    <button className="b s sm" style={{ marginTop: 8 }} onClick={() => nav.go('matches', {})}>＋ Nuova partita</button>
    {match && <>
      <label>Tipo di grafica</label>
      <select value={kind} onChange={e => setKind(e.target.value as ProjectKind)}><option value="announce">Annuncio partita</option><option value="result" disabled={!match.result}>Risultato finale{!match.result ? ' (inserisci prima il risultato)' : ''}</option></select>
      <label>Tema (film o videogioco)</label>
      <input list="themes" value={theme} onChange={e => setTheme(e.target.value)} placeholder="Scrivi un titolo o scegline uno" />
      <datalist id="themes">{[...recent, ...THEMES.map(t => t.name)].map(t => <option key={t} value={t} />)}</datalist>
      <div className="row wrap" style={{ marginTop: 8 }}><button className="b s sm" onClick={() => setTheme(randomTheme([]).name)}>🎲 Tema casuale</button></div>
      {recent.length > 0 && <><label>Usati di recente</label><div>{recent.slice(0, 12).map(t => <button key={t} className="pill" style={{ color: 'inherit' }} onClick={() => setTheme(t)}>{t}</button>)}</div></>}
      <div className="row" style={{ marginTop: 16 }}><button className="b grow" disabled={busy} onClick={go}>{busy ? <><span className="spin" /> Generazione in corso…</> : '✨ Genera'}</button>{busy && <button className="b s" onClick={() => abort.current?.abort()}>Stop</button>}</div>
      {err && <p className="err">{err}</p>}
      {!settings.workerUrl && <p className="mut">Servizio AI non configurato: la grafica userà uno sfondo di riserva. Configuralo in Impostazioni.</p>}
    </>}
  </>);
}
