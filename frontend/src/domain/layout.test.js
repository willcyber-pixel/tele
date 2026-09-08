import { describe, expect, it } from 'vitest';

import {
  assignLanes,
  buildDayLayout,
  buildRows,
  buildTimeLabels,
  groupByDay,
  isFullWidth,
  isUtility,
  MIN_SEGMENT_PX,
  PX_PER_MINUTE,
  ROOM_IDS,
  UTILITY_ROW_PX,
} from './layout';

const session = (over = {}) => ({
  id: 's1',
  day: 1,
  title: 'A session',
  startUtc: '2026-06-23T16:30:00.000Z',
  endUtc: '2026-06-23T17:05:00.000Z',
  room: 'start',
  track: 'ai',
  kind: 'session',
  fullWidth: false,
  speakers: [],
  ...over,
});

const placementFor = (layout, id) =>
  layout.placements.find((p) => p.sessionId === id);

describe('isUtility / isFullWidth', () => {
  it('treats breaks as utility rows', () => {
    expect(isUtility(session({ kind: 'break' }))).toBe(true);
    expect(isUtility(session({ kind: 'session' }))).toBe(false);
  });

  it('treats mainstage items as full width', () => {
    expect(isFullWidth(session({ room: 'mainstage' }))).toBe(true);
    expect(isFullWidth(session({ fullWidth: true }))).toBe(true);
    expect(isFullWidth(session())).toBe(false);
  });
});

