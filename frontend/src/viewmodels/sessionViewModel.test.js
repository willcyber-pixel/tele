import { describe, expect, it } from 'vitest'

import { conflictsBySessionId } from '../domain/conflicts'
import {
  buildConflictItems,
  buildScheduleItems,
  buildSessionCardModel,
  initialsOf,
  MAX_VISIBLE_AVATARS,
  orderRoster,
  toAvatarPerson,
} from './sessionViewModel'

const ME = 'me'

const session = (over = {}) => ({
  id: 's1',
  day: 1,
  title: 'Bridging the Gap',
  description: null,
  startUtc: '2026-06-23T16:30:00.000Z',
  endUtc: '2026-06-23T17:05:00.000Z',
  room: 'start',
  track: 'funding',
  kind: 'session',
  speakers: [{ name: 'Scott Holley', title: 'Executive Director' }],
  ...over,
})

const context = (over = {}) => ({
  timeZone: 'America/Denver',
  selectedIds: [],
  pendingIds: [],
  conflictIndex: new Map(),
  attendeesBySession: {},
  currentAttendeeId: ME,
  ...over,
})

const person = (id, name) => ({ id, name, title: null, company: null })

describe('initialsOf', () => {
  it('takes first and last initials', () => {
    expect(initialsOf('Avery Chen')).toBe('AC')
  })

  it('handles a three-part name', () => {
    expect(initialsOf('Nicole Toomey Davis')).toBe('ND')
  })

  it('handles a single name', () => {
    expect(initialsOf('Cher')).toBe('CH')
  })

  it('handles stray whitespace', () => {
    expect(initialsOf('  Avery   Chen  ')).toBe('AC')
  })

  it('falls back for an empty name', () => {
    expect(initialsOf('   ')).toBe('?')
  })
})

describe('toAvatarPerson', () => {
  it('labels the current user as You', () => {
    const avatar = toAvatarPerson(person(ME, 'You'), ME)
    expect(avatar.isYou).toBe(true)
    expect(avatar.initials).toBe('You')
  })

  it('gives another attendee their initials', () => {
    expect(toAvatarPerson(person('a-avery', 'Avery Chen'), ME).initials).toBe('AC')
  })

  it('assigns the same colour to the same id every time', () => {
    const first = toAvatarPerson(person('a-avery', 'Avery Chen'), ME)
    const second = toAvatarPerson(person('a-avery', 'Avery Chen'), ME)
    expect(first.color).toBe(second.color)
  })

  it('builds a label from title and company', () => {
    const avatar = toAvatarPerson(
      { id: 'a-dana', name: 'Dana Whitfield', title: 'VP Engineering', company: 'MX' },
      ME,
    )
    expect(avatar.label).toBe('Dana Whitfield — VP Engineering, MX')
    expect(avatar.subtitle).toBe('VP Engineering, MX')
  })

  it('omits the subtitle when there is no title or company', () => {
    expect(toAvatarPerson(person('a-x', 'No Title'), ME).subtitle).toBeNull()
  })
})

describe('orderRoster', () => {
  it('puts the current user first', () => {
    const ordered = orderRoster(
      [person('a-zoe', 'Zoe Adams'), person(ME, 'You'), person('a-avery', 'Avery Chen')],
      ME,
    )
    expect(ordered[0].id).toBe(ME)
  })

  it('sorts everyone else by name', () => {
    const ordered = orderRoster(
      [person('a-zoe', 'Zoe Adams'), person('a-avery', 'Avery Chen')],
      ME,
    )
    expect(ordered.map((p) => p.name)).toEqual(['Avery Chen', 'Zoe Adams'])
  })

  it('does not mutate the input', () => {
    const input = [person('a-zoe', 'Zoe Adams'), person('a-avery', 'Avery Chen')]
    orderRoster(input, ME)
    expect(input[0].id).toBe('a-zoe')
  })
})

