import { useRef, useState } from 'react';
import { useStore } from './store';
import { exportBackup, importBackup, saveSettings, saveTemplates } from '../core/db';
import { DEFAULT_TEMPLATES, type DescTemplates } from '../core/description';

export function SettingsScreen() {
  const { settings, templates, refresh, toast } = useStore();
  const [s, setS] = useState(settings); const [t, setT] = useState<DescTemplates>(templates ?? DEFAULT_TEMPLATES);
  const [test, setTest] = useState(''); const f = useRef<HTMLInputElement>(null);
  const backup = async () => { const b = await exportBackup(); const file = new File([b], `monticano-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' }); try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if ((e as Error).name === 'AbortError') return; } const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = file.name; a.click(); };
  const check = async () => { setTest('Verifico…'); try { const r = await fetch(s.workerUrl.replace(/\/$/, '') + '/health'); const j = await r.json(); setTest(r.ok && j.ok ? `Worker raggiungibile (${j.model}).` : `Risposta inattesa (${r.status}).`); } catch { setTest('Worker non raggiungibile: controlla indirizzo e CORS (ALLOWED_ORIGIN).'); } };
  const keys: [keyof DescTemplates, string][] = [['announceA', 'Annuncio – prima squadra'], ['announceB', 'Annuncio – giovanili / seconda squadra'], ['announceMulti', 'Annuncio – triangolari / tornei'], ['resultWin', 'Risultato – vittoria'], ['resultLoss', 'Risultato – sconfitta'], ['resultDraw', 'Risultato – pareggio']];
  return (<>
    <h1>Impostazioni</h1>
    <h2>Servizio AI (sfondi)</h2>
    <label>Indirizzo del Worker Cloudflare</label><input value={s.workerUrl} onChange={e => setS({ ...s, workerUrl: e.target.value })} placeholder="https://monticano-post-ai.tuonome.workers.dev" autoCapitalize="none" />
    <label>Codice di accesso (APP_TOKEN del Worker)</label><input value={s.workerToken} onChange={e => setS({ ...s, workerToken: e.target.value })} autoCapitalize="none" />
    <p className="mut">Il codice è conservato solo su questo telefono. La chiave del servizio AI non è mai nell'app.</p>
    <div className="row"><button className="b grow" onClick={async () => { await saveSettings(s); await refresh(); toast('Impostazioni salvate.'); }}>Salva</button><button className="b s" disabled={!s.workerUrl} onClick={check}>Verifica</button></div>
    {test && <p className="mut">{test}</p>}
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
