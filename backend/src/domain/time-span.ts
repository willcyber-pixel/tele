/**
 * The smallest shape the scheduling domain needs. Deliberately not the ORM
 * entity: every function in this folder is pure, framework-free and testable
 * without Nest, TypeORM or a database.
 */
export interface TimeSpan {
  id: string;
  startUtc: string;
  endUtc: string;
  room?: string;
}

/**
 * Parse an ISO-8601 instant to epoch milliseconds.
 *
 * Epoch ms is inherently UTC, which is the whole point: every comparison in
 * this domain happens on the absolute instant, never on a wall-clock string.
 * A local-time string without an offset is rejected rather than silently
 * reinterpreted in the server's timezone.
 */
export function toEpochMs(iso: string): number {
  if (typeof iso !== 'string' || iso.length === 0) {
    throw new TypeError(`Expected an ISO-8601 instant, received: ${String(iso)}`);
  }
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(iso)) {
    throw new TypeError(`Instant is missing a UTC offset, refusing to guess: ${iso}`);
  }
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new TypeError(`Unparseable ISO-8601 instant: ${iso}`);
  }
  return ms;
}

export function durationMinutes(span: TimeSpan): number {
  return (toEpochMs(span.endUtc) - toEpochMs(span.startUtc)) / 60_000;
}

/**
 * Overlap in minutes between two spans. Zero when they merely touch
 * (one ends exactly as the other starts) or are disjoint.
 */
export function overlapMinutes(a: TimeSpan, b: TimeSpan): number {
  const aStart = toEpochMs(a.startUtc);
  const aEnd = toEpochMs(a.endUtc);
  const bStart = toEpochMs(b.startUtc);
  const bEnd = toEpochMs(b.endUtc);

  const overlapMs = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
  return overlapMs > 0 ? overlapMs / 60_000 : 0;
}

/**
 * Gap in minutes between two non-overlapping spans. Negative when they
 * overlap, so callers can branch on the sign.
 */
export function gapMinutes(a: TimeSpan, b: TimeSpan): number {
  const [first, second] =
    toEpochMs(a.startUtc) <= toEpochMs(b.startUtc) ? [a, b] : [b, a];
  return (toEpochMs(second.startUtc) - toEpochMs(first.endUtc)) / 60_000;
}
