import { describe, expect, it } from 'vitest';

import {
  durationMinutes,
  EVENT_TIME_ZONE,
  formatDayLabel,
  formatDuration,
  formatTime,
  formatTimeRange,
  toEpochMs,
} from './time';

describe('toEpochMs', () => {
  it('parses a UTC instant', () => {
    expect(toEpochMs('2026-06-23T16:30:00.000Z')).toBe(Date.UTC(2026, 5, 23, 16, 30));
  });

  it('parses an offset instant to the same moment', () => {
    expect(toEpochMs('2026-06-23T10:30:00-06:00')).toBe(toEpochMs('2026-06-23T16:30:00Z'));
  });

  it('rejects a naive local time rather than guessing a zone', () => {
    expect(() => toEpochMs('2026-06-23T10:30:00')).toThrow(/missing a UTC offset/);
  });

  it('rejects unparseable input', () => {
    expect(() => toEpochMs('not-a-date-Z')).toThrow();
    expect(() => toEpochMs('')).toThrow();
    expect(() => toEpochMs(null)).toThrow();
  });
});

describe('durationMinutes', () => {
  it('measures a session length', () => {
    expect(durationMinutes('2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z')).toBe(35);
  });

  it('is zero for a zero-length span', () => {
    expect(durationMinutes('2026-06-23T16:30:00Z', '2026-06-23T16:30:00Z')).toBe(0);
  });
});

describe('formatTime', () => {
  it('renders in the event zone by default', () => {
    // 16:30Z is 10:30 AM in Mountain Daylight Time.
    expect(formatTime('2026-06-23T16:30:00Z')).toBe('10:30 AM');
  });

  it('renders in an explicit zone when asked', () => {
    expect(formatTime('2026-06-23T16:30:00Z', 'UTC')).toBe('4:30 PM');
  });

  it('handles midnight and noon', () => {
    expect(formatTime('2026-06-23T12:00:00Z', 'UTC')).toBe('12:00 PM');
    expect(formatTime('2026-06-23T00:00:00Z', 'UTC')).toBe('12:00 AM');
  });
});

describe('formatTimeRange', () => {
  it('joins start and end', () => {
    expect(formatTimeRange('2026-06-23T16:30:00Z', '2026-06-23T17:05:00Z')).toBe(
      '10:30 AM – 11:05 AM',
    );
  });
});

describe('formatDayLabel', () => {
  it('renders the weekday and date in the event zone', () => {
    expect(formatDayLabel('2026-06-23T16:30:00Z')).toBe('Tuesday, June 23, 2026');
  });

  it('uses the event zone rather than UTC at day edges', () => {
    // 02:00Z on the 24th is still the evening of the 23rd in Denver.
    expect(formatDayLabel('2026-06-24T02:00:00Z', EVENT_TIME_ZONE)).toContain('June 23');
  });
});

describe('formatDuration', () => {
  it('renders sub-hour durations in minutes', () => {
    expect(formatDuration(35)).toBe('35 min');
  });

  it('renders whole hours', () => {
    expect(formatDuration(120)).toBe('2 hr');
  });

  it('renders mixed hours and minutes', () => {
    expect(formatDuration(95)).toBe('1 hr 35 min');
  });

  it('rounds fractional minutes', () => {
    expect(formatDuration(34.6)).toBe('35 min');
  });
});
