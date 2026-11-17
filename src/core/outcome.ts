import type { Match, Outcome } from './types';

/** Esito dal punto di vista del Monticano. null se il risultato manca. */
export function outcomeFor(m: Pick<Match, 'monticanoHome' | 'result'>): Outcome | null {
  if (!m.result) return null;
  const { home, away } = m.result;
  if (home === away) return 'draw';
  const monticanoGoals = m.monticanoHome ? home : away;
  const otherGoals = m.monticanoHome ? away : home;
  return monticanoGoals > otherGoals ? 'win' : 'loss';
}
export const outcomeLabel: Record<Outcome, string> = { win: 'Vittoria', loss: 'Sconfitta', draw: 'Pareggio' };

export function formatDateIt(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso + 'T12:00:00');
  const s = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function ordinalRound(r: string): string {
  const t = r.trim();
  if (!t) return '';
  return /^\d+$/.test(t) ? `${t}ª giornata` : t;
}
