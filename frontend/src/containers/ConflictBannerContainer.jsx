import { useMemo } from 'react'

import { useAgenda } from '../blocs/agenda/AgendaProvider'
import { useSchedule } from '../blocs/schedule/ScheduleProvider'
import { selectPickedSessions } from '../blocs/schedule/scheduleBloc'
import { ConflictBanner } from '../components/ConflictBanner'
import { countBySeverity, detectConflicts } from '../domain/conflicts'
import { buildConflictItems } from '../viewmodels/sessionViewModel'

/** Binds detected conflicts to the summary banner. */
export function ConflictBannerContainer() {
  const { state: agenda, selectDay, focusSession } = useAgenda()
  const { state: schedule } = useSchedule()

  const picked = useMemo(
    () => selectPickedSessions(schedule, agenda.sessions),
    [schedule, agenda.sessions],
  )

  const conflicts = useMemo(() => detectConflicts(picked), [picked])
  const counts = useMemo(() => countBySeverity(conflicts), [conflicts])

  const sessionsById = useMemo(
    () => Object.fromEntries(agenda.sessions.map((s) => [s.id, s])),
    [agenda.sessions],
  )

  const items = useMemo(
    () => buildConflictItems(conflicts, sessionsById),
    [conflicts, sessionsById],
  )

  return (
    <ConflictBanner
      overlaps={counts.overlap}
      tights={counts.tight}
      items={items}
      onSelect={(sessionId) => {
        const session = sessionsById[sessionId]
        if (session) selectDay(session.day)
        focusSession(sessionId)
      }}
    />
  )
}