describe('assignLanes', () => {
  it('puts non-overlapping sessions in a single lane', () => {
    const { laneBySessionId, laneCount } = assignLanes([
      session({ id: 'a', startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T17:00:00Z' }),
      session({ id: 'b', startUtc: '2026-06-23T17:00:00Z', endUtc: '2026-06-23T18:00:00Z' }),
    ]);

    expect(laneCount).toBe(1);
    expect(laneBySessionId.get('a')).toBe(0);
    expect(laneBySessionId.get('b')).toBe(0);
  });

  it('splits two overlapping sessions into two lanes', () => {
    const { laneBySessionId, laneCount } = assignLanes([
      session({ id: 'a', startUtc: '2026-06-23T16:30:00Z', endUtc: '2026-06-23T17:05:00Z' }),
      session({ id: 'b', startUtc: '2026-06-23T16:30:00Z', endUtc: '2026-06-23T17:05:00Z' }),
    ]);

    expect(laneCount).toBe(2);
    expect(laneBySessionId.get('a')).toBe(0);
    expect(laneBySessionId.get('b')).toBe(1);
  });

  it('reuses a lane once its occupant has finished', () => {
    const { laneCount } = assignLanes([
      session({ id: 'a', startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T17:00:00Z' }),
      session({ id: 'b', startUtc: '2026-06-23T16:30:00Z', endUtc: '2026-06-23T17:30:00Z' }),
      session({ id: 'c', startUtc: '2026-06-23T17:00:00Z', endUtc: '2026-06-23T18:00:00Z' }),
    ]);

    // 'c' can take the lane 'a' vacated, so two lanes suffice for three items.
    expect(laneCount).toBe(2);
  });

  it('returns one lane for an empty room', () => {
    expect(assignLanes([]).laneCount).toBe(1);
  });
});

describe('buildRows', () => {
  it('returns an empty lattice for no sessions', () => {
    const rows = buildRows([]);
    expect(rows.boundaries).toEqual([]);
    expect(rows.totalPx).toBe(0);
  });

  it('creates a row boundary at every distinct start and end', () => {
    const rows = buildRows([
      session({ id: 'a', startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T17:00:00Z' }),
      session({ id: 'b', startUtc: '2026-06-23T17:00:00Z', endUtc: '2026-06-23T18:00:00Z' }),
    ]);

    expect(rows.boundaries).toHaveLength(3);
    expect(rows.rowHeights).toHaveLength(2);
  });

  it('deduplicates boundaries shared by concurrent sessions', () => {
    const rows = buildRows([
      session({ id: 'a', startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T17:00:00Z' }),
      session({ id: 'b', startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T17:00:00Z' }),
    ]);

    expect(rows.boundaries).toHaveLength(2);
  });

  it('scales an ordinary segment by its duration', () => {
    const rows = buildRows([
      session({ startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T17:00:00Z' }),
    ]);

    expect(rows.rowHeights[0]).toBeCloseTo(60 * PX_PER_MINUTE);
  });

  it('makes a longer session taller than a shorter one', () => {
    const rows = buildRows([
      session({ id: 'short', startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T16:35:00Z' }),
      session({ id: 'long', startUtc: '2026-06-23T16:35:00Z', endUtc: '2026-06-23T17:20:00Z' }),
    ]);

    expect(rows.rowHeights[1]).toBeGreaterThan(rows.rowHeights[0]);
  });

  it('compresses a break to a fixed height instead of scaling it', () => {
    const rows = buildRows([
      session({ id: 'lunch', kind: 'break', startUtc: '2026-06-23T18:00:00Z', endUtc: '2026-06-23T19:30:00Z' }),
    ]);

    // 90 real minutes would be ~189px; the compressed row is far shorter.
    expect(rows.rowHeights[0]).toBe(UTILITY_ROW_PX);
  });

  it('enforces a minimum height so a tiny segment stays clickable', () => {
    const rows = buildRows([
      session({ startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T16:01:00Z' }),
    ]);

    expect(rows.rowHeights[0]).toBe(MIN_SEGMENT_PX);
  });

  it('totals the row heights', () => {
    const rows = buildRows([
      session({ id: 'a', startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T17:00:00Z' }),
      session({ id: 'b', startUtc: '2026-06-23T17:00:00Z', endUtc: '2026-06-23T18:00:00Z' }),
    ]);

    expect(rows.totalPx).toBeCloseTo(rows.rowHeights.reduce((a, b) => a + b, 0));
  });
});

describe('buildDayLayout', () => {
  it('handles an empty day', () => {
    const layout = buildDayLayout([]);
    expect(layout.placements).toEqual([]);
  });

  it('places each room in its own column, after the time gutter', () => {
    const layout = buildDayLayout([
      session({ id: 'a', room: 'start' }),
      session({ id: 'b', room: 'ignition' }),
      session({ id: 'c', room: 'accelerator' }),
    ]);

    expect(placementFor(layout, 'a').columnStart).toBe(2);
    expect(placementFor(layout, 'b').columnStart).toBe(3);
    expect(placementFor(layout, 'c').columnStart).toBe(4);
  });

  it('spans full-width items across every room column', () => {
    const layout = buildDayLayout([
      session({ id: 'keynote', room: 'mainstage', fullWidth: true }),
    ]);

    const placement = placementFor(layout, 'keynote');
    expect(placement.fullWidth).toBe(true);
    expect(placement.columnStart).toBe(2);
    expect(placement.columnEnd).toBe(2 + ROOM_IDS.length);
  });

  it('spans a session across the rows its duration covers', () => {
    const layout = buildDayLayout([
      session({ id: 'a', startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T17:00:00Z' }),
      session({ id: 'b', startUtc: '2026-06-23T17:00:00Z', endUtc: '2026-06-23T18:00:00Z' }),
    ]);

    expect(placementFor(layout, 'a')).toMatchObject({ rowStart: 1, rowEnd: 2 });
    expect(placementFor(layout, 'b')).toMatchObject({ rowStart: 2, rowEnd: 3 });
  });

  it('gives stacked sessions in one room separate lanes', () => {
    // Day 1 Start Room really does have two concurrent cards at 10:30.
    const layout = buildDayLayout([
      session({ id: 'bridging', room: 'start' }),
      session({ id: 'surviving', room: 'start' }),
      session({ id: 'other', room: 'ignition' }),
    ]);

    expect(layout.laneCountByRoom.start).toBe(2);
    expect(layout.laneCountByRoom.ignition).toBe(1);

    const lanes = [
      placementFor(layout, 'bridging').lane,
      placementFor(layout, 'surviving').lane,
    ].sort();
    expect(lanes).toEqual([0, 1]);
    expect(placementFor(layout, 'bridging').lanes).toBe(2);
  });

  it('does not let one room’s lanes widen another room', () => {
    const layout = buildDayLayout([
      session({ id: 'a', room: 'start' }),
      session({ id: 'b', room: 'start' }),
      session({ id: 'c', room: 'accelerator' }),
    ]);

    expect(placementFor(layout, 'c').lanes).toBe(1);
    expect(placementFor(layout, 'c').columnStart).toBe(4);
  });

  it('produces a placement for every session', () => {
    const sessions = [
      session({ id: 'a', room: 'start' }),
      session({ id: 'b', room: 'ignition' }),
      session({ id: 'k', room: 'mainstage', fullWidth: true, startUtc: '2026-06-23T15:00:00Z', endUtc: '2026-06-23T15:15:00Z' }),
    ];

    expect(buildDayLayout(sessions).placements).toHaveLength(3);
  });
});

describe('buildTimeLabels', () => {
  it('emits one label per distinct start instant', () => {
    const sessions = [
      session({ id: 'a', startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T17:00:00Z' }),
      session({ id: 'b', startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T16:30:00Z', room: 'ignition' }),
      session({ id: 'c', startUtc: '2026-06-23T17:00:00Z', endUtc: '2026-06-23T18:00:00Z' }),
    ];
    const rows = buildRows(sessions);

    const labels = buildTimeLabels(sessions, rows);
    expect(labels).toHaveLength(2);
    expect(labels[0].startUtc).toBe('2026-06-23T16:00:00.000Z');
  });

  it('pairs a start with the earliest end among sessions beginning there', () => {
    const sessions = [
      session({ id: 'long', startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T18:00:00Z' }),
      session({ id: 'short', startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T16:35:00Z', room: 'ignition' }),
    ];
    const rows = buildRows(sessions);

    expect(buildTimeLabels(sessions, rows)[0].endUtc).toBe('2026-06-23T16:35:00.000Z');
  });

  it('anchors each label to the row its instant opens', () => {
    const sessions = [
      session({ id: 'a', startUtc: '2026-06-23T16:00:00Z', endUtc: '2026-06-23T17:00:00Z' }),
      session({ id: 'b', startUtc: '2026-06-23T17:00:00Z', endUtc: '2026-06-23T18:00:00Z' }),
    ];
    const rows = buildRows(sessions);
    const labels = buildTimeLabels(sessions, rows);

    expect(labels.map((l) => l.rowStart)).toEqual([1, 2]);
  });
});

describe('groupByDay', () => {
  it('splits sessions by day', () => {
    const byDay = groupByDay([
      session({ id: 'a', day: 1 }),
      session({ id: 'b', day: 2, startUtc: '2026-06-24T16:00:00Z', endUtc: '2026-06-24T17:00:00Z' }),
    ]);

    expect([...byDay.keys()].sort()).toEqual([1, 2]);
    expect(byDay.get(1)).toHaveLength(1);
  });

  it('orders each day chronologically regardless of input order', () => {
    const byDay = groupByDay([
      session({ id: 'late', day: 1, startUtc: '2026-06-23T20:00:00Z', endUtc: '2026-06-23T21:00:00Z' }),
      session({ id: 'early', day: 1, startUtc: '2026-06-23T15:00:00Z', endUtc: '2026-06-23T16:00:00Z' }),
    ]);

    expect(byDay.get(1).map((s) => s.id)).toEqual(['early', 'late']);
  });
});
