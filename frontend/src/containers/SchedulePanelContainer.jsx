import { useMemo } from 'react'

import { useAgenda } from '../blocs/agenda/AgendaProvider'
import { useSchedule } from '../blocs/schedule/ScheduleProvider'
import { SchedulePanel } from '../components/SchedulePanel'
import { conflictsBySessionId, detectConflicts } from '../domain/conflicts'
import { ROOMS } from '../domain/layout'
import { EVENT_TIME_ZONE } from '../domain/time'
import { selectPickedSessions } from '../blocs/schedule/scheduleBloc'
import { buildScheduleItems } from '../viewmodels/sessionViewModel'

const ROOM_LABELS = {
  mainstage: 'Mainstage',
  ...Object.fromEntries(ROOMS.map((r) => [r.id, r.label])),
}

/** Binds both blocs to the "my schedule" panel. */
export function SchedulePanelContainer() {
  const { state: agenda, timeZone, toggleTimeZone } = useAgenda()
  const { state: schedule, count, calendarUrl, toggle } = useSchedule()

  const picked = useMemo(
    () => selectPickedSessions(schedule, agenda.sessions),
    [schedule, agenda.sessions],
  )

  const conflictIndex = useMemo(
    () => conflictsBySessionId(detectConflicts(picked)),
    [picked],
  )

  const items = useMemo(
    () => buildScheduleItems(picked, { timeZone, conflictIndex, roomLabels: ROOM_LABELS }),
    [picked, timeZone, conflictIndex],
  )

  return (
    <SchedulePanel
      items={items}
      count={count}
      calendarUrl={calendarUrl}
      onRemove={toggle}
      onToggleTimeZone={toggleTimeZone}
      timeZoneLabel={timeZone === EVENT_TIME_ZONE ? 'Mountain Time' : 'Your time'}
    />
  )
}
