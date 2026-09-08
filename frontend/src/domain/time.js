/**
 * Time helpers. Pure, framework-free, no React.
 *
 * Every function here takes ISO-8601 UTC instants. Wall-clock rendering is a
 * presentation concern and happens only at the edges, via formatTime.
 */

/** The conference runs in Mountain Daylight Time. */
export const EVENT_TIME_ZONE = 'America/Denver';

export function toEpochMs(iso) {
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

export function durationMinutes(startUtc, endUtc) {
  return (toEpochMs(endUtc) - toEpochMs(startUtc)) / 60_000;
}

/**
 * Format an instant as a wall-clock time in a given zone.
 * Defaults to the event's own zone so the grid matches the printed programme;
 * pass the viewer's zone to show local time instead.
 */
export function formatTime(iso, timeZone = EVENT_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  })
    .format(new Date(toEpochMs(iso)))
    .replace(/\s/g, ' ');
}

export function formatTimeRange(startUtc, endUtc, timeZone = EVENT_TIME_ZONE) {
  return `${formatTime(startUtc, timeZone)} – ${formatTime(endUtc, timeZone)}`;
}

export function formatDayLabel(iso, timeZone = EVENT_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(new Date(toEpochMs(iso)));
}

export function formatDuration(minutes) {
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole} min`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** The viewer's own IANA zone, for the "show local time" toggle. */
export function viewerTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
