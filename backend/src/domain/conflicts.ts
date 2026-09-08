import { gapMinutes, overlapMinutes, TimeSpan, toEpochMs } from './time-span';

export type ConflictSeverity = 'overlap' | 'tight';

export interface Conflict {
  /** Session ids, always ordered by start time so the pair is stable. */
  aId: string;
  bId: string;
  severity: ConflictSeverity;
  /** Minutes of genuine overlap. Zero for a 'tight' transition. */
  overlapMinutes: number;
  /** Minutes between the two. Negative when they overlap. */
  gapMinutes: number;
}

/**
 * Minimum walk time between rooms. Two sessions closer together than this,
 * in different rooms, are flagged as a soft warning rather than a clash.
 */
export const TIGHT_TRANSITION_MINUTES = 10;

/**
 * Find every scheduling conflict in a set of picked sessions.
 *
 * Sort-then-sweep: spans are ordered by start instant, and each span is only
 * compared against the still-open spans behind it. Once a candidate ends at or
 * before the current span starts it can never conflict with anything further
 * along, so it is dropped from the active set. That makes this O(n log n + k)
 * for k reported pairs, rather than the O(n^2) of comparing everything.
 */
export function detectConflicts(spans: TimeSpan[]): Conflict[] {
  const ordered = [...spans].sort(
    (a, b) => toEpochMs(a.startUtc) - toEpochMs(b.startUtc),
  );

  const conflicts: Conflict[] = [];
  let active: TimeSpan[] = [];

  for (const span of ordered) {
    const spanStart = toEpochMs(span.startUtc);

    // Anything that has already finished before this one opens is only ever
    // a 'tight transition' candidate, and only if it is the immediate
    // predecessor -- so retire it, but check the gap on the way out.
    const stillActive: TimeSpan[] = [];
    for (const candidate of active) {
      if (toEpochMs(candidate.endUtc) > spanStart) {
        stillActive.push(candidate);
        continue;
      }

      const gap = gapMinutes(candidate, span);
      if (
        gap >= 0 &&
        gap < TIGHT_TRANSITION_MINUTES &&
        candidate.room !== span.room
      ) {
        conflicts.push({
          aId: candidate.id,
          bId: span.id,
          severity: 'tight',
          overlapMinutes: 0,
          gapMinutes: gap,
        });
      }
    }
    active = stillActive;

    for (const candidate of active) {
      const overlap = overlapMinutes(candidate, span);
      if (overlap > 0) {
        conflicts.push({
          aId: candidate.id,
          bId: span.id,
          severity: 'overlap',
          overlapMinutes: overlap,
          gapMinutes: gapMinutes(candidate, span),
        });
      }
    }

    active.push(span);
  }

  return conflicts;
}

/**
 * Index conflicts by session id so the UI can ask "is this card in trouble?"
 * in constant time instead of re-scanning the list per card.
 */
export function conflictsBySessionId(
  conflicts: Conflict[],
): Map<string, Conflict[]> {
  const index = new Map<string, Conflict[]>();
  const push = (id: string, conflict: Conflict) => {
    const existing = index.get(id);
    if (existing) {
      existing.push(conflict);
    } else {
      index.set(id, [conflict]);
    }
  };

  for (const conflict of conflicts) {
    push(conflict.aId, conflict);
    push(conflict.bId, conflict);
  }
  return index;
}

/**
 * The worst severity affecting a given session, or null if it is clear.
 * 'overlap' outranks 'tight'.
 */
export function severityFor(
  sessionId: string,
  index: Map<string, Conflict[]>,
): ConflictSeverity | null {
  const found = index.get(sessionId);
  if (!found || found.length === 0) return null;
  return found.some((c) => c.severity === 'overlap') ? 'overlap' : 'tight';
}
