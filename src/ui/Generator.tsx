import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import type { Nav } from './App';
import { THEMES, randomTheme } from '../core/themes';
import { buildLayers, newProject } from '../core/layout';
import { buildBackgroundPrompt } from '../core/prompt';
import { buildDescription } from '../core/description';
import { generateBackground, AiError, lastModelUsed } from '../core/ai';
import { buildPosterPrompt, logoRefs } from '../core/poster';
import { outcomeFor } from '../core/outcome';
import { pushTheme, put } from '../core/db';
import type { ProjectKind } from '../core/types';

export function Generator({ nav }: { nav: Nav }) {
  const { matches, categories, teams, logos, settings, templates, recent, refresh, toast } = useStore();
  const [matchId, setMatchId] = useState(nav.matchId ?? '');
  const [kind, setKind] = useState<ProjectKind>('announce');
  const [theme, setTheme] = useState('');
  const [style, setStyle] = useState<'integrated' | 'layers'>('layers');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const abort = useRef<AbortController | null>(null);
  const active = matches.filter(m => !m.archived);
  const match = matches.find(m => m.id === matchId);
  const puter = settings.engine === 'puter';
  useEffect(() => { setStyle(puter ? 'integrated' : 'layers'); }, [puter]);
  useEffect(() => { if (match && !theme) setTheme(match.theme); }, [matchId]); // eslint-disable-line
  useEffect(() => { if (!match?.result && kind === 'result') setKind('announce'); }, [match, kind]);

  const go = async () => {
    if (!match) return; const t = theme.trim() || randomTheme(recent).name; setTheme(t);
    const cat = categories.find(c => c.id === match.categoryId); if (!cat) return;
    setBusy(true); setErr(''); abort.current = new AbortController();
    const seed = Math.floor(Math.random() * 1e6);
    const o = kind === 'result' ? outcomeFor(match) : null;
    const homeTeam = teams.find(x => x.id === match.homeTeamId), awayTeam = teams.find(x => x.id === match.awayTeamId);
    const integrated = style === 'integrated';
    const refs = integrated ? await logoRefs(homeTeam, awayTeam, logos) : null;
    const prompt = integrated ? buildPosterPrompt({ match, cat, kind, theme: t, outcome: o, seed, hasHomeLogo: !!refs?.hasHome, hasAwayLogo: !!refs?.hasAway })
      : buildBackgroundPrompt({ theme: t, template: kind === 'result' ? 'R' : cat.template, outcome: o, seed });
    const layers = buildLayers({ match, category: cat, kind, theme: t, homeTeam, awayTeam });
    const p = newProject({ ...match, theme: t }, kind, t, layers, seed, prompt);
    p.mode = integrated ? 'integrated' : 'layers';
    if (integrated) p.layers = p.layers.map(l => ({ ...l, visible: false })); // i livelli restano disponibili ma nascosti: l'AI ha già disegnato testi e stemmi
    p.description = buildDescription(match, cat, kind, templates ?? undefined);
    try {
      const bg = await generateBackground(settings, prompt, seed, abort.current.signal, integrated ? { refs: refs!.refs } : undefined);
      p.bgBlob = bg; p.versions.push({ id: 'v1', createdAt: Date.now(), seed, prompt, bg });
      if (settings.engine !== 'puter' && lastModelUsed === 'schnell' && (settings.cfModel ?? 'lucid') !== 'schnell') toast('Quota giornaliera di Lucid finita: ho usato la bozza veloce (qualità più semplice). Lucid torna all’1:00.');
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setBusy(false); return; }
      const ae = e as AiError;
      if (ae.code === 'not-configured' || ae.code === 'quota' || ae.code === 'network') {
        toast(`${ae.message} Uso lo sfondo di riserva (non generato dall'AI).`);
        if (integrated) { p.mode = 'layers'; p.layers = p.layers.map(l => ({ ...l, visible: true })); } // senza AI i testi vanno disegnati dall'app
      } else { setErr(ae.message); setBusy(false); return; }
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
      <label>Stile</label>
      <select value={style} onChange={e => setStyle(e.target.value as 'integrated' | 'layers')}><option value="layers">{puter ? 'Scena AI + testi e loghi esatti (precisa)' : 'Consigliata – scena AI + testi e loghi esatti'}</option><option value="integrated">{puter ? "Integrata – l'AI disegna tutto, come ChatGPT (consigliata)" : "Sperimentale – l'AI disegna anche testi e stemmi"}</option></select>
      <p className="mut">{style === 'integrated' ? "L'AI scrive titolo e barra info dentro l'immagine, molto fusi col tema, ma nei test sbaglia spesso le lettere e ridisegna gli stemmi in modo diverso. Controlla bene prima di pubblicare e rigenera finché è giusto." : 'La scena nel tema è generata dall’AI; nomi, date e loghi sono livelli esatti e modificabili, senza errori di scrittura.'}</p>
      <label>Tema (film o videogioco)</label>
      <input list="themes" value={theme} onChange={e => setTheme(e.target.value)} placeholder="Scrivi un titolo o scegline uno" />
      <datalist id="themes">{[...recent, ...THEMES.map(t => t.name)].map(t => <option key={t} value={t} />)}</datalist>
      <div className="row wrap" style={{ marginTop: 8 }}><button className="b s sm" onClick={() => setTheme(randomTheme([]).name)}>🎲 Tema casuale</button></div>
      {recent.length > 0 && <><label>Usati di recente</label><div>{recent.slice(0, 12).map(t => <button key={t} className="pill" style={{ color: 'inherit' }} onClick={() => setTheme(t)}>{t}</button>)}</div></>}
      <div className="row" style={{ marginTop: 16 }}><button className="b grow" disabled={busy} onClick={go}>{busy ? <><span className="spin" /> Generazione in corso…</> : '✨ Genera'}</button>{busy && <button className="b s" onClick={() => abort.current?.abort()}>Stop</button>}</div>
      {err && <p className="err">{err}</p>}
      {!settings.workerUrl && !puter && <p className="mut">Servizio AI non configurato: la grafica userà uno sfondo di riserva. Configuralo in Impostazioni.</p>}
    </>}
  </>);
}
