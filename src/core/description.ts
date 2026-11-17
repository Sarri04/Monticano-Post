import type { Category, Match, Outcome } from './types';
import { formatDateIt, ordinalRound, outcomeFor } from './outcome';
import { allTeamNames, isMulti } from './layout';

export interface DescTemplates { announceA: string; announceB: string; announceMulti: string; resultWin: string; resultLoss: string; resultDraw: string; }

/**
 * Modelli di partenza, volutamente neutri: vanno personalizzati in Impostazioni con il tono reale del Monticano C5.
 * Segnaposto: {categoria} {competizione} {giornata} {squadre} {casa} {ospite} {data} {ora} {luogo} {risultato} {marcatori} {assist} {note}
 */
export const DEFAULT_TEMPLATES: DescTemplates = {
  announceA: '🔥 {categoria} · {competizione}\n{giornata}\n\n⚽ {casa} vs {ospite}\n\n📅 {data}\n⏰ {ora}\n📍 {luogo}\n\nForza Monticano! 💙\n\n#monticanoc5 #calcioa5 #futsal',
  announceB: '⚽ {categoria}\n{giornata}\n\n{squadre}\n\n📅 {data}\n⏰ {ora}\n📍 {luogo}\n\n#monticanoc5 #settoregiovanile #futsal',
  announceMulti: '🏆 {categoria}\n{giornata}\n\nSi gioca: {squadre}\n\n📅 {data}\n⏰ {ora}\n📍 {luogo}\n\n#monticanoc5 #futsal',
  resultWin: '✅ {categoria} · {giornata}\n\nVittoria! {casa} {risultato} {ospite}\n\n⚽ {marcatori}\n🅰 {assist}\n{note}\n\n#monticanoc5 #calcioa5 #futsal',
  resultLoss: '{categoria} · {giornata}\n\n{casa} {risultato} {ospite}\n\n⚽ {marcatori}\n🅰 {assist}\n{note}\n\nSi lavora per la prossima. 💙\n\n#monticanoc5 #calcioa5 #futsal',
  resultDraw: '{categoria} · {giornata}\n\nPareggio: {casa} {risultato} {ospite}\n\n⚽ {marcatori}\n🅰 {assist}\n{note}\n\n#monticanoc5 #calcioa5 #futsal'
};

export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  const out = tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  const cleaned = out.split('\n').filter(l => !/^\s*(⚽|🅰|📅|⏰|📍)\s*$/.test(l));
  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function buildDescription(m: Match, cat: Category, kind: 'announce' | 'result', t: DescTemplates = DEFAULT_TEMPLATES): string {
  const vars: Record<string, string> = {
    categoria: cat.name, competizione: m.competition, giornata: ordinalRound(m.round), casa: m.homeName, ospite: m.awayName,
    squadre: allTeamNames(m).join('\n'), data: formatDateIt(m.date), ora: m.time ? `ore ${m.time}` : '', luogo: m.venue,
    risultato: m.result ? `${m.result.home}-${m.result.away}` : '', marcatori: m.result?.scorers.trim() ?? '', assist: m.result?.assists.trim() ?? '', note: m.result?.notes.trim() ?? ''
  };
  if (kind === 'result') {
    const o: Outcome = outcomeFor(m) ?? 'draw';
    return fillTemplate(o === 'win' ? t.resultWin : o === 'loss' ? t.resultLoss : t.resultDraw, vars);
  }
  if (isMulti(m)) return fillTemplate(t.announceMulti, vars);
  return fillTemplate(cat.template === 'A' ? t.announceA : t.announceB, vars);
}
