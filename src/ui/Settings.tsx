import { useRef, useState } from 'react';
import { useStore } from './store';
import { exportBackup, importBackup, saveSettings, saveTemplates } from '../core/db';
import { DEFAULT_TEMPLATES, type DescTemplates } from '../core/description';
import { puterSignIn, puterSignedIn, puterUsage } from '../core/puter';

export function SettingsScreen() {
  const { settings, templates, refresh, toast } = useStore();
  const [s, setS] = useState(settings); const [t, setT] = useState<DescTemplates>(templates ?? DEFAULT_TEMPLATES);
  const [test, setTest] = useState(''); const f = useRef<HTMLInputElement>(null);
  const backup = async () => { const b = await exportBackup(); const file = new File([b], `monticano-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' }); try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if ((e as Error).name === 'AbortError') return; } const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = file.name; a.click(); };
  const check = async () => { setTest('Verifico…'); try { const r = await fetch(s.workerUrl.replace(/\/$/, '') + '/health'); const j = await r.json(); setTest(r.ok && j.ok ? `Worker raggiungibile (${j.model}).` : `Risposta inattesa (${r.status}).`); } catch { setTest('Worker non raggiungibile: controlla indirizzo e CORS (ALLOWED_ORIGIN).'); } };
  const [pstat, setPstat] = useState('');
  const pcheck = async () => { setPstat('Controllo…'); const ok = await puterSignedIn(); setPstat(ok ? 'Accesso a Puter attivo. Quota mensile: ' + await puterUsage() : 'Non hai ancora fatto accesso a Puter.'); };
  const plogin = async () => { try { await puterSignIn(); await pcheck(); } catch (e) { setPstat('Accesso non riuscito: ' + String((e as Error)?.message ?? e).slice(0, 120)); } };
  const keys: [keyof DescTemplates, string][] = [['announceA', 'Annuncio – prima squadra'], ['announceB', 'Annuncio – giovanili / seconda squadra'], ['announceMulti', 'Annuncio – triangolari / tornei'], ['resultWin', 'Risultato – vittoria'], ['resultLoss', 'Risultato – sconfitta'], ['resultDraw', 'Risultato – pareggio']];
  return (<>
    <h1>Impostazioni</h1>
    <h2>Servizio AI</h2>
    <label>Motore di generazione</label>
    <select value={s.engine ?? 'cloudflare'} onChange={e => setS({ ...s, engine: e.target.value as 'puter' | 'cloudflare' })}>
      <option value="puter">Puter – GPT Image (qualità massima, serve un account Puter gratuito)</option>
      <option value="cloudflare">Cloudflare – FLUX (gratis, qualità inferiore)</option>
    </select>
    {(s.engine ?? 'cloudflare') === 'puter' && <>
      <label>Modello</label>
      <select value={s.puterModel ?? 'openai/gpt-image-2.6-flare'} onChange={e => setS({ ...s, puterModel: e.target.value })}>
        <option value="openai/gpt-image-2.6-flare">GPT Image 2.6 Flare (veloce)</option>
        <option value="openai/gpt-image-2.6-sunburst">GPT Image 2.6 Sunburst (più preciso nei dettagli)</option>
        <option value="google/gemini-3-pro-image">Nano Banana Pro (Google)</option>
      </select>
      <label>Qualità</label>
      <select value={s.puterQuality ?? 'medium'} onChange={e => setS({ ...s, puterQuality: e.target.value })}><option value="low">Bassa (consuma meno quota)</option><option value="medium">Media</option><option value="high">Alta</option></select>
      <div className="row" style={{ marginTop: 10 }}><button className="b s grow" onClick={plogin}>Accedi a Puter</button><button className="b s" onClick={pcheck}>Stato e quota</button></div>
      {pstat && <p className="mut">{pstat}</p>}
      <p className="mut">Puter è un servizio esterno: usi il tuo account gratuito e la tua quota mensile. L'app non ha chiavi né server propri per questo motore.</p>
    </>}
    {(s.engine ?? 'cloudflare') === 'cloudflare' && <>
    <label>Indirizzo del Worker Cloudflare</label><input value={s.workerUrl} onChange={e => setS({ ...s, workerUrl: e.target.value })} placeholder="https://monticano-post-ai.tuonome.workers.dev" autoCapitalize="none" />
    <label>Codice di accesso (APP_TOKEN del Worker)</label><input value={s.workerToken} onChange={e => setS({ ...s, workerToken: e.target.value })} autoCapitalize="none" />
    <p className="mut">Il codice è conservato solo su questo telefono. La chiave del servizio AI non è mai nell'app.</p>
    <div className="row"><button className="b grow" onClick={async () => { await saveSettings(s); await refresh(); toast('Impostazioni salvate.'); }}>Salva</button><button className="b s" disabled={!s.workerUrl} onClick={check}>Verifica</button></div>
    {test && <p className="mut">{test}</p>}</>}
    {(s.engine ?? 'cloudflare') === 'puter' && <div className="row" style={{ marginTop: 10 }}><button className="b grow" onClick={async () => { await saveSettings(s); await refresh(); toast('Impostazioni salvate.'); }}>Salva</button></div>}
    <h2>Backup</h2>
    <div className="row"><button className="b s grow" onClick={backup}>Esporta backup</button><button className="b s grow" onClick={() => f.current?.click()}>Importa backup</button></div>
    <input ref={f} type="file" accept="application/json,.json" hidden onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; if (!confirm("L'importazione sostituisce tutti i dati presenti su questo telefono. Continuare?")) return; try { const r = await importBackup(file); await refresh(); toast(`Ripristinati: ${r.matches} partite, ${r.projects} progetti, ${r.teams} squadre.`); } catch (err) { toast((err as Error).message || 'Backup non valido.'); } }} />
    <p className="mut">Esporta un backup ogni tanto (e prima di cancellare i dati di Safari): i dati vivono solo su questo telefono.</p>
    <h2>Modelli delle descrizioni</h2>
    <p className="mut">Segnaposto: {'{categoria} {competizione} {giornata} {squadre} {casa} {ospite} {data} {ora} {luogo} {risultato} {marcatori} {assist} {note}'}. Sostituisci i testi con il tuo tono reale.</p>
    {keys.map(([k, l]) => <div key={k}><label>{l}</label><textarea value={t[k]} onChange={e => setT({ ...t, [k]: e.target.value })} /></div>)}
    <div className="row" style={{ marginTop: 10 }}><button className="b grow" onClick={async () => { await saveTemplates(t); await refresh(); toast('Modelli salvati.'); }}>Salva modelli</button><button className="b s" onClick={() => setT(DEFAULT_TEMPLATES)}>Ripristina</button></div>
  </>);
}
