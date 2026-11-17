import { useRef, useState } from 'react';
import { useStore } from './store';
import { del, put } from '../core/db';
import { newId } from '../core/layout';
import { removeUniformBackground } from '../core/logoCutout';
import type { Category, Team } from '../core/types';
import { THEMES } from '../core/themes';

async function blobToCanvas(file: Blob) { const bm = await createImageBitmap(file); const max = 800; const k = Math.min(1, max / Math.max(bm.width, bm.height)); const c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext('2d')!.drawImage(bm, 0, 0, c.width, c.height); return c; }
const canvasBlob = (c: HTMLCanvasElement) => new Promise<Blob>((r, j) => c.toBlob(b => (b ? r(b) : j(new Error('png'))), 'image/png'));

export function Archive() {
  const { teams, categories, logos, recent, refresh, toast } = useStore();
  const [sec, setSec] = useState<'teams' | 'cats' | 'logos' | 'themes'>('teams');
  const [team, setTeam] = useState<Team | null>(null);
  const [pending, setPending] = useState<{ name: string; canvas: HTMLCanvasElement; cut?: HTMLCanvasElement } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const logoUrl = (id?: string) => { const l = logos.find(x => x.id === id); return l ? URL.createObjectURL(l.blob) : ''; };

  const pick = async (f: File) => { try { window.scrollTo({ top: 0, behavior: 'smooth' }); setPending({ name: f.name.replace(/\.[^.]+$/, ''), canvas: await blobToCanvas(f) }); } catch { toast('Immagine non leggibile.'); } };
  const cut = () => { if (!pending) return; const c = document.createElement('canvas'); c.width = pending.canvas.width; c.height = pending.canvas.height; const x = c.getContext('2d')!; x.drawImage(pending.canvas, 0, 0); const d = x.getImageData(0, 0, c.width, c.height); const n = removeUniformBackground(d.data, c.width, c.height); if (!n) { toast('Nessuno sfondo uniforme riconosciuto: il logo resta originale.'); return; } x.putImageData(d, 0, 0); setPending({ ...pending, cut: c }); };
  const saveLogo = async (useCut: boolean) => { if (!pending) return; const id = newId('logo'); await put('logos', { id, name: pending.name, blob: await canvasBlob(useCut && pending.cut ? pending.cut : pending.canvas) }); if (team) setTeam({ ...team, logoId: id }); setPending(null); await refresh(); toast('Logo salvato.'); };
  const saveTeam = async () => { if (!team || !team.name.trim()) return; await put('teams', { ...team, name: team.name.trim() }); setTeam(null); await refresh(); };

  return (<>
    <h1>Archivio</h1>
    <div className="tabs">{([['teams', 'Squadre'], ['cats', 'Categorie'], ['logos', 'Loghi'], ['themes', 'Temi']] as const).map(([k, l]) => <button key={k} className={sec === k ? 'on' : ''} onClick={() => setSec(k)}>{l}</button>)}</div>
    <input ref={file} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ''; }} />
    {pending && <div className="card"><b>Nuovo logo: {pending.name}</b><div className="row" style={{ margin: '10px 0' }}>
      <canvas ref={r => { if (r) { r.width = pending.canvas.width; r.height = pending.canvas.height; r.getContext('2d')!.drawImage(pending.canvas, 0, 0); } }} style={{ width: 110, background: '#888', borderRadius: 8 }} />
      {pending.cut && <canvas ref={r => { if (r && pending.cut) { r.width = pending.cut.width; r.height = pending.cut.height; r.getContext('2d')!.drawImage(pending.cut, 0, 0); } }} style={{ width: 110, background: 'repeating-conic-gradient(#999 0 25%,#ddd 0 50%) 0 0/16px 16px', borderRadius: 8 }} />}</div>
      <div className="row wrap"><button className="b sm" onClick={() => saveLogo(false)}>Usa originale</button><button className="b s sm" onClick={cut}>Rimuovi sfondo uniforme</button>{pending.cut && <button className="b sm" onClick={() => saveLogo(true)}>Usa versione ritagliata</button>}<button className="b d sm" onClick={() => setPending(null)}>Annulla</button></div>
      <p className="mut">Il ritaglio toglie solo lo sfondo di un colore uniforme collegato ai bordi e non modifica il disegno.</p></div>}

    {sec === 'teams' && (team ? <div className="card">
      <label>Nome</label><input value={team.name} onChange={e => setTeam({ ...team, name: e.target.value })} />
      <label>Nome abbreviato</label><input value={team.short ?? ''} onChange={e => setTeam({ ...team, short: e.target.value })} />
      <label>Categoria</label><select value={team.categoryId ?? ''} onChange={e => setTeam({ ...team, categoryId: e.target.value || undefined })}><option value="">—</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <label>Note</label><input value={team.notes ?? ''} onChange={e => setTeam({ ...team, notes: e.target.value })} />
      <label>Logo</label><div className="row">{team.logoId ? <img className="logo-sm" src={logoUrl(team.logoId)} /> : <span className="mut">nessuno</span>}<button className="b s sm" onClick={() => file.current?.click()}>Carica logo</button>
        {logos.length > 0 && <select value={team.logoId ?? ''} onChange={e => setTeam({ ...team, logoId: e.target.value || undefined })}><option value="">—</option>{logos.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}</div>
      <div className="row" style={{ marginTop: 12 }}><button className="b grow" onClick={saveTeam}>Salva squadra</button><button className="b s" onClick={() => setTeam(null)}>Chiudi</button></div></div> : <>
      <button className="b" onClick={() => setTeam({ id: newId('team'), name: '' })}>＋ Nuova squadra</button>
      {teams.map(t => <div className="card row" key={t.id}>{t.logoId ? <img className="logo-sm" src={logoUrl(t.logoId)} /> : <div className="logo-sm" />}<div className="grow"><b>{t.name}</b><div className="mut">{categories.find(c => c.id === t.categoryId)?.name ?? ''}{t.isMonticano ? ' · nostra squadra' : ''}</div></div>
        <button className="b s sm" onClick={() => setTeam(t)}>Modifica</button>{!t.isMonticano && <button className="b d sm" onClick={async () => { if (confirm(`Eliminare ${t.name}?`)) { await del('teams', t.id); await refresh(); } }}>✕</button>}</div>)}</>)}

    {sec === 'cats' && <>
      <button className="b" onClick={async () => { const n = prompt('Nome della categoria'); if (n) { await put('categories', { id: newId('cat'), name: n, template: 'B', useLogos: false }); await refresh(); } }}>＋ Nuova categoria</button>
      {categories.map((c: Category) => <div className="card" key={c.id}><div className="row"><b className="grow">{c.name}</b><button className="b d sm" onClick={async () => { if (confirm(`Eliminare ${c.name}?`)) { await del('categories', c.id); await refresh(); } }}>✕</button></div>
        <label>Template</label><select value={c.template} onChange={async e => { await put('categories', { ...c, template: e.target.value as 'A' | 'B', useLogos: e.target.value === 'A' ? true : c.useLogos }); await refresh(); }}><option value="A">A – partita come titolo (prima squadra)</option><option value="B">B – categoria come titolo</option></select>
        <label><input type="checkbox" checked={c.useLogos} onChange={async e => { await put('categories', { ...c, useLogos: e.target.checked }); await refresh(); }} /> Usa i loghi delle squadre</label></div>)}</>}

    {sec === 'logos' && <><button className="b" onClick={() => file.current?.click()}>＋ Carica logo</button>{logos.map(l => <div className="card row" key={l.id}><img className="logo-sm" src={logoUrl(l.id)} /><b className="grow">{l.name}</b><button className="b d sm" onClick={async () => { if (confirm('Eliminare il logo?')) { await del('logos', l.id); await refresh(); } }}>✕</button></div>)}{logos.length === 0 && <p className="mut">Nessun logo caricato.</p>}</>}

    {sec === 'themes' && <><h2>Usati di recente</h2>{recent.length ? recent.map(t => <span className="pill" key={t}>{t}</span>) : <p className="mut">Nessuno ancora.</p>}<h2>Catalogo</h2>{THEMES.map(t => <span className="pill" key={t.name}>{t.name}</span>)}<p className="mut">Puoi usare qualsiasi film o videogioco scrivendo il titolo nel generatore.</p></>}
  </>);
}
