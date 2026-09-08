import { toEpochMs } from './time-span';

export interface CalendarEvent {
  uid: string;
  title: string;
  startUtc: string;
  endUtc: string;
  location?: string;
  description?: string;
}

export interface CalendarOptions {
  productId?: string;
  calendarName?: string;
  /** Minutes before start to fire a VALARM. Omit for no reminder. */
  reminderMinutes?: number;
  /** Injectable so tests are deterministic. */
  now?: Date;
}

const CRLF = '\r\n';

/**
 * Escape a value for a TEXT-typed iCalendar property.
 * Per RFC 5545 s3.3.11: backslash, semicolon and comma are escaped, and a
 * literal newline becomes \n. Order matters -- backslash must go first or it
 * would double-escape the sequences introduced afterwards.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');
}

/**
 * Fold a content line to 75 octets per RFC 5545 s3.1.
 *
 * The limit is octets, not characters, so folding is done over the UTF-8
 * encoding -- and a multi-byte character is never split across a fold, which
 * would corrupt it. Continuation lines begin with a single space.
 */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let cursor = 0;
  let limit = 75;

  while (cursor < bytes.length) {
    let end = Math.min(cursor + limit, bytes.length);

    // Walk back off a UTF-8 continuation byte (10xxxxxx) so we cut on a
    // character boundary.
    while (end > cursor && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end -= 1;
    }

    chunks.push(bytes.subarray(cursor, end).toString('utf8'));
    cursor = end;
    limit = 74; // subsequent lines lose one octet to the leading space
  }

  return chunks.join(`${CRLF} `);
}

/** Format an instant as an iCalendar UTC date-time: 20260623T163000Z */
export function formatIcsUtc(iso: string): string {
  const ms = toEpochMs(iso);
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Build a complete VCALENDAR document.
 *
 * All timestamps are emitted as UTC (`Z`) rather than with a VTIMEZONE block:
 * the instant is unambiguous, so every client renders it correctly in whatever
 * timezone the viewer happens to be in.
 */
export function buildCalendar(
  events: CalendarEvent[],
  options: CalendarOptions = {},
): string {
  const {
    productId = '-//StartFEST//Scheduler POC//EN',
    calendarName = 'My StartFEST Schedule',
    reminderMinutes,
    now = new Date(),
  } = options;

  const stamp = formatIcsUtc(now.toISOString());

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${escapeText(productId)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeText(event.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatIcsUtc(event.startUtc)}`,
      `DTEND:${formatIcsUtc(event.endUtc)}`,
      `SUMMARY:${escapeText(event.title)}`,
    );

    if (event.location) {
      lines.push(`LOCATION:${escapeText(event.location)}`);
    }
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }

    if (typeof reminderMinutes === 'number' && reminderMinutes > 0) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `TRIGGER:-PT${reminderMinutes}M`,
        `DESCRIPTION:${escapeText(event.title)}`,
        'END:VALARM',
      );
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // Trailing CRLF: RFC 5545 wants every content line terminated, the last included.
  return lines.map(foldLine).join(CRLF) + CRLF;
}
