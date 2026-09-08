import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'

import { agendaRepository as defaultRepository } from '../../data/agendaRepository'
import { EVENT_TIME_ZONE, viewerTimeZone } from '../../domain/time'
import {
  agendaEvents,
  agendaReducer,
  initialAgendaState,
  selectDays,
  selectSessionsForActiveDay,
} from './agendaBloc'

const AgendaContext = createContext(null)

/**
 * Wires the agenda reducer to its side effects.
 *
 * The repository is injected so tests can supply a stub without touching
 * fetch or the network. This component renders nothing of its own -- it is
 * plumbing, not presentation.
 */
export function AgendaProvider({ children, repository = defaultRepository }) {
  const [state, dispatch] = useReducer(agendaReducer, initialAgendaState)

  useEffect(() => {
    let cancelled = false

    async function load() {
      dispatch(agendaEvents.loadRequested())
      try {
        const sessions = await repository.listSessions()
        if (cancelled) return
        dispatch(agendaEvents.loadSucceeded(sessions))

        // Rosters are fetched in one batch after the agenda paints, so the
        // grid is interactive before the avatars arrive.
        const rosters = await repository.listAttendeesBySession(
          sessions.map((s) => s.id),
        )
        if (cancelled) return
        dispatch(agendaEvents.rostersLoaded(rosters))
      } catch (error) {
        if (!cancelled) dispatch(agendaEvents.loadFailed(error.message))
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [repository])

  const refreshRosters = useCallback(
    async (sessionIds) => {
      try {
        const rosters = await repository.listAttendeesBySession(sessionIds)
        dispatch(agendaEvents.rostersLoaded(rosters))
      } catch {
        // A stale avatar stack is not worth surfacing as an error.
      }
    },
    [repository],
  )

  const value = useMemo(() => {
    const timeZone =
      state.timeZoneMode === 'event' ? EVENT_TIME_ZONE : viewerTimeZone()

    return {
      state,
      days: selectDays(state),
      daySessions: selectSessionsForActiveDay(state),
      timeZone,
      selectDay: (day) => dispatch(agendaEvents.daySelected(day)),
      toggleTimeZone: () => dispatch(agendaEvents.timeZoneToggled()),
      focusSession: (sessionId) => dispatch(agendaEvents.sessionFocused(sessionId)),
      refreshRosters,
    }
  }, [state, refreshRosters])

  return <AgendaContext.Provider value={value}>{children}</AgendaContext.Provider>
}

export function useAgenda() {
  const context = useContext(AgendaContext)
  if (!context) {
    throw new Error('useAgenda must be used within an AgendaProvider')
  }
  return context
}
