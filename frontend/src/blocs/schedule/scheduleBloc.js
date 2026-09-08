/**
 * Schedule BLoC — events, state and reducer.
 *
 * Toggling is optimistic: the reducer flips the pick immediately so the grid
 * repaints on the same frame, records the session as in-flight, and rolls back
 * if the request fails. All of that lives here, not in a component.
 */

export const ScheduleEvent = Object.freeze({
  LoadRequested: 'schedule/loadRequested',
  LoadSucceeded: 'schedule/loadSucceeded',
  LoadFailed: 'schedule/loadFailed',
  ToggleRequested: 'schedule/toggleRequested',
  ToggleSucceeded: 'schedule/toggleSucceeded',
  ToggleFailed: 'schedule/toggleFailed',
  Cleared: 'schedule/cleared',
})

export const scheduleEvents = {
  loadRequested: () => ({ type: ScheduleEvent.LoadRequested }),
  loadSucceeded: (sessionIds) => ({ type: ScheduleEvent.LoadSucceeded, sessionIds }),
  loadFailed: (error) => ({ type: ScheduleEvent.LoadFailed, error }),
  toggleRequested: (sessionId) => ({ type: ScheduleEvent.ToggleRequested, sessionId }),
  toggleSucceeded: (sessionId, sessionIds) => ({
    type: ScheduleEvent.ToggleSucceeded,
    sessionId,
    sessionIds,
  }),
  toggleFailed: (sessionId, error) => ({
    type: ScheduleEvent.ToggleFailed,
    sessionId,
    error,
  }),
  cleared: () => ({ type: ScheduleEvent.Cleared }),
}

export const initialScheduleState = Object.freeze({
  status: 'idle', // idle | loading | ready | error
  selectedIds: [],
  /** Sessions with a request in flight, so cards can show a busy state. */
  pendingIds: [],
  error: null,
})

const without = (list, value) => list.filter((item) => item !== value)
const withValue = (list, value) => (list.includes(value) ? list : [...list, value])

export function scheduleReducer(state, event) {
  switch (event.type) {
    case ScheduleEvent.LoadRequested:
      return { ...state, status: 'loading', error: null }

    case ScheduleEvent.LoadSucceeded:
      return {
        ...state,
        status: 'ready',
        selectedIds: [...event.sessionIds],
        error: null,
      }

    case ScheduleEvent.LoadFailed:
      return { ...state, status: 'error', error: event.error }

    case ScheduleEvent.ToggleRequested: {
      const isSelected = state.selectedIds.includes(event.sessionId)
      return {
        ...state,
        // Optimistic flip -- the grid updates before the server answers.
        selectedIds: isSelected
          ? without(state.selectedIds, event.sessionId)
          : withValue(state.selectedIds, event.sessionId),
        pendingIds: withValue(state.pendingIds, event.sessionId),
        error: null,
      }
    }

    case ScheduleEvent.ToggleSucceeded:
      return {
        ...state,
        status: 'ready',
        // Reconcile against the server's list rather than trusting the guess.
        selectedIds: [...event.sessionIds],
        pendingIds: without(state.pendingIds, event.sessionId),
      }

    case ScheduleEvent.ToggleFailed: {
      const isSelected = state.selectedIds.includes(event.sessionId)
      return {
        ...state,
        // Roll the optimistic flip back.
        selectedIds: isSelected
          ? without(state.selectedIds, event.sessionId)
          : withValue(state.selectedIds, event.sessionId),
        pendingIds: without(state.pendingIds, event.sessionId),
        error: event.error,
      }
    }

    case ScheduleEvent.Cleared:
      return { ...state, selectedIds: [], pendingIds: [] }

    default:
      return state
  }
}

// --------------------------------------------------------------- selectors

export function selectIsSelected(state, sessionId) {
  return state.selectedIds.includes(sessionId)
}

export function selectIsPending(state, sessionId) {
  return state.pendingIds.includes(sessionId)
}

export function selectCount(state) {
  return state.selectedIds.length
}

/** Hydrate the picked ids into full session objects, in chronological order. */
export function selectPickedSessions(state, allSessions) {
  const picked = new Set(state.selectedIds)
  return allSessions
    .filter((s) => picked.has(s.id))
    .slice()
    .sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc))
}
