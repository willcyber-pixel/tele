import { describe, expect, it } from 'vitest'

import {
  initialScheduleState,
  scheduleEvents,
  scheduleReducer,
  selectCount,
  selectIsPending,
  selectIsSelected,
  selectPickedSessions,
} from './scheduleBloc'

const reduce = (events, from = initialScheduleState) =>
  events.reduce(scheduleReducer, from)

describe('scheduleReducer', () => {
  it('starts idle and empty', () => {
    expect(initialScheduleState.status).toBe('idle')
    expect(initialScheduleState.selectedIds).toEqual([])
  })

  it('ignores an unknown event', () => {
    const state = scheduleReducer(initialScheduleState, { type: 'nope' })
    expect(state).toBe(initialScheduleState)
  })

  it('marks loading then ready', () => {
    const loading = scheduleReducer(initialScheduleState, scheduleEvents.loadRequested())
    expect(loading.status).toBe('loading')

    const ready = scheduleReducer(loading, scheduleEvents.loadSucceeded(['a', 'b']))
    expect(ready.status).toBe('ready')
    expect(ready.selectedIds).toEqual(['a', 'b'])
  })

  it('records a load failure', () => {
    const state = reduce([
      scheduleEvents.loadRequested(),
      scheduleEvents.loadFailed('offline'),
    ])

    expect(state.status).toBe('error')
    expect(state.error).toBe('offline')
  })

  it('selects optimistically before the server replies', () => {
    const state = scheduleReducer(initialScheduleState, scheduleEvents.toggleRequested('a'))

    expect(state.selectedIds).toEqual(['a'])
    expect(state.pendingIds).toEqual(['a'])
  })

  it('deselects optimistically', () => {
    const state = reduce([
      scheduleEvents.loadSucceeded(['a']),
      scheduleEvents.toggleRequested('a'),
    ])

    expect(state.selectedIds).toEqual([])
    expect(state.pendingIds).toEqual(['a'])
  })

  it('reconciles against the server list on success', () => {
    const state = reduce([
      scheduleEvents.toggleRequested('a'),
      // Server says the schedule is actually a and b -- trust it over the guess.
      scheduleEvents.toggleSucceeded('a', ['a', 'b']),
    ])

    expect(state.selectedIds).toEqual(['a', 'b'])
    expect(state.pendingIds).toEqual([])
    expect(state.status).toBe('ready')
  })

  it('rolls the optimistic add back when the request fails', () => {
    const state = reduce([
      scheduleEvents.toggleRequested('a'),
      scheduleEvents.toggleFailed('a', 'boom'),
    ])

    expect(state.selectedIds).toEqual([])
    expect(state.pendingIds).toEqual([])
    expect(state.error).toBe('boom')
  })

  it('rolls the optimistic removal back when the request fails', () => {
    const state = reduce([
      scheduleEvents.loadSucceeded(['a']),
      scheduleEvents.toggleRequested('a'),
      scheduleEvents.toggleFailed('a', 'boom'),
    ])

    expect(state.selectedIds).toEqual(['a'])
    expect(state.error).toBe('boom')
  })

  it('tracks several in-flight toggles independently', () => {
    const state = reduce([
      scheduleEvents.toggleRequested('a'),
      scheduleEvents.toggleRequested('b'),
      scheduleEvents.toggleSucceeded('a', ['a', 'b']),
    ])

    expect(state.pendingIds).toEqual(['b'])
  })

  it('never duplicates an id when the same toggle arrives twice', () => {
    const state = reduce([
      scheduleEvents.toggleSucceeded('a', ['a']),
      scheduleEvents.toggleSucceeded('a', ['a']),
    ])

    expect(state.selectedIds).toEqual(['a'])
  })

  it('clears the selection', () => {
    const state = reduce([
      scheduleEvents.loadSucceeded(['a', 'b']),
      scheduleEvents.cleared(),
    ])

    expect(state.selectedIds).toEqual([])
  })

  it('does not mutate the previous state', () => {
    const before = scheduleReducer(initialScheduleState, scheduleEvents.loadSucceeded(['a']))
    const snapshot = JSON.stringify(before)

    scheduleReducer(before, scheduleEvents.toggleRequested('b'))
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('clears a stale error when a new toggle begins', () => {
    const state = reduce([
      scheduleEvents.toggleRequested('a'),
      scheduleEvents.toggleFailed('a', 'boom'),
      scheduleEvents.toggleRequested('b'),
    ])

    expect(state.error).toBeNull()
  })
})

describe('schedule selectors', () => {
  const state = scheduleReducer(
    initialScheduleState,
    scheduleEvents.loadSucceeded(['b', 'a']),
  )

  it('reports selection', () => {
    expect(selectIsSelected(state, 'a')).toBe(true)
    expect(selectIsSelected(state, 'z')).toBe(false)
  })

  it('reports pending state', () => {
    const pending = scheduleReducer(state, scheduleEvents.toggleRequested('c'))
    expect(selectIsPending(pending, 'c')).toBe(true)
    expect(selectIsPending(pending, 'a')).toBe(false)
  })

  it('counts picks', () => {
    expect(selectCount(state)).toBe(2)
  })

  it('hydrates picks into chronological sessions', () => {
    const all = [
      { id: 'a', startUtc: '2026-06-23T18:00:00Z' },
      { id: 'b', startUtc: '2026-06-23T16:00:00Z' },
      { id: 'c', startUtc: '2026-06-23T17:00:00Z' },
    ]

    expect(selectPickedSessions(state, all).map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('ignores picked ids with no matching session', () => {
    expect(selectPickedSessions(state, [{ id: 'a', startUtc: '2026-06-23T18:00:00Z' }])).toHaveLength(1)
  })
})
