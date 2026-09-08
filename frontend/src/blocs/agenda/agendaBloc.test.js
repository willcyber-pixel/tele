import { describe, expect, it } from 'vitest'

import {
  agendaEvents,
  agendaReducer,
  initialAgendaState,
  selectAttendeesFor,
  selectDays,
  selectIsReady,
  selectSessionsForActiveDay,
} from './agendaBloc'

const sessions = [
  { id: 'a', day: 1, startUtc: '2026-06-23T16:00:00Z' },
  { id: 'b', day: 1, startUtc: '2026-06-23T17:00:00Z' },
  { id: 'c', day: 2, startUtc: '2026-06-24T16:00:00Z' },
]

const reduce = (events, from = initialAgendaState) => events.reduce(agendaReducer, from)

describe('agendaReducer', () => {
  it('starts idle', () => {
    expect(initialAgendaState.status).toBe('idle')
    expect(initialAgendaState.activeDay).toBe(1)
  })

  it('ignores an unknown event', () => {
    expect(agendaReducer(initialAgendaState, { type: 'nope' })).toBe(initialAgendaState)
  })

  it('moves through loading to ready', () => {
    const state = reduce([
      agendaEvents.loadRequested(),
      agendaEvents.loadSucceeded(sessions),
    ])

    expect(state.status).toBe('ready')
    expect(state.sessions).toHaveLength(3)
  })

  it('records a load failure', () => {
    const state = reduce([agendaEvents.loadRequested(), agendaEvents.loadFailed('down')])

    expect(state.status).toBe('error')
    expect(state.error).toBe('down')
  })

  it('clears a previous error when reloading', () => {
    const state = reduce([
      agendaEvents.loadFailed('down'),
      agendaEvents.loadRequested(),
    ])

    expect(state.error).toBeNull()
  })

  it('keeps the active day when it still exists after a reload', () => {
    const state = reduce([
      agendaEvents.loadSucceeded(sessions),
      agendaEvents.daySelected(2),
      agendaEvents.loadSucceeded(sessions),
    ])

    expect(state.activeDay).toBe(2)
  })

  it('falls back to the first day when the active one disappears', () => {
    const state = reduce([
      agendaEvents.loadSucceeded(sessions),
      agendaEvents.daySelected(2),
      agendaEvents.loadSucceeded([sessions[0]]),
    ])

    expect(state.activeDay).toBe(1)
  })

  it('switches day', () => {
    const state = reduce([agendaEvents.loadSucceeded(sessions), agendaEvents.daySelected(2)])
    expect(state.activeDay).toBe(2)
  })

  it('returns the same object when selecting the day already active', () => {
    const ready = agendaReducer(initialAgendaState, agendaEvents.loadSucceeded(sessions))
    expect(agendaReducer(ready, agendaEvents.daySelected(1))).toBe(ready)
  })

  it('merges rosters without dropping earlier ones', () => {
    const state = reduce([
      agendaEvents.rostersLoaded({ a: [{ id: 'p1' }] }),
      agendaEvents.rostersLoaded({ b: [{ id: 'p2' }] }),
    ])

    expect(Object.keys(state.attendeesBySession).sort()).toEqual(['a', 'b'])
  })

  it('overwrites a roster for a session that reloads', () => {
    const state = reduce([
      agendaEvents.rostersLoaded({ a: [{ id: 'p1' }] }),
      agendaEvents.rostersLoaded({ a: [{ id: 'p1' }, { id: 'p2' }] }),
    ])

    expect(state.attendeesBySession.a).toHaveLength(2)
  })

  it('toggles the timezone mode back and forth', () => {
    const once = agendaReducer(initialAgendaState, agendaEvents.timeZoneToggled())
    expect(once.timeZoneMode).toBe('viewer')

    expect(agendaReducer(once, agendaEvents.timeZoneToggled()).timeZoneMode).toBe('event')
  })

  it('tracks the focused session', () => {
    const state = agendaReducer(initialAgendaState, agendaEvents.sessionFocused('a'))
    expect(state.focusedSessionId).toBe('a')

    expect(agendaReducer(state, agendaEvents.sessionFocused(null)).focusedSessionId).toBeNull()
  })

  it('does not mutate the previous state', () => {
    const before = agendaReducer(initialAgendaState, agendaEvents.loadSucceeded(sessions))
    const snapshot = JSON.stringify(before)

    agendaReducer(before, agendaEvents.daySelected(2))
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

describe('agenda selectors', () => {
  const ready = agendaReducer(initialAgendaState, agendaEvents.loadSucceeded(sessions))

  it('lists the distinct days in order', () => {
    expect(selectDays(ready)).toEqual([1, 2])
  })

  it('returns only the active day’s sessions', () => {
    expect(selectSessionsForActiveDay(ready).map((s) => s.id)).toEqual(['a', 'b'])

    const day2 = agendaReducer(ready, agendaEvents.daySelected(2))
    expect(selectSessionsForActiveDay(day2).map((s) => s.id)).toEqual(['c'])
  })

  it('returns an empty roster for a session with none loaded', () => {
    expect(selectAttendeesFor(ready, 'a')).toEqual([])
  })

  it('reports readiness', () => {
    expect(selectIsReady(ready)).toBe(true)
    expect(selectIsReady(initialAgendaState)).toBe(false)
  })
})
