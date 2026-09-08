import {
  buildCalendar,
  CalendarEvent,
  escapeText,
  foldLine,
  formatIcsUtc,
} from './ics';

const FIXED_NOW = new Date('2026-06-01T12:00:00.000Z');

const event = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  uid: 'd1-bridging-the-gap@startfest',
  title: 'Bridging the Gap',
  startUtc: '2026-06-23T16:30:00.000Z',
  endUtc: '2026-06-23T17:05:00.000Z',
  ...overrides,
});

const linesOf = (ics: string) => ics.split('\r\n');

describe('escapeText', () => {
  it('escapes backslash, semicolon and comma', () => {
    expect(escapeText('a\\b;c,d')).toBe('a\\\\b\\;c\\,d');
  });

  it('escapes backslashes before the sequences it introduces', () => {
    // A literal backslash followed by a comma must not become an escaped comma.
    expect(escapeText('\\,')).toBe('\\\\\\,');
  });

  it('converts newlines to the literal \\n sequence', () => {
    expect(escapeText('line one\nline two')).toBe('line one\\nline two');
    expect(escapeText('crlf\r\nhere')).toBe('crlf\\nhere');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeText('Bridging the Gap')).toBe('Bridging the Gap');
  });
});

describe('foldLine', () => {
  it('leaves a short line alone', () => {
    expect(foldLine('SUMMARY:Short')).toBe('SUMMARY:Short');
  });

  it('leaves a line of exactly 75 octets alone', () => {
    const line = 'X'.repeat(75);
    expect(foldLine(line)).toBe(line);
  });

  it('folds a long line with a leading space on continuations', () => {
    const folded = foldLine('X'.repeat(200));
    const parts = folded.split('\r\n');

    expect(parts.length).toBeGreaterThan(1);
    expect(Buffer.from(parts[0], 'utf8').length).toBe(75);
    parts.slice(1).forEach((part) => {
      expect(part.startsWith(' ')).toBe(true);
      expect(Buffer.from(part, 'utf8').length).toBeLessThanOrEqual(75);
    });
  });

  it('reconstructs to the original when unfolded', () => {
    const original = 'DESCRIPTION:' + 'abcdefghij'.repeat(30);
    const unfolded = foldLine(original).split('\r\n ').join('');
    expect(unfolded).toBe(original);
  });

  it('never splits a multi-byte character across a fold', () => {
    // 'é' is two octets; a naive 75-character cut would land mid-character.
    const folded = foldLine('SUMMARY:' + 'é'.repeat(100));
    folded.split('\r\n').forEach((part) => {
      expect(part).not.toContain('�');
      expect(Buffer.from(part, 'utf8').length).toBeLessThanOrEqual(75);
    });
    expect(folded.split('\r\n ').join('')).toBe('SUMMARY:' + 'é'.repeat(100));
  });
});

describe('formatIcsUtc', () => {
  it('formats a UTC instant in basic date-time form', () => {
    expect(formatIcsUtc('2026-06-23T16:30:00.000Z')).toBe('20260623T163000Z');
  });

  it('normalises an offset instant to UTC', () => {
    expect(formatIcsUtc('2026-06-23T10:30:00-06:00')).toBe('20260623T163000Z');
  });

  it('rejects a naive local time rather than guessing a zone', () => {
    expect(() => formatIcsUtc('2026-06-23T10:30:00')).toThrow(/missing a UTC offset/);
  });
});

describe('buildCalendar', () => {
  it('wraps events in a valid VCALENDAR envelope', () => {
    const lines = linesOf(buildCalendar([event()], { now: FIXED_NOW }));

    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines).toContain('CALSCALE:GREGORIAN');
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(lines.filter((l) => l === 'END:VEVENT')).toHaveLength(1);
    expect(lines[lines.length - 2]).toBe('END:VCALENDAR');
  });

  it('terminates every line with CRLF, including the last', () => {
    const ics = buildCalendar([event()], { now: FIXED_NOW });
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it('emits DTSTART and DTEND as UTC instants', () => {
    const lines = linesOf(buildCalendar([event()], { now: FIXED_NOW }));
    expect(lines).toContain('DTSTART:20260623T163000Z');
    expect(lines).toContain('DTEND:20260623T170500Z');
  });

  it('uses the injected clock for DTSTAMP so output is deterministic', () => {
    const lines = linesOf(buildCalendar([event()], { now: FIXED_NOW }));
    expect(lines).toContain('DTSTAMP:20260601T120000Z');
  });

  it('escapes special characters in the summary', () => {
    const ics = buildCalendar(
      [event({ title: 'Growth: Podcasts, Conferences; and more' })],
      { now: FIXED_NOW },
    );
    expect(ics).toContain('SUMMARY:Growth: Podcasts\\, Conferences\\; and more');
  });

  it('omits LOCATION and DESCRIPTION when not supplied', () => {
    const ics = buildCalendar([event()], { now: FIXED_NOW });
    expect(ics).not.toContain('LOCATION:');
    expect(ics).not.toContain('DESCRIPTION:');
  });

  it('includes LOCATION and DESCRIPTION when supplied', () => {
    const ics = buildCalendar(
      [event({ location: 'Start Room', description: 'Scott Holley' })],
      { now: FIXED_NOW },
    );
    expect(ics).toContain('LOCATION:Start Room');
    expect(ics).toContain('DESCRIPTION:Scott Holley');
  });

  it('adds a VALARM only when a reminder is requested', () => {
    const without = buildCalendar([event()], { now: FIXED_NOW });
    expect(without).not.toContain('BEGIN:VALARM');

    const withAlarm = buildCalendar([event()], {
      now: FIXED_NOW,
      reminderMinutes: 10,
    });
    expect(withAlarm).toContain('BEGIN:VALARM');
    expect(withAlarm).toContain('TRIGGER:-PT10M');
  });

  it('produces one VEVENT per session', () => {
    const ics = buildCalendar(
      [event({ uid: 'a' }), event({ uid: 'b' }), event({ uid: 'c' })],
      { now: FIXED_NOW },
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  });

  it('produces a valid empty calendar for an empty schedule', () => {
    const lines = linesOf(buildCalendar([], { now: FIXED_NOW }));
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).not.toContain('BEGIN:VEVENT');
    expect(lines[lines.length - 2]).toBe('END:VCALENDAR');
  });

  it('folds an over-long summary rather than emitting an invalid line', () => {
    const ics = buildCalendar([event({ title: 'Very Long Title '.repeat(20) })], {
      now: FIXED_NOW,
    });

    linesOf(ics)
      .filter((line) => line.length > 0)
      .forEach((line) => {
        expect(Buffer.from(line, 'utf8').length).toBeLessThanOrEqual(75);
      });
  });
});
