import {
  conflictsBySessionId,
  detectConflicts,
  severityFor,
  TIGHT_TRANSITION_MINUTES,
} from './conflicts';
import { TimeSpan } from './time-span';

const span = (
  id: string,
  startUtc: string,
  endUtc: string,
  room = 'start',
): TimeSpan => ({ id, startUtc, endUtc, room });

describe('detectConflicts', () => {
  it('returns nothing for an empty selection', () => {
    expect(detectConflicts([])).toEqual([]);
  });

  it('returns nothing for a single session', () => {
    expect(detectConflicts([span('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z')])).toEqual([]);
  });

  it('flags two sessions in the same slot as an overlap', () => {
    const conflicts = detectConflicts([
      span('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
      span('b', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'ignition'),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      aId: 'a',
      bId: 'b',
      severity: 'overlap',
      overlapMinutes: 35,
    });
  });

  it('reports partial overlap in minutes', () => {
    const conflicts = detectConflicts([
      span('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
      span('b', '2026-06-23T16:50:00Z', '2026-06-23T17:30:00Z', 'ignition'),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlapMinutes).toBe(15);
  });

  it('treats back-to-back sessions as touching, not overlapping', () => {
    const conflicts = detectConflicts([
      span('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
      span('b', '2026-06-23T17:05:00Z', '2026-06-23T17:40:00Z', 'start'),
    ]);

    expect(conflicts).toEqual([]);
  });

  it('flags a tight transition when rooms differ and the gap is under the threshold', () => {
    const conflicts = detectConflicts([
      span('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
      span('b', '2026-06-23T17:10:00Z', '2026-06-23T17:40:00Z', 'accelerator'),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      severity: 'tight',
      overlapMinutes: 0,
      gapMinutes: 5,
    });
  });

  it('does not flag a tight transition inside the same room', () => {
    const conflicts = detectConflicts([
      span('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
      span('b', '2026-06-23T17:10:00Z', '2026-06-23T17:40:00Z', 'start'),
    ]);

    expect(conflicts).toEqual([]);
  });

  it('does not flag a transition at exactly the threshold', () => {
    const conflicts = detectConflicts([
      span('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
      span(
        'b',
        `2026-06-23T${String(17).padStart(2, '0')}:${5 + TIGHT_TRANSITION_MINUTES}:00Z`,
        '2026-06-23T18:00:00Z',
        'accelerator',
      ),
    ]);

    expect(conflicts).toEqual([]);
  });

  it('reports every pair when three sessions collide', () => {
    const conflicts = detectConflicts([
      span('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
      span('b', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'ignition'),
      span('c', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'accelerator'),
    ]);

    expect(conflicts).toHaveLength(3);
    expect(conflicts.every((c) => c.severity === 'overlap')).toBe(true);
  });

  it('orders each reported pair by start time regardless of input order', () => {
    const conflicts = detectConflicts([
      span('later', '2026-06-23T16:50:00Z', '2026-06-23T17:30:00Z', 'ignition'),
      span('earlier', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
    ]);

    expect(conflicts[0].aId).toBe('earlier');
    expect(conflicts[0].bId).toBe('later');
  });

  it('ignores a fully-contained session only when it genuinely overlaps', () => {
    const conflicts = detectConflicts([
      span('outer', '2026-06-23T16:00:00Z', '2026-06-23T18:00:00Z', 'start'),
      span('inner', '2026-06-23T16:30:00Z', '2026-06-23T17:00:00Z', 'ignition'),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlapMinutes).toBe(30);
  });

  it('does not drop a conflict with an earlier long session when a short one sits between', () => {
    // 'outer' stays open across 'middle'; the sweep must not retire it early.
    const conflicts = detectConflicts([
      span('outer', '2026-06-23T16:00:00Z', '2026-06-23T19:00:00Z', 'start'),
      span('middle', '2026-06-23T16:10:00Z', '2026-06-23T16:20:00Z', 'ignition'),
      span('late', '2026-06-23T18:30:00Z', '2026-06-23T19:30:00Z', 'accelerator'),
    ]);

    const pairs = conflicts.map((c) => `${c.aId}|${c.bId}`);
    expect(pairs).toContain('outer|middle');
    expect(pairs).toContain('outer|late');
  });

  it('compares across timezone representations of the same instant', () => {
    // 16:30Z and 10:30-06:00 are the same moment; this must still be an overlap.
    const conflicts = detectConflicts([
      span('utc', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
      span('mdt', '2026-06-23T10:30:00-06:00', '2026-06-23T11:05:00-06:00', 'ignition'),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlapMinutes).toBe(35);
  });

  it('scales to a large selection without pairwise blowup', () => {
    // 2000 sequential, non-overlapping, same-room sessions => no conflicts,
    // and completes quickly because the active set never grows.
    const many: TimeSpan[] = Array.from({ length: 2000 }, (_, i) => {
      const start = new Date(Date.UTC(2026, 5, 23, 0, 0, 0) + i * 60 * 60_000);
      const end = new Date(start.getTime() + 30 * 60_000);
      return span(`s${i}`, start.toISOString(), end.toISOString(), 'start');
    });

    const startedAt = Date.now();
    expect(detectConflicts(many)).toEqual([]);
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });
});

describe('conflictsBySessionId', () => {
  it('indexes each conflict under both of its sessions', () => {
    const conflicts = detectConflicts([
      span('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
      span('b', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'ignition'),
    ]);

    const index = conflictsBySessionId(conflicts);
    expect(index.get('a')).toHaveLength(1);
    expect(index.get('b')).toHaveLength(1);
    expect(index.get('missing')).toBeUndefined();
  });
});

describe('severityFor', () => {
  it('returns null for a session with no conflicts', () => {
    expect(severityFor('a', new Map())).toBeNull();
  });

  it('ranks a hard overlap above a tight transition', () => {
    const index = conflictsBySessionId([
      { aId: 'a', bId: 'b', severity: 'tight', overlapMinutes: 0, gapMinutes: 5 },
      { aId: 'a', bId: 'c', severity: 'overlap', overlapMinutes: 20, gapMinutes: -20 },
    ]);

    expect(severityFor('a', index)).toBe('overlap');
    expect(severityFor('b', index)).toBe('tight');
  });
});
