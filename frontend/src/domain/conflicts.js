import { toEpochMs } from './time';

/**
 * Conflict detection, computed locally on UTC instants.
 *
 * The backend exposes the same rules at /schedule/:id/conflicts and stays
 * authoritative. This copy exists so toggling a session repaints instantly
 * instead of waiting on a round trip -- optimistic UI, server reconciles.
 */

export const TIGHT_TRANSITION_MINUTES = 10;

export function overlapMinutes(a, b) {
  const overlapMs =
    Math.min(toEpochMs(a.endUtc), toEpochMs(b.endUtc)) -
    Math.max(toEpochMs(a.startUtc), toEpochMs(b.startUtc));
  return overlapMs > 0 ? overlapMs / 60_000 : 0;
}

export function gapMinutes(a, b) {
  const [first, second] =
    toEpochMs(a.startUtc) <= toEpochMs(b.startUtc) ? [a, b] : [b, a];
  return (toEpochMs(second.startUtc) - toEpochMs(first.endUtc)) / 60_000;
}

/**
 * Sort-then-sweep over the picked sessions.
 *
 * Spans are ordered by start instant and each is compared only against those
 * still open behind it; anything that has already ended is retired from the
 * active set. O(n log n + k) for k reported pairs rather than O(n^2).
 *
 * Breaks are excluded -- a session running alongside lunch is not a clash.
 */
export function detectConflicts(sessions) {
  const ordered = sessions
    .filter((s) => s.kind !== 'break')
    .slice()
    .sort((a, b) => toEpochMs(a.startUtc) - toEpochMs(b.startUtc));

  const conflicts = [];
  let active = [];

  for (const session of ordered) {
    const start = toEpochMs(session.startUtc);
    const stillActive = [];

    for (const candidate of active) {
      if (toEpochMs(candidate.endUtc) > start) {
        stillActive.push(candidate);
        continue;
      }
      const gap = gapMinutes(candidate, session);
      if (gap >= 0 && gap < TIGHT_TRANSITION_MINUTES && candidate.room !== session.room) {
        conflicts.push({
          aId: candidate.id,
          bId: session.id,
          severity: 'tight',
          overlapMinutes: 0,
          gapMinutes: gap,
        });
      }
    }
    active = stillActive;

    for (const candidate of active) {
      const overlap = overlapMinutes(candidate, session);
      if (overlap > 0) {
        conflicts.push({
          aId: candidate.id,
          bId: session.id,
          severity: 'overlap',
          overlapMinutes: overlap,
          gapMinutes: gapMinutes(candidate, session),
        });
      }
    }

    active.push(session);
  }

  return conflicts;
}

/** Index conflicts by session id so a card can check itself in O(1). */
export function conflictsBySessionId(conflicts) {
  const index = new Map();
  const push = (id, conflict) => {
    const existing = index.get(id);
    if (existing) existing.push(conflict);
    else index.set(id, [conflict]);
  };
  for (const conflict of conflicts) {
    push(conflict.aId, conflict);
    push(conflict.bId, conflict);
  }
  return index;
}

/** Worst severity affecting a session: 'overlap' outranks 'tight'. */
export function severityFor(sessionId, index) {
  const found = index.get(sessionId);
  if (!found || found.length === 0) return null;
  return found.some((c) => c.severity === 'overlap') ? 'overlap' : 'tight';
}

export function countBySeverity(conflicts) {
  return {
    overlap: conflicts.filter((c) => c.severity === 'overlap').length,
    tight: conflicts.filter((c) => c.severity === 'tight').length,
  };
}
