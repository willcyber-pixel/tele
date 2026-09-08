import { severityFor } from '../domain/conflicts'
import { formatDuration, formatTimeRange } from '../domain/time'
import { trackFor } from '../domain/tracks'

/**
 * View models: the seam between domain data and presentation.
 *
 * Everything a component needs is computed here -- formatted times, resolved
 * colours, initials, conflict severity, avatar overflow -- so components stay
 * pure renderers. All pure functions, all directly testable.
 */

/** How many faces fit on a card before collapsing into a +N chip. */
export const MAX_VISIBLE_AVATARS = 3

const AVATAR_PALETTE = [
  { color: '#c6f24e', ink: '#1e2b00' },
  { color: '#2fd6a6', ink: '#00312a' },
  { color: '#6cd8f5', ink: '#00303d' },
  { color: '#a98bff', ink: '#1c0d47' },
  { color: '#e879c8', ink: '#3d0030' },
  { color: '#4d94ff', ink: '#001f4d' },
  { color: '#ffb703', ink: '#3d2500' },
  { color: '#ff8fa3', ink: '#4d0016' },
]

function hashString(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** First letter of the first and last word, e.g. "Avery Chen" -> "AC". */
export function initialsOf(name) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/**
 * Turn an attendee into an avatar view model. The colour is hashed from the
 * id so a given person is the same colour everywhere, on every reload.
 */
export function toAvatarPerson(attendee, currentAttendeeId) {
  const isYou = attendee.id === currentAttendeeId
  const swatch = AVATAR_PALETTE[hashString(attendee.id) % AVATAR_PALETTE.length]
  const subtitle = [attendee.title, attendee.company].filter(Boolean).join(', ')

  return {
    id: attendee.id,
    name: isYou ? 'You' : attendee.name,
    subtitle: subtitle || null,
    initials: isYou ? 'You' : initialsOf(attendee.name),
    color: isYou ? '#ffffff' : swatch.color,
    ink: isYou ? '#0b1622' : swatch.ink,
    label: subtitle ? `${attendee.name} — ${subtitle}` : attendee.name,
    isYou,
  }
}

/**
 * Order the roster so the current user comes first, then everyone else by
 * name -- a stable order, so avatars do not reshuffle between renders.
 */
export function orderRoster(attendees, currentAttendeeId) {
  return [...attendees].sort((a, b) => {
    if (a.id === currentAttendeeId) return -1
    if (b.id === currentAttendeeId) return 1
    return a.name.localeCompare(b.name)
  })
}

function variantFor(session) {
  if (session.kind === 'break') return 'break'
  if (session.kind === 'keynote' || session.kind === 'mainstage') return 'mainstage'
  if (session.kind === 'special') return 'special'
  return 'session'
}

/** Build the complete view model for one session card. */
export function buildSessionCardModel(session, context) {
  const {
    timeZone,
    selectedIds,
    pendingIds,
    conflictIndex,
    attendeesBySession,
    currentAttendeeId,
  } = context

  const roster = orderRoster(
    attendeesBySession[session.id] ?? [],
    currentAttendeeId,
  ).map((person) => toAvatarPerson(person, currentAttendeeId))

  const isInteractive = session.kind !== 'break'

  return {
    id: session.id,
    title: session.title,
    description: session.description ?? null,
    speakers: session.speakers ?? [],
    timeRange: formatTimeRange(session.startUtc, session.endUtc, timeZone),
    track: trackFor(session.track),
    variant: variantFor(session),
    selected: selectedIds.includes(session.id),
    pending: pendingIds.includes(session.id),
    conflict: isInteractive ? severityFor(session.id, conflictIndex) : null,
    avatars: roster.slice(0, MAX_VISIBLE_AVATARS),
    avatarOverflow: Math.max(roster.length - MAX_VISIBLE_AVATARS, 0),
    roster,
  }
}

/** Build the ordered list shown in the "my schedule" side panel. */
export function buildScheduleItems(pickedSessions, context) {
  const { timeZone, conflictIndex, roomLabels } = context

  return pickedSessions.map((session) => ({
    id: session.id,
    title: session.title,
    room: roomLabels[session.room] ?? session.room,
    timeRange: formatTimeRange(session.startUtc, session.endUtc, timeZone),
    conflict: severityFor(session.id, conflictIndex),
  }))
}

/** Build the rows for the conflict banner. */
export function buildConflictItems(conflicts, sessionsById) {
  return conflicts.map((conflict) => {
    const detail =
      conflict.severity === 'overlap'
        ? `overlaps by ${formatDuration(conflict.overlapMinutes)}`
        : `only ${formatDuration(conflict.gapMinutes)} between rooms`

    return {
      key: `${conflict.aId}|${conflict.bId}`,
      aId: conflict.aId,
      bId: conflict.bId,
      aTitle: sessionsById[conflict.aId]?.title ?? conflict.aId,
      bTitle: sessionsById[conflict.bId]?.title ?? conflict.bId,
      severity: conflict.severity,
      detail,
    }
  })
}

/** Time-gutter labels, formatted for display. */
export function buildTimeLabelModels(labels, timeZone) {
  return labels.map((label) => ({
    key: label.startUtc,
    rowStart: label.rowStart,
    start: formatTimeRange(label.startUtc, label.endUtc, timeZone).split(' – ')[0],
    end: formatTimeRange(label.startUtc, label.endUtc, timeZone).split(' – ')[1],
  }))
}
