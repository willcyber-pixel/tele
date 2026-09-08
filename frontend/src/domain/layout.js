import { toEpochMs } from './time';

/**
 * Grid layout engine.
 *
 * Turns a day's sessions into pure geometry -- row spans, columns and lanes --
 * with no knowledge of React or CSS. Everything here is deterministic and
 * unit-testable; the component layer only reads the numbers out.
 *
 * The grid is a time canvas: a session's height is derived from its actual
 * duration, so a 35-minute talk is visibly shorter than a 45-minute one.
 */

export const ROOMS = [
  { id: 'start', label: 'Start Room', badge: 'A' },
  { id: 'ignition', label: 'Ignition Room', badge: 'B' },
  { id: 'accelerator', label: 'Accelerator', badge: 'C' },
];

export const ROOM_IDS = ROOMS.map((r) => r.id);

/** Vertical scale for ordinary sessions. */
export const PX_PER_MINUTE = 2.1;

/**
 * Breaks and lunches get a fixed, compact height instead of a proportional
 * one. A 90-minute lunch at true scale is a 190px empty bar that pushes the
 * afternoon off-screen for no informational gain.
 */
export const UTILITY_ROW_PX = 46;

/** Floor for a proportional segment, so a 5-minute sliver stays clickable. */
export const MIN_SEGMENT_PX = 12;

export function isUtility(session) {
  return session.kind === 'break';
}

export function isFullWidth(session) {
  return Boolean(session.fullWidth) || session.room === 'mainstage';
}

/**
 * Assign overlapping sessions within one room to side-by-side lanes.
 *
 * Greedy interval colouring: sessions are walked in start order and dropped
 * into the first lane whose last occupant has already finished. Returns a map
 * of session id -> lane index, plus the total lane count for the room.
 */
export function assignLanes(sessions) {
  const ordered = [...sessions].sort(
    (a, b) => toEpochMs(a.startUtc) - toEpochMs(b.startUtc),
  );

  const laneEnds = []; // laneEnds[i] = epoch ms at which lane i frees up
  const laneBySessionId = new Map();

  for (const session of ordered) {
    const start = toEpochMs(session.startUtc);
    const end = toEpochMs(session.endUtc);

    let lane = laneEnds.findIndex((freeAt) => freeAt <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    laneBySessionId.set(session.id, lane);
  }

  return { laneBySessionId, laneCount: Math.max(laneEnds.length, 1) };
}

/**
 * Build the row lattice for a day.
 *
 * Rows are derived from the distinct instants at which anything starts or
 * ends, so every session boundary lands exactly on a row edge and no session
 * needs a fractional row. A segment covered by a break is compressed to a
 * fixed height; everything else scales with its duration.
 */
export function buildRows(sessions, options = {}) {
  const {
    pxPerMinute = PX_PER_MINUTE,
    utilityRowPx = UTILITY_ROW_PX,
    minSegmentPx = MIN_SEGMENT_PX,
  } = options;

  if (sessions.length === 0) {
    return { boundaries: [], rowHeights: [], rowIndexByInstant: new Map(), totalPx: 0 };
  }

  const instants = new Set();
  for (const session of sessions) {
    instants.add(toEpochMs(session.startUtc));
    instants.add(toEpochMs(session.endUtc));
  }

  const boundaries = [...instants].sort((a, b) => a - b);
  const rowIndexByInstant = new Map(boundaries.map((ms, i) => [ms, i]));

  const utilitySpans = sessions.filter(isUtility).map((s) => ({
    start: toEpochMs(s.startUtc),
    end: toEpochMs(s.endUtc),
  }));

  const rowHeights = [];
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const from = boundaries[i];
    const to = boundaries[i + 1];

    const coveredByUtility = utilitySpans.some(
      (span) => span.start <= from && span.end >= to,
    );

    if (coveredByUtility) {
      rowHeights.push(utilityRowPx);
      continue;
    }

    const minutes = (to - from) / 60_000;
    rowHeights.push(Math.max(minutes * pxPerMinute, minSegmentPx));
  }

  return {
    boundaries,
    rowHeights,
    rowIndexByInstant,
    totalPx: rowHeights.reduce((sum, h) => sum + h, 0),
  };
}

/**
 * Full layout for one day.
 *
 * Returns placements keyed by session id. Grid line numbers are 1-based to
 * match CSS grid, and column 1 is the time gutter, so room columns start at 2.
 */
export function buildDayLayout(sessions, options = {}) {
  const rows = buildRows(sessions, options);
  if (sessions.length === 0) {
    return { ...rows, placements: [], laneCountByRoom: {} };
  }

  const roomSessions = sessions.filter((s) => !isFullWidth(s));
  const laneCountByRoom = {};
  const laneBySessionId = new Map();

  for (const roomId of ROOM_IDS) {
    const inRoom = roomSessions.filter((s) => s.room === roomId);
    const { laneBySessionId: lanes, laneCount } = assignLanes(inRoom);
    laneCountByRoom[roomId] = laneCount;
    for (const [id, lane] of lanes) laneBySessionId.set(id, lane);
  }

  const placements = sessions.map((session) => {
    const rowStart = rows.rowIndexByInstant.get(toEpochMs(session.startUtc)) + 1;
    const rowEnd = rows.rowIndexByInstant.get(toEpochMs(session.endUtc)) + 1;

    if (isFullWidth(session)) {
      return {
        sessionId: session.id,
        rowStart,
        rowEnd,
        columnStart: 2,
        columnEnd: 2 + ROOM_IDS.length,
        lane: 0,
        lanes: 1,
        fullWidth: true,
      };
    }

    const roomIndex = ROOM_IDS.indexOf(session.room);
    const column = roomIndex === -1 ? 2 : roomIndex + 2;

    return {
      sessionId: session.id,
      rowStart,
      rowEnd,
      columnStart: column,
      columnEnd: column + 1,
      lane: laneBySessionId.get(session.id) ?? 0,
      lanes: laneCountByRoom[session.room] ?? 1,
      fullWidth: false,
    };
  });

  return { ...rows, placements, laneCountByRoom };
}

/**
 * Time-gutter labels: one per instant at which something begins.
 * End instants that nothing starts at are skipped, which keeps the gutter
 * readable instead of listing every boundary twice.
 */
export function buildTimeLabels(sessions, rows) {
  const startInstants = new Set(sessions.map((s) => toEpochMs(s.startUtc)));

  return rows.boundaries
    .map((ms, index) => ({ ms, index }))
    .filter(({ ms }) => startInstants.has(ms))
    .map(({ ms, index }) => {
      const startingHere = sessions.filter((s) => toEpochMs(s.startUtc) === ms);
      const earliestEnd = Math.min(
        ...startingHere.map((s) => toEpochMs(s.endUtc)),
      );
      return {
        rowStart: index + 1,
        startMs: ms,
        endMs: earliestEnd,
        startUtc: new Date(ms).toISOString(),
        endUtc: new Date(earliestEnd).toISOString(),
      };
    });
}

/** Group a flat session list by day number, preserving chronological order. */
export function groupByDay(sessions) {
  const byDay = new Map();
  for (const session of sessions) {
    const list = byDay.get(session.day);
    if (list) list.push(session);
    else byDay.set(session.day, [session]);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => toEpochMs(a.startUtc) - toEpochMs(b.startUtc));
  }
  return byDay;
}
