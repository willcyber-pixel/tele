import { describe, expect, it } from 'vitest';

import {
  conflictsBySessionId,
  countBySeverity,
  detectConflicts,
  gapMinutes,
  overlapMinutes,
  severityFor,
} from './conflicts';

const session = (id, startUtc, endUtc, room = 'start', kind = 'session') => ({
  id,
  startUtc,
  endUtc,
  room,
  kind,
});

describe('overlapMinutes', () => {
  it('is zero for disjoint spans', () => {
    expect(
      overlapMinutes(
        session('a', '2026-06-23T16:00:00Z', '2026-06-23T17:00:00Z'),
        session('b', '2026-06-23T18:00:00Z', '2026-06-23T19:00:00Z'),
      ),
    ).toBe(0);
  });

  it('is zero for spans that merely touch', () => {
    expect(
      overlapMinutes(
        session('a', '2026-06-23T16:00:00Z', '2026-06-23T17:00:00Z'),
        session('b', '2026-06-23T17:00:00Z', '2026-06-23T18:00:00Z'),
      ),
    ).toBe(0);
  });

  it('measures a partial overlap', () => {
    expect(
      overlapMinutes(
        session('a', '2026-06-23T16:00:00Z', '2026-06-23T17:00:00Z'),
        session('b', '2026-06-23T16:45:00Z', '2026-06-23T18:00:00Z'),
      ),
    ).toBe(15);
  });

  it('is symmetric', () => {
    const a = session('a', '2026-06-23T16:00:00Z', '2026-06-23T17:00:00Z');
    const b = session('b', '2026-06-23T16:45:00Z', '2026-06-23T18:00:00Z');
    expect(overlapMinutes(a, b)).toBe(overlapMinutes(b, a));
  });
});

describe('gapMinutes', () => {
  it('measures the gap between sequential spans', () => {
    expect(
      gapMinutes(
        session('a', '2026-06-23T16:00:00Z', '2026-06-23T17:00:00Z'),
        session('b', '2026-06-23T17:05:00Z', '2026-06-23T18:00:00Z'),
      ),
    ).toBe(5);
  });

  it('is negative when the spans overlap', () => {
    expect(
      gapMinutes(
        session('a', '2026-06-23T16:00:00Z', '2026-06-23T17:00:00Z'),
        session('b', '2026-06-23T16:45:00Z', '2026-06-23T18:00:00Z'),
      ),
    ).toBe(-15);
  });

  it('does not depend on argument order', () => {
    const a = session('a', '2026-06-23T16:00:00Z', '2026-06-23T17:00:00Z');
    const b = session('b', '2026-06-23T17:05:00Z', '2026-06-23T18:00:00Z');
    expect(gapMinutes(a, b)).toBe(gapMinutes(b, a));
  });
});

describe('detectConflicts', () => {
  it('finds nothing in an empty schedule', () => {
    expect(detectConflicts([])).toEqual([]);
  });

  it('finds nothing for a single session', () => {
    expect(detectConflicts([session('a', '2026-06-23T16:00:00Z', '2026-06-23T17:00:00Z')])).toEqual([]);
  });

  it('flags two sessions in the same slot', () => {
    const conflicts = detectConflicts([
      session('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
      session('b', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'ignition'),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ severity: 'overlap', overlapMinutes: 35 });
  });

  it('flags two stacked sessions inside one room', () => {
    const conflicts = detectConflicts([
      session('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
      session('b', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('overlap');
  });

  it('does not flag back-to-back sessions in the same room', () => {
    expect(
      detectConflicts([
        session('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
        session('b', '2026-06-23T17:05:00Z', '2026-06-23T17:40:00Z', 'start'),
      ]),
    ).toEqual([]);
  });

  it('flags a tight transition between different rooms', () => {
    const conflicts = detectConflicts([
      session('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
      session('b', '2026-06-23T17:10:00Z', '2026-06-23T17:45:00Z', 'accelerator'),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ severity: 'tight', gapMinutes: 5 });
  });

  it('ignores breaks entirely', () => {
    const conflicts = detectConflicts([
      session('lunch', '2026-06-23T18:00:00Z', '2026-06-23T19:30:00Z', 'mainstage', 'break'),
      session('talk', '2026-06-23T18:30:00Z', '2026-06-23T19:00:00Z', 'start'),
    ]);

    expect(conflicts).toEqual([]);
  });

  it('reports all three pairs for a triple booking', () => {
    const conflicts = detectConflicts([
      session('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
      session('b', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'ignition'),
      session('c', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'accelerator'),
    ]);

    expect(conflicts).toHaveLength(3);
  });

  it('keeps a long session open across a short one that sits inside it', () => {
    const conflicts = detectConflicts([
      session('outer', '2026-06-23T16:00:00Z', '2026-06-23T19:00:00Z', 'start'),
      session('middle', '2026-06-23T16:10:00Z', '2026-06-23T16:20:00Z', 'ignition'),
      session('late', '2026-06-23T18:30:00Z', '2026-06-23T19:30:00Z', 'accelerator'),
    ]);

    const pairs = conflicts.map((c) => `${c.aId}|${c.bId}`);
    expect(pairs).toContain('outer|middle');
    expect(pairs).toContain('outer|late');
  });

  it('never flags sessions on different days', () => {
    expect(
      detectConflicts([
        session('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z'),
        session('b', '2026-06-24T16:30:00Z', '2026-06-24T17:05:00Z', 'ignition'),
      ]),
    ).toEqual([]);
  });

  it('compares instants, not wall-clock strings', () => {
    const conflicts = detectConflicts([
      session('utc', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
      session('mdt', '2026-06-23T10:30:00-06:00', '2026-06-23T11:05:00-06:00', 'ignition'),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlapMinutes).toBe(35);
  });

  it('does not mutate the input array', () => {
    const input = [
      session('b', '2026-06-23T17:00:00Z', '2026-06-23T18:00:00Z'),
      session('a', '2026-06-23T16:00:00Z', '2026-06-23T17:00:00Z'),
    ];
    const order = input.map((s) => s.id);

    detectConflicts(input);
    expect(input.map((s) => s.id)).toEqual(order);
  });
});

describe('conflictsBySessionId / severityFor', () => {
  it('indexes a conflict under both sessions', () => {
    const index = conflictsBySessionId(
      detectConflicts([
        session('a', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'start'),
        session('b', '2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z', 'ignition'),
      ]),
    );

    expect(index.get('a')).toHaveLength(1);
    expect(index.get('b')).toHaveLength(1);
  });

  it('returns null for an unaffected session', () => {
    expect(severityFor('nope', new Map())).toBeNull();
  });

  it('ranks overlap above tight', () => {
    const index = conflictsBySessionId([
      { aId: 'a', bId: 'b', severity: 'tight', overlapMinutes: 0, gapMinutes: 5 },
      { aId: 'a', bId: 'c', severity: 'overlap', overlapMinutes: 20, gapMinutes: -20 },
    ]);

    expect(severityFor('a', index)).toBe('overlap');
    expect(severityFor('b', index)).toBe('tight');
  });
});

describe('countBySeverity', () => {
  it('counts each severity', () => {
    expect(
      countBySeverity([
        { severity: 'overlap' },
        { severity: 'overlap' },
        { severity: 'tight' },
      ]),
    ).toEqual({ overlap: 2, tight: 1 });
  });

  it('returns zeroes for an empty list', () => {
    expect(countBySeverity([])).toEqual({ overlap: 0, tight: 0 });
  });
});
