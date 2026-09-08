/**
 * Agenda BLoC — events, state and reducer.
 *
 * Pure: no React, no fetch, no timers. The provider drives side effects and
 * feeds their outcome back in as events; every state transition in the app
 * happens in the reducer below, where it can be tested directly.
 */

export const AgendaEvent = Object.freeze({
  LoadRequested: 'agenda/loadRequested',
  LoadSucceeded: 'agenda/loadSucceeded',
  LoadFailed: 'agenda/loadFailed',
  RostersLoaded: 'agenda/rostersLoaded',
  DaySelected: 'agenda/daySelected',
  TimeZoneToggled: 'agenda/timeZoneToggled',
  SessionFocused: 'agenda/sessionFocused',
})

export const agendaEvents = {
  loadRequested: () => ({ type: AgendaEvent.LoadRequested }),
  loadSucceeded: (sessions) => ({ type: AgendaEvent.LoadSucceeded, sessions }),
  loadFailed: (error) => ({ type: AgendaEvent.LoadFailed, error }),
  rostersLoaded: (attendeesBySession) => ({
    type: AgendaEvent.RostersLoaded,
    attendeesBySession,
  }),
  daySelected: (day) => ({ type: AgendaEvent.DaySelected, day }),
  timeZoneToggled: () => ({ type: AgendaEvent.TimeZoneToggled }),
  sessionFocused: (sessionId) => ({ type: AgendaEvent.SessionFocused, sessionId }),
}

export const initialAgendaState = Object.freeze({
  status: 'idle', // idle | loading | ready | error
  sessions: [],
  attendeesBySession: {},
  activeDay: 1,
  /** 'event' shows Mountain Time as printed; 'viewer' shows the user's zone. */
  timeZoneMode: 'event',
  focusedSessionId: null,
  error: null,
})

export function agendaReducer(state, event) {
  switch (event.type) {
    case AgendaEvent.LoadRequested:
      return { ...state, status: 'loading', error: null }

    case AgendaEvent.LoadSucceeded: {
      const days = [...new Set(event.sessions.map((s) => s.day))].sort((a, b) => a - b)
      return {
        ...state,
        status: 'ready',
        sessions: event.sessions,
        error: null,
        // Keep the current day if it still exists, else fall back to the first.
        activeDay: days.includes(state.activeDay) ? state.activeDay : (days[0] ?? 1),
      }
    }

    case AgendaEvent.LoadFailed:
      return { ...state, status: 'error', error: event.error }

    case AgendaEvent.RostersLoaded:
      return {
        ...state,
        attendeesBySession: { ...state.attendeesBySession, ...event.attendeesBySession },
      }

    case AgendaEvent.DaySelected:
      return state.activeDay === event.day ? state : { ...state, activeDay: event.day }

    case AgendaEvent.TimeZoneToggled:
      return {
        ...state,
        timeZoneMode: state.timeZoneMode === 'event' ? 'viewer' : 'event',
      }

    case AgendaEvent.SessionFocused:
      return { ...state, focusedSessionId: event.sessionId }

    default:
      return state
  }
}

// --------------------------------------------------------------- selectors

export function selectDays(state) {
  return [...new Set(state.sessions.map((s) => s.day))].sort((a, b) => a - b)
}

export function selectSessionsForActiveDay(state) {
  return state.sessions.filter((s) => s.day === state.activeDay)
}

export function selectAttendeesFor(state, sessionId) {
  return state.attendeesBySession[sessionId] ?? []
}

export function selectIsReady(state) {
  return state.status === 'ready'
}
