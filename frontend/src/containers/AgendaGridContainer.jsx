import { useMemo, useState } from 'react'

import { useAgenda } from '../blocs/agenda/AgendaProvider'
import { CURRENT_ATTENDEE_ID, useSchedule } from '../blocs/schedule/ScheduleProvider'
import { AgendaGrid } from '../components/AgendaGrid'
import { StatusMessage } from '../components/StatusMessage'
import { conflictsBySessionId, detectConflicts } from '../domain/conflicts'
import { buildDayLayout, buildTimeLabels, ROOMS } from '../domain/layout'
import { buildSessionCardModel, buildTimeLabelModels } from '../viewmodels/sessionViewModel'

/**
 * Binds the agenda and schedule blocs to the grid.
 *
 * Containers are the only place the two blocs meet: the agenda supplies
 * sessions, the schedule supplies picks, and the domain turns the pair into
 * layout and conflicts. The grid component below receives nothing but
 * already-computed view models.
 */
export function AgendaGridContainer() {
  const { state: agenda, daySessions, timeZone } = useAgenda()
  const { state: schedule, toggle } = useSchedule()
  const [openPopoverId, setOpenPopoverId] = useState(null)

  // Conflicts span the whole schedule, not just the visible day -- a Day 1
  // pick and a Day 2 pick cannot clash, but the index must still cover both.
  const conflictIndex = useMemo(() => {
    const picked = agenda.sessions.filter((s) => schedule.selectedIds.includes(s.id))
    return conflictsBySessionId(detectConflicts(picked))
  }, [agenda.sessions, schedule.selectedIds])

  const layout = useMemo(() => buildDayLayout(daySessions), [daySessions])

  const timeLabels = useMemo(
    () => buildTimeLabelModels(buildTimeLabels(daySessions, layout), timeZone),
    [daySessions, layout, timeZone],
  )

  const cards = useMemo(() => {
    const placementById = new Map(layout.placements.map((p) => [p.sessionId, p]))

    return daySessions.map((session) => {
      const placement = placementById.get(session.id)
      return {
        ...placement,
        session: buildSessionCardModel(session, {
          timeZone,
          selectedIds: schedule.selectedIds,
          pendingIds: schedule.pendingIds,
          conflictIndex,
          attendeesBySession: agenda.attendeesBySession,
          currentAttendeeId: CURRENT_ATTENDEE_ID,
        }),
      }
    })
  }, [
    daySessions,
    layout,
    timeZone,
    schedule.selectedIds,
    schedule.pendingIds,
    conflictIndex,
    agenda.attendeesBySession,
  ])

  if (agenda.status === 'loading' || agenda.status === 'idle') {
    return <StatusMessage title="Loading the agenda…" />
  }

  if (agenda.status === 'error') {
    return (
      <StatusMessage
        tone="error"
        title="Could not load the agenda"
        detail={`${agenda.error}. Is the API running on port 3000?`}
      />
    )
  }

  return (
    <AgendaGrid
      rooms={ROOMS}
      rowHeights={layout.rowHeights}
      timeLabels={timeLabels}
      cards={cards}
      onToggle={toggle}
      onAvatarsClick={(id) => setOpenPopoverId((open) => (open === id ? null : id))}
      openPopoverId={openPopoverId}
      onPopoverDismiss={() => setOpenPopoverId(null)}
    />
  )
}
