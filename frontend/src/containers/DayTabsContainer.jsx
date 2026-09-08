import { useMemo } from 'react'

import { useAgenda } from '../blocs/agenda/AgendaProvider'
import { DayTabs } from '../components/DayTabs'
import { formatDayLabel } from '../domain/time'

/** Binds the agenda bloc's day list to the tab strip. */
export function DayTabsContainer() {
  const { state, days, timeZone, selectDay } = useAgenda()

  const options = useMemo(
    () =>
      days.map((day) => {
        const first = state.sessions.find((s) => s.day === day)
        return {
          value: day,
          label: first ? formatDayLabel(first.startUtc, timeZone) : `Day ${day}`,
        }
      }),
    [days, state.sessions, timeZone],
  )

  if (options.length === 0) return null

  return <DayTabs days={options} activeDay={state.activeDay} onSelect={selectDay} />
}
