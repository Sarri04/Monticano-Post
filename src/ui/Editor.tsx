import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './store';
import type { Nav } from './App';
import type { Layer, LogoLayer, Project, TextLayer } from '../core/types';
import { H, W } from '../core/types';
import { FONT_LIST, drawProject, exportPng, hitTest, loadFonts, type LogoImages } from '../core/render';
import { parseChat } from '../core/chat';
import { buildBackgroundPrompt } from '../core/prompt';
import { buildDescription } from '../core/description';
import { generateBackground, AiError } from '../core/ai';
import { buildPosterPrompt, logoRefs } from '../core/poster';
import { outcomeFor } from '../core/outcome';
import { newId } from '../core/layout';
import { put, del } from '../core/db';

type Tab = 'layers' | 'chat' | 'desc' | 'versions';

export function Editor({ nav }: { nav: Nav }) {
  const { projects, matches, categories, teams, logos, settings, templates, refresh, toast } = useStore();
  const stored = projects.find(p => p.id === nav.projectId);
  const [proj, setProj] = useState<Project | null>(stored ?? null);
  const [layers, setLayers] = useState<Layer[]>(stored?.layers ?? []);
  const [undo, setUndo] = useState<Layer[][]>([]); const [redo, setRedo] = useState<Layer[][]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('layers');
  const [bg, setBg] = useState<ImageBitmap | null>(null); const [logoImgs, setLogoImgs] = useState<LogoImages>(new Map());
  const [busy, setBusy] = useState(''); const [chat, setChat] = useState<{ me: boolean; t: string }[]>([]); const [input, setInput] = useState('');
  const [shareImg, setShareImg] = useState<string | null>(null); const [dirty, setDirty] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ id: string; dx: number; dy: number; before: Layer[]; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; size: number; id: string; before: Layer[] } | null>(null);
  const match = matches.find(m => m.id === proj?.matchId); const cat = categories.find(c => c.id === match?.categoryId);

  useEffect(() => { if (stored && !proj) { setProj(stored); setLayers(stored.layers); } }, [stored, proj]);
  useEffect(() => { let off = false; (async () => { const b = proj?.bgBlob ? await createImageBitmap(proj.bgBlob) : null; if (!off) setBg(b); })(); return () => { off = true; }; }, [proj?.bgBlob]);
  useEffect(() => { let off = false; (async () => { const m: LogoImages = new Map(); for (const l of logos) m.set(l.id, await createImageBitmap(l.blob)); if (!off) setLogoImgs(m); })(); return () => { off = true; }; }, [logos]);
  const redraw = useCallback(async () => { if (!canvas.current || !proj) return; await loadFonts(layers); drawProject(canvas.current.getContext('2d')!, { layers, theme: proj.theme, mode: proj.mode }, bg, logoImgs, { selectedId: sel }); }, [layers, bg, logoImgs, sel, proj]);
  useEffect(() => { void redraw(); }, [redraw]);

  const commit = (next: Layer[], before = layers) => { setUndo(u => [...u.slice(-49), before]); setRedo([]); setLayers(next); setDirty(true); };
  const patch = (id: string, p: Partial<TextLayer> | Partial<LogoLayer>) => commit(layers.map(l => (l.id === id ? ({ ...l, ...p } as Layer) : l)));
  const selected = layers.find(l => l.id === sel) ?? null;

  const pt = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
  const onDown = (e: React.PointerEvent) => {
    canvas.current!.setPointerCapture(e.pointerId); const p = pt(e); pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2 && sel) { const [a, b] = [...pointers.current.values()]; const l = layers.find(x => x.id === sel); if (l) { pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), size: l.kind === 'text' ? l.size : l.size, id: sel, before: layers }; drag.current = null; } return; }
    const hit = hitTest(canvas.current!.getContext('2d')!, layers, logoImgs, p.x, p.y);
    setSel(hit?.id ?? null); drag.current = hit ? { id: hit.id, dx: hit.x - p.x, dy: hit.y - p.y, before: layers, moved: false } : null;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return; const p = pt(e); pointers.current.set(e.pointerId, p);
    const pc = pinch.current;
    if (pc && pointers.current.size >= 2) { const [a, b] = [...pointers.current.values()]; const k = Math.hypot(a.x - b.x, a.y - b.y) / pc.d; setLayers(ls => ls.map(l => (l.id === pc.id ? ({ ...l, size: Math.max(16, Math.round(pc.size * k)) } as Layer) : l))); return; }
    const d = drag.current; if (!d) return; d.moved = true; setLayers(ls => ls.map(l => (l.id === d.id ? { ...l, x: Math.round(p.x + d.dx), y: Math.round(p.y + d.dy) } : l)));
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const pc = pinch.current, dr = drag.current; // copie locali: gli updater di React girano dopo l'azzeramento dei ref
    if (pc && pointers.current.size < 2) { setUndo(u => [...u.slice(-49), pc.before]); setRedo([]); setDirty(true); pinch.current = null; }
    if (dr?.moved) { setUndo(u => [...u.slice(-49), dr.before]); setRedo([]); setDirty(true); }
    if (pointers.current.size === 0) drag.current = null;
  };

  const doUndo = () => { const p = undo[undo.length - 1]; if (!p) return; setRedo(r => [...r, layers]); setUndo(u => u.slice(0, -1)); setLayers(p); setDirty(true); };
  const doRedo = () => { const n = redo[redo.length - 1]; if (!n) return; setUndo(u => [...u, layers]); setRedo(r => r.slice(0, -1)); setLayers(n); setDirty(true); };

  const save = async (extra: Partial<Project> = {}) => { if (!proj) return; const np = { ...proj, ...extra, layers, updatedAt: Date.now() }; await put('projects', np); setProj(np); setDirty(false); await refresh(); return np; };

  const regenerate = async (extra: string, newSeed = true) => {
    if (!proj || !match || !cat) return; setBusy('Genero un nuovo sfondo…');
    const seed = newSeed ? Math.floor(Math.random() * 1e6) : proj.seed;
    const integrated = proj.mode === 'integrated';
    const refs = integrated ? await logoRefs(teams.find(x => x.id === match.homeTeamId), teams.find(x => x.id === match.awayTeamId), logos) : null;
    const o = proj.kind === 'result' ? outcomeFor(match) : null;
    const prompt = integrated ? buildPosterPrompt({ match, cat, kind: proj.kind, theme: proj.theme, outcome: o, seed, hasHomeLogo: !!refs?.hasHome, hasAwayLogo: !!refs?.hasAway, extra })
      : buildBackgroundPrompt({ theme: proj.theme, template: proj.kind === 'result' ? 'R' : cat.template, outcome: o, seed, extra });
    try {
      const b = await generateBackground(settings, prompt, seed, undefined, integrated ? { refs: refs!.refs } : undefined);
      const np = await save({ bgBlob: b, seed, prompt, versions: [...proj.versions, { id: newId('v'), createdAt: Date.now(), seed, prompt, bg: b }] }); if (np) setChat(c => [...c, { me: false, t: 'Fatto: nuovo sfondo generato. Testi e loghi non sono stati toccati.' }]);
    } catch (e) { const m = (e as AiError).message; setChat(c => [...c, { me: false, t: m }]); toast(m); } finally { setBusy(''); }
  };

  const send = async () => {
    const q = input.trim(); if (!q) return; setInput(''); setChat(c => [...c, { me: true, t: q }]);
    const a = parseChat(q);
    if (a.type === 'edit') { commit(a.apply(layers)); setChat(c => [...c, { me: false, t: a.summary + " (modifica diretta nell'editor, nessuna rigenerazione)" }]); }
    else if (a.type === 'regenerate') { setChat(c => [...c, { me: false, t: a.summary }]); await regenerate(a.extra, a.newScene || !a.keepScene); }
    else setChat(c => [...c, { me: false, t: a.summary }]);
  };

  const makePng = async () => { const logoBlobs = new Map(logos.map(l => [l.id, l.blob] as const)); return exportPng({ layers, theme: proj!.theme, mode: proj!.mode }, proj!.bgBlob ?? null, logoBlobs); };
  const share = async () => {
    setBusy("Preparo l'immagine…"); try {
      const png = await makePng(); await save(); const file = new File([png], 'monticano-1080x1350.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text: proj?.description || undefined }); } catch (e) { if ((e as Error).name !== 'AbortError') setShareImg(URL.createObjectURL(png)); } }
      else setShareImg(URL.createObjectURL(png));
    } catch (e) { toast((e as Error).message); } finally { setBusy(''); }
  };
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast('Descrizione copiata.'); } catch { toast('Copia non riuscita: tieni premuto sul testo e scegli Copia.'); } };

  const addText = () => { const l: TextLayer = { id: newId('t'), kind: 'text', name: 'Testo', role: 'custom', text: 'Nuovo testo', x: W / 2, y: H / 2, rotation: 0, visible: true, font: 'Anton', size: 80, weight: 400, color: '#ffffff', stroke: '#000000', strokeWidth: 5, glow: '#ffffff', glowBlur: 10, shadow: true, letterSpacing: 2, lineHeight: 1.05, maxWidth: 940, align: 'center', upper: true }; commit([...layers, l]); setSel(l.id); };
  const addLogo = (logoId: string) => { const l: LogoLayer = { id: newId('l'), kind: 'logo', name: 'Logo', role: 'logo-custom', logoId, x: W / 2, y: H / 2, size: 280, rotation: 0, visible: true, glow: '#ffffff', glowBlur: 20, shadow: true }; commit([...layers, l]); setSel(l.id); };
  const move = (id: string, d: -1 | 1) => { const i = layers.findIndex(l => l.id === id); const j = i + d; if (j < 0 || j >= layers.length) return; const n = [...layers];[n[i], n[j]] = [n[j], n[i]]; commit(n); };
  const url = useMemo(() => (b?: Blob) => (b ? URL.createObjectURL(b) : ''), []);

  if (!proj) return <p>Progetto non trovato. <button className="b s sm" onClick={() => nav.go('home')}>Home</button></p>;
  return (<>
    <div className="row"><button className="b s sm" onClick={async () => { if (dirty && confirm('Salvare le modifiche?')) await save(); nav.go('matches', {}); }}>‹ Indietro</button><b className="grow" style={{ textAlign: 'center' }}>{proj.kind === 'result' ? 'Risultato' : 'Partita'} · {proj.theme}</b><button className="b sm" onClick={async () => { await save(); toast('Progetto salvato.'); }}>{dirty ? 'Salva •' : 'Salva'}</button></div>
    <div className="stage" style={{ marginTop: 10 }}><canvas ref={canvas} width={W} height={H} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} /></div>
    {!proj.bgBlob && <p className="mut">Sfondo di riserva (non generato dall'AI). Usa la scheda Chat o Versioni per generare lo sfondo quando il servizio è configurato.</p>}
    <div className="row" style={{ marginTop: 10 }}><button className="b s sm" disabled={!undo.length} onClick={doUndo}>↶ Annulla</button><button className="b s sm" disabled={!redo.length} onClick={doRedo}>↷ Ripristina</button><div className="grow" /><button className="b" onClick={share} disabled={!!busy}>Condividi / Salva</button></div>
    {busy && <p className="mut"><span className="spin" /> {busy}</p>}
    <div className="tabs">{([['layers', 'Livelli'], ['chat', 'Chat'], ['desc', 'Descrizione'], ['versions', 'Versioni']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

    {tab === 'layers' && <>
      <div className="row wrap"><button className="b s sm" onClick={addText}>＋ Testo</button>{logos.length > 0 && <select style={{ width: 'auto' }} value="" onChange={e => e.target.value && addLogo(e.target.value)}><option value="">＋ Logo…</option>{logos.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}</div>
      {[...layers].reverse().map(l => <div key={l.id} className={`layer ${sel === l.id ? 'on' : ''}`} onClick={() => setSel(l.id)}>
        <span>{l.kind === 'logo' ? '🛡' : 'T'}</span><span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.kind === 'text' ? l.text.replace(/\n/g, ' ') : l.name}</span>
        <button className="b s sm" onClick={e => { e.stopPropagation(); move(l.id, 1); }}>↑</button><button className="b s sm" onClick={e => { e.stopPropagation(); move(l.id, -1); }}>↓</button>
        <button className="b s sm" onClick={e => { e.stopPropagation(); patch(l.id, { visible: !l.visible }); }}>{l.visible ? '👁' : '—'}</button></div>)}
      {selected && <div className="card" style={{ marginTop: 10 }}>
        {selected.kind === 'text' ? <TextInspector l={selected} patch={p => patch(selected.id, p)} /> : <LogoInspector l={selected} logos={logos} patch={p => patch(selected.id, p)} />}
        <label>Rotazione: {selected.rotation}°</label><input type="range" min={-45} max={45} value={selected.rotation} onChange={e => patch(selected.id, { rotation: +e.target.value })} />
        <button className="b d sm" style={{ marginTop: 10 }} onClick={() => { commit(layers.filter(l => l.id !== selected.id)); setSel(null); }}>Elimina livello</button></div>}
      {!selected && <p className="mut">Tocca un elemento sulla grafica per selezionarlo, trascinalo per spostarlo, usa due dita per ridimensionarlo.</p>}
    </>}

    {tab === 'chat' && <>
      <div>{chat.map((m, i) => <div key={i} className="card" style={{ marginLeft: m.me ? 32 : 0, marginRight: m.me ? 0 : 32, background: m.me ? 'var(--bg2)' : 'var(--card)' }}>{m.t}</div>)}</div>
      <div className="row"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="es. metti il titolo più in alto" /><button className="b" onClick={send} disabled={!!busy}>Invia</button></div>
      <p className="mut">Posizione, dimensione, font e colori si cambiano subito nell'editor. Ambientazione, sfondo e atmosfera rigenerano solo lo sfondo.</p>
    </>}

    {tab === 'desc' && <>
      <textarea style={{ minHeight: 240 }} value={proj.description} onChange={e => { setProj({ ...proj, description: e.target.value }); setDirty(true); }} />
      <div className="row" style={{ marginTop: 8 }}><button className="b grow" onClick={() => copy(proj.description)}>Copia descrizione</button><button className="b s" onClick={() => { if (match && cat && confirm('Rigenerare la descrizione dai modelli? Le tue modifiche andranno perse.')) { setProj({ ...proj, description: buildDescription(match, cat, proj.kind, templates ?? undefined) }); setDirty(true); } }}>Rigenera</button></div>
    </>}

    {tab === 'versions' && <>
      <div className="row"><button className="b grow" disabled={!!busy} onClick={() => regenerate('')}>✨ Nuovo sfondo</button></div>
      <div className="row wrap" style={{ marginTop: 10 }}>{proj.versions.map(v => <img key={v.id} className={`thumb ${proj.bgBlob === v.bg ? 'on' : ''}`} src={url(v.bg)} onClick={async () => { await save({ bgBlob: v.bg, seed: v.seed, prompt: v.prompt }); }} />)}</div>
      {proj.versions.length === 0 && <p className="mut">Nessuna versione generata dall'AI.</p>}
      <button className="b d sm" style={{ marginTop: 14 }} onClick={async () => { if (confirm('Eliminare questo progetto?')) { await del('projects', proj.id); await refresh(); nav.go('matches', {}); } }}>Elimina progetto</button>
    </>}

    {shareImg && <div className="overlay"><img src={shareImg} /><div className="mut" style={{ color: '#fff' }}>Tieni premuta l'immagine e scegli “Salva in Foto”.</div><button className="b" onClick={() => setShareImg(null)}>Chiudi</button></div>}
  </>);
}

function TextInspector({ l, patch }: { l: TextLayer; patch: (p: Partial<TextLayer>) => void }) {
  return (<>
    <label>Testo</label><textarea style={{ minHeight: 70 }} value={l.text} onChange={e => patch({ text: e.target.value })} />
    <label>Font</label><select value={l.font} onChange={e => patch({ font: e.target.value, weight: e.target.value === 'Oswald' || e.target.value === 'Cinzel' ? 700 : e.target.value === 'Orbitron' ? 800 : 400 })}>{FONT_LIST.map(f => <option key={f}>{f}</option>)}</select>
    <label>Dimensione: {l.size}</label><input type="range" min={16} max={460} value={l.size} onChange={e => patch({ size: +e.target.value })} />
    <div className="row"><div className="grow"><label>Colore</label><input type="color" value={l.color} onChange={e => patch({ color: e.target.value })} /></div><div className="grow"><label>Sfumatura</label><input type="color" value={l.color2 ?? l.color} onChange={e => patch({ color2: e.target.value })} /></div><div className="grow"><label>Contorno</label><input type="color" value={l.stroke} onChange={e => patch({ stroke: e.target.value })} /></div><div className="grow"><label>Bagliore</label><input type="color" value={l.glow} onChange={e => patch({ glow: e.target.value })} /></div></div>
    <label>Spessore contorno: {l.strokeWidth}</label><input type="range" min={0} max={24} value={l.strokeWidth} onChange={e => patch({ strokeWidth: +e.target.value })} />
    <label>Bagliore: {l.glowBlur}</label><input type="range" min={0} max={90} value={l.glowBlur} onChange={e => patch({ glowBlur: +e.target.value })} />
    <label>Spaziatura lettere: {l.letterSpacing}</label><input type="range" min={0} max={30} value={l.letterSpacing} onChange={e => patch({ letterSpacing: +e.target.value })} />
    <div className="row wrap"><label><input type="checkbox" checked={l.shadow} onChange={e => patch({ shadow: e.target.checked })} /> Ombra</label><label><input type="checkbox" checked={l.upper} onChange={e => patch({ upper: e.target.checked })} /> Maiuscolo</label><label><input type="checkbox" checked={!!l.color2} onChange={e => patch({ color2: e.target.checked ? l.stroke : undefined })} /> Sfumatura</label></div>
    <label>Effetto 3D: {l.depth ?? 0}</label><input type="range" min={0} max={40} value={l.depth ?? 0} onChange={e => patch({ depth: +e.target.value, depthColor: l.depthColor ?? l.stroke })} />
    {!!l.depth && <><label>Colore 3D</label><input type="color" value={l.depthColor ?? l.stroke} onChange={e => patch({ depthColor: e.target.value })} /></>}
    <label><input type="checkbox" checked={!!l.plate} onChange={e => patch({ plate: e.target.checked ? { fill: '#10203f', border: l.color, borderWidth: 5, opacity: 0.86, padX: 28, padY: 8, radius: 22 } : undefined })} /> Targa dietro il testo</label>
    {l.plate && <div className="row"><div className="grow"><label>Targa</label><input type="color" value={l.plate.fill} onChange={e => patch({ plate: { ...l.plate!, fill: e.target.value } })} /></div><div className="grow"><label>Bordo</label><input type="color" value={l.plate.border} onChange={e => patch({ plate: { ...l.plate!, border: e.target.value } })} /></div><div className="grow"><label>Trasp.</label><input type="range" min={30} max={100} value={Math.round(l.plate.opacity * 100)} onChange={e => patch({ plate: { ...l.plate!, opacity: +e.target.value / 100 } })} /></div></div>}
  </>);
}
function LogoInspector({ l, logos, patch }: { l: LogoLayer; logos: { id: string; name: string }[]; patch: (p: Partial<LogoLayer>) => void }) {
  return (<>
    <label>Logo</label><select value={l.logoId} onChange={e => patch({ logoId: e.target.value })}>{logos.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
    <label>Dimensione: {l.size}</label><input type="range" min={60} max={700} value={l.size} onChange={e => patch({ size: +e.target.value })} />
    <label>Bagliore: {l.glowBlur}</label><input type="range" min={0} max={90} value={l.glowBlur} onChange={e => patch({ glowBlur: +e.target.value })} />
    <label>Colore bagliore</label><input type="color" value={l.glow} onChange={e => patch({ glow: e.target.value })} />
    <label><input type="checkbox" checked={l.shadow} onChange={e => patch({ shadow: e.target.checked })} /> Ombra</label>
    <label><input type="checkbox" checked={!!l.frame} onChange={e => patch({ frame: e.target.checked ? { shape: 'rounded', fill: '#10203f', border: '#ffffff', borderWidth: 8, opacity: 0.9, pad: Math.round(l.size * 0.08) } : undefined })} /> Cornice dietro al logo</label>
    {l.frame && <><div className="row"><div className="grow"><label>Forma</label><select value={l.frame.shape} onChange={e => patch({ frame: { ...l.frame!, shape: e.target.value as 'circle' | 'rounded' | 'shield' } })}><option value="circle">Tonda</option><option value="rounded">Arrotondata</option><option value="shield">Scudo</option></select></div><div className="grow"><label>Fondo</label><input type="color" value={l.frame.fill} onChange={e => patch({ frame: { ...l.frame!, fill: e.target.value } })} /></div><div className="grow"><label>Bordo</label><input type="color" value={l.frame.border} onChange={e => patch({ frame: { ...l.frame!, border: e.target.value } })} /></div></div>
      <label>Trasparenza cornice: {Math.round(l.frame.opacity * 100)}%</label><input type="range" min={0} max={100} value={Math.round(l.frame.opacity * 100)} onChange={e => patch({ frame: { ...l.frame!, opacity: +e.target.value / 100 } })} /></>}
    <p className="mut">Il logo mantiene sempre le proporzioni originali.</p>
  </>);
}
