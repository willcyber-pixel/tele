import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'

import { scheduleRepository as defaultRepository } from '../../data/scheduleRepository'
import {
  initialScheduleState,
  scheduleEvents,
  scheduleReducer,
  selectCount,
} from './scheduleBloc'

const ScheduleContext = createContext(null)

/** No auth in the POC; this is the stand-in for the signed-in user. */
export const CURRENT_ATTENDEE_ID = 'me'

export function ScheduleProvider({
  children,
  repository = defaultRepository,
  attendeeId = CURRENT_ATTENDEE_ID,
  onScheduleChanged,
}) {
  const [state, dispatch] = useReducer(scheduleReducer, initialScheduleState)

  useEffect(() => {
    let cancelled = false

    async function load() {
      dispatch(scheduleEvents.loadRequested())
      try {
        const sessions = await repository.list(attendeeId)
        if (!cancelled) {
          dispatch(scheduleEvents.loadSucceeded(sessions.map((s) => s.id)))
        }
      } catch (error) {
        if (!cancelled) dispatch(scheduleEvents.loadFailed(error.message))
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [repository, attendeeId])

  const toggle = useCallback(
    async (sessionId) => {
      // Read before dispatching: the optimistic flip changes the answer.
      const wasSelected = state.selectedIds.includes(sessionId)
      dispatch(scheduleEvents.toggleRequested(sessionId))

      try {
        const sessions = wasSelected
          ? await repository.remove(attendeeId, sessionId)
          : await repository.add(attendeeId, sessionId)

        dispatch(
          scheduleEvents.toggleSucceeded(
            sessionId,
            sessions.map((s) => s.id),
          ),
        )
        onScheduleChanged?.(sessionId)
      } catch (error) {
        dispatch(scheduleEvents.toggleFailed(sessionId, error.message))
      }
    },
    [repository, attendeeId, state.selectedIds, onScheduleChanged],
  )

  const value = useMemo(
    () => ({
      state,
      attendeeId,
      count: selectCount(state),
      calendarUrl: repository.calendarUrl(attendeeId),
      toggle,
    }),
    [state, attendeeId, repository, toggle],
  )

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>
}

export function useSchedule() {
  const context = useContext(ScheduleContext)
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider')
  }
  return context
}