describe('buildSessionCardModel', () => {
  it('formats the time range in the given zone', () => {
    const model = buildSessionCardModel(session(), context())
    expect(model.timeRange).toBe('10:30 AM – 11:05 AM')
  })

  it('formats in the viewer zone when asked', () => {
    const model = buildSessionCardModel(session(), context({ timeZone: 'UTC' }))
    expect(model.timeRange).toBe('4:30 PM – 5:05 PM')
  })

  it('resolves the track colour and label', () => {
    expect(buildSessionCardModel(session(), context()).track.label).toBe('Funding')
  })

  it('falls back to a neutral track for an untracked item', () => {
    const model = buildSessionCardModel(session({ track: null }), context())
    expect(model.track.label).toBe('')
  })

  it('reflects selection and pending state', () => {
    const model = buildSessionCardModel(
      session(),
      context({ selectedIds: ['s1'], pendingIds: ['s1'] }),
    )
    expect(model.selected).toBe(true)
    expect(model.pending).toBe(true)
  })

  it('surfaces a conflict severity', () => {
    const index = conflictsBySessionId([
      { aId: 's1', bId: 's2', severity: 'overlap', overlapMinutes: 35, gapMinutes: -35 },
    ])
    expect(buildSessionCardModel(session(), context({ conflictIndex: index })).conflict).toBe(
      'overlap',
    )
  })

  it('never marks a break as conflicting', () => {
    const index = conflictsBySessionId([
      { aId: 's1', bId: 's2', severity: 'overlap', overlapMinutes: 35, gapMinutes: -35 },
    ])
    const model = buildSessionCardModel(
      session({ kind: 'break' }),
      context({ conflictIndex: index }),
    )
    expect(model.conflict).toBeNull()
  })

  it('caps visible avatars and reports the overflow', () => {
    const roster = Array.from({ length: 7 }, (_, i) => person(`a-${i}`, `Person ${i}`))
    const model = buildSessionCardModel(
      session(),
      context({ attendeesBySession: { s1: roster } }),
    )

    expect(model.avatars).toHaveLength(MAX_VISIBLE_AVATARS)
    expect(model.avatarOverflow).toBe(7 - MAX_VISIBLE_AVATARS)
    expect(model.roster).toHaveLength(7)
  })

  it('reports no overflow when the roster fits', () => {
    const model = buildSessionCardModel(
      session(),
      context({ attendeesBySession: { s1: [person('a-1', 'One Person')] } }),
    )
    expect(model.avatarOverflow).toBe(0)
  })

  it('handles a session with no roster loaded yet', () => {
    const model = buildSessionCardModel(session(), context())
    expect(model.avatars).toEqual([])
    expect(model.avatarOverflow).toBe(0)
  })

  it('maps kinds to visual variants', () => {
    expect(buildSessionCardModel(session(), context()).variant).toBe('session')
    expect(buildSessionCardModel(session({ kind: 'break' }), context()).variant).toBe('break')
    expect(buildSessionCardModel(session({ kind: 'keynote' }), context()).variant).toBe('mainstage')
    expect(buildSessionCardModel(session({ kind: 'special' }), context()).variant).toBe('special')
  })
})

describe('buildScheduleItems', () => {
  it('maps picks to panel rows with room labels', () => {
    const items = buildScheduleItems([session()], {
      timeZone: 'America/Denver',
      conflictIndex: new Map(),
      roomLabels: { start: 'Start Room' },
    })

    expect(items[0]).toMatchObject({
      id: 's1',
      title: 'Bridging the Gap',
      room: 'Start Room',
      timeRange: '10:30 AM – 11:05 AM',
      conflict: null,
    })
  })

  it('falls back to the raw room id when unlabelled', () => {
    const items = buildScheduleItems([session({ room: 'mystery' })], {
      timeZone: 'UTC',
      conflictIndex: new Map(),
      roomLabels: {},
    })
    expect(items[0].room).toBe('mystery')
  })
})

describe('buildConflictItems', () => {
  const sessionsById = {
    a: { id: 'a', title: 'Bridging the Gap' },
    b: { id: 'b', title: 'AI Blueprint Workshop' },
  }

  it('describes an overlap in human terms', () => {
    const items = buildConflictItems(
      [{ aId: 'a', bId: 'b', severity: 'overlap', overlapMinutes: 35, gapMinutes: -35 }],
      sessionsById,
    )

    expect(items[0]).toMatchObject({
      aTitle: 'Bridging the Gap',
      bTitle: 'AI Blueprint Workshop',
      severity: 'overlap',
      detail: 'overlaps by 35 min',
    })
  })

  it('describes a tight transition', () => {
    const items = buildConflictItems(
      [{ aId: 'a', bId: 'b', severity: 'tight', overlapMinutes: 0, gapMinutes: 5 }],
      sessionsById,
    )
    expect(items[0].detail).toBe('only 5 min between rooms')
  })

  it('falls back to the id when a session is unknown', () => {
    const items = buildConflictItems(
      [{ aId: 'ghost', bId: 'b', severity: 'overlap', overlapMinutes: 10, gapMinutes: -10 }],
      sessionsById,
    )
    expect(items[0].aTitle).toBe('ghost')
  })
})
