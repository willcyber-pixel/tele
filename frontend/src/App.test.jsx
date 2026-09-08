import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AgendaProvider } from './blocs/agenda/AgendaProvider'
import { ScheduleProvider } from './blocs/schedule/ScheduleProvider'
import { TrackLegend } from './components/TrackLegend'
import { AgendaGridContainer } from './containers/AgendaGridContainer'
import { ConflictBannerContainer } from './containers/ConflictBannerContainer'
import { DayTabsContainer } from './containers/DayTabsContainer'
import { SchedulePanelContainer } from './containers/SchedulePanelContainer'
import { LEGEND_TRACKS } from './domain/tracks'

/**
 * Integration coverage of the five requirements, driven through real user
 * interactions against in-memory stub repositories. No network, no database:
 * the BLoC seam means the whole UI can be exercised by swapping the two
 * repository objects.
 */

const SESSIONS = [
  {
    id: 'd1-welcome',
    day: 1,
    title: 'Welcome',
    description: null,
    startUtc: '2026-06-23T15:00:00.000Z',
    endUtc: '2026-06-23T15:15:00.000Z',
    room: 'mainstage',
    track: null,
    kind: 'mainstage',
    fullWidth: true,
    speakers: [{ name: 'Clint Betts' }],
  },
  {
    id: 'd1-bridging',
    day: 1,
    title: 'Bridging the Gap',
    description: null,
    startUtc: '2026-06-23T16:30:00.000Z',
    endUtc: '2026-06-23T17:05:00.000Z',
    room: 'start',
    track: 'funding',
    kind: 'session',
    fullWidth: false,
    speakers: [{ name: 'Scott Holley', title: 'Executive Director' }],
  },
  {
    id: 'd1-surviving',
    day: 1,
    title: 'Surviving the AI Correction',
    description: null,
    startUtc: '2026-06-23T16:30:00.000Z',
    endUtc: '2026-06-23T17:05:00.000Z',
    room: 'start',
    track: 'ai',
    kind: 'session',
    fullWidth: false,
    speakers: [{ name: 'Michael Malin', title: 'Founder Model Forge' }],
  },
  {
    id: 'd1-blueprint',
    day: 1,
    title: 'AI Blueprint Workshop',
    description: null,
    startUtc: '2026-06-23T16:30:00.000Z',
    endUtc: '2026-06-23T17:05:00.000Z',
    room: 'accelerator',
    track: 'ai',
    kind: 'session',
    fullWidth: false,
    speakers: [{ name: 'Cameo Doran' }],
  },
  {
    id: 'd1-lunch',
    day: 1,
    title: 'Networking Lunch',
    description: null,
    startUtc: '2026-06-23T18:00:00.000Z',
    endUtc: '2026-06-23T19:30:00.000Z',
    room: 'mainstage',
    track: null,
    kind: 'break',
    fullWidth: true,
    speakers: [],
  },
  {
    id: 'd1-leadership',
    day: 1,
    title: 'Leadership',
    description: null,
    startUtc: '2026-06-23T20:15:00.000Z',
    endUtc: '2026-06-23T21:00:00.000Z',
    room: 'start',
    track: 'selfLeadership',
    kind: 'session',
    fullWidth: false,
    speakers: [{ name: 'Steve Daly', title: 'CEO Instructure' }],
  },
  {
    id: 'd2-chaos',
    day: 2,
    title: 'From Chaos to Process',
    description: null,
    startUtc: '2026-06-24T17:00:00.000Z',
    endUtc: '2026-06-24T17:35:00.000Z',
    room: 'start',
    track: 'operations',
    kind: 'session',
    fullWidth: false,
    speakers: [{ name: 'Jake Fackrell', title: 'COO Savvos Health' }],
  },
  {
    id: 'd2-growth',
    day: 2,
    title: 'The Unexpected Obvious of Growth',
    description: null,
    startUtc: '2026-06-24T17:40:00.000Z',
    endUtc: '2026-06-24T18:15:00.000Z',
    room: 'ignition',
    track: 'marketing',
    kind: 'session',
    fullWidth: false,
    speakers: [{ name: 'Zack Oates' }],
  },
]

const ROSTERS = {
  'd1-bridging': [
    { id: 'a-avery', name: 'Avery Chen', title: 'Product Lead', company: 'Nordmark' },
    { id: 'a-bianca', name: 'Bianca Ortiz', title: 'Founder', company: 'Lumen Labs' },
    { id: 'a-caleb', name: 'Caleb Nguyen', title: 'Head of Growth', company: 'Pestie' },
    { id: 'a-dana', name: 'Dana Whitfield', title: 'VP Engineering', company: 'MX' },
    { id: 'a-elias', name: 'Elias Brandt', title: 'CTO', company: 'SponsorCX' },
  ],
  'd1-blueprint': [{ id: 'a-farah', name: 'Farah Haddad', title: 'Design Director', company: 'Owlet' }],
}

function stubAgendaRepository(overrides = {}) {
  return {
    listSessions: vi.fn().mockResolvedValue(SESSIONS),
    listAttendeesBySession: vi.fn().mockResolvedValue(ROSTERS),
    ...overrides,
  }
}

/** In-memory stand-in for the schedule API, including the unique constraint. */
function stubScheduleRepository(initialIds = []) {
  let picked = new Set(initialIds)
  const hydrate = () =>
    SESSIONS.filter((s) => picked.has(s.id)).sort(
      (a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc),
    )

  return {
    list: vi.fn(async () => hydrate()),
    add: vi.fn(async (_attendeeId, sessionId) => {
      picked.add(sessionId)
      return hydrate()
    }),
    remove: vi.fn(async (_attendeeId, sessionId) => {
      picked.delete(sessionId)
      return hydrate()
    }),
    conflicts: vi.fn(async () => []),
    calendarUrl: vi.fn(() => '/api/schedule/me/calendar.ics'),
    __picked: () => [...picked],
  }
}

async function renderApp({ agendaRepository, scheduleRepository } = {}) {
  const agenda = agendaRepository ?? stubAgendaRepository()
  const schedule = scheduleRepository ?? stubScheduleRepository()

  const utils = render(
    <AgendaProvider repository={agenda}>
      <ScheduleProvider repository={schedule}>
        <TrackLegend tracks={LEGEND_TRACKS} />
        <DayTabsContainer />
        <ConflictBannerContainer />
        <AgendaGridContainer />
        <SchedulePanelContainer />
      </ScheduleProvider>
    </AgendaProvider>,
  )

  // The agenda loads in two stages -- sessions first so the grid paints, then
  // the attendee rosters. Flush both so assertions run against a settled tree.
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  return { ...utils, agenda, schedule }
}

const cardButton = (title) =>
  screen.getByRole('button', { name: new RegExp(`^${title},`) })

const panel = () => screen.getByRole('complementary')

/**
 * Scope a lookup to the grid. A picked session's title also appears in the
 * side panel, so an unscoped getByText matches twice.
 */
const gridCard = (title) =>
  within(document.querySelector('.grid')).getByText(title).closest('.card')

// --------------------------------------------------------------------------
// Requirement 1: browse the full agenda across both days
// --------------------------------------------------------------------------
describe('Requirement 1 - browse the agenda in a grid', () => {
  it('renders the day 1 sessions once loaded', async () => {
    await renderApp()

    expect(await screen.findByText('Bridging the Gap')).toBeInTheDocument()
    expect(screen.getByText('AI Blueprint Workshop')).toBeInTheDocument()
    expect(screen.getByText('Welcome')).toBeInTheDocument()
  })

  it('shows the three room columns', async () => {
    await renderApp()
    await screen.findByText('Bridging the Gap')

    expect(screen.getByText('Start Room')).toBeInTheDocument()
    expect(screen.getByText('Ignition Room')).toBeInTheDocument()
    expect(screen.getByText('Accelerator')).toBeInTheDocument()
  })

  it('shows the track legend', async () => {
    await renderApp()
    const legend = screen.getByText('Tracks').closest('.legend')

    expect(within(legend).getByText('AI')).toBeInTheDocument()
    expect(within(legend).getByText('Self Leadership')).toBeInTheDocument()
  })

  it('shows speakers and times on a card', async () => {
    await renderApp()
    await screen.findByText('Bridging the Gap')

    expect(screen.getByText('Scott Holley')).toBeInTheDocument()
    expect(screen.getAllByText('10:30 AM – 11:05 AM').length).toBeGreaterThan(0)
  })

  it('starts on day 1 and does not render day 2 sessions', async () => {
    await renderApp()
    await screen.findByText('Bridging the Gap')

    expect(screen.queryByText('From Chaos to Process')).not.toBeInTheDocument()
  })

  it('switches to day 2', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Bridging the Gap')

    await user.click(screen.getByRole('tab', { name: /Day 2/ }))

    expect(await screen.findByText('From Chaos to Process')).toBeInTheDocument()
    expect(screen.queryByText('Bridging the Gap')).not.toBeInTheDocument()
  })

  it('lays concurrent sessions in one room into separate lanes', async () => {
    await renderApp()
    await screen.findByText('Bridging the Gap')

    // Both are 16:30-17:05 in the Start Room, so each takes half the column
    // and they sit at different horizontal offsets rather than overlapping.
    const first = gridCard('Bridging the Gap').closest('.grid__cell')
    const second = gridCard('Surviving the AI Correction').closest('.grid__cell')

    expect(first.style.width).toBe('calc(50%)')
    expect(second.style.width).toBe('calc(50%)')
    expect(first.style.marginLeft).not.toBe(second.style.marginLeft)

    // Same room column and same rows -- only the lane offset differs.
    expect(first.style.gridColumn).toBe(second.style.gridColumn)
    expect(first.style.gridRow).toBe(second.style.gridRow)
  })

  it('spans a mainstage item across every room column', async () => {
    await renderApp()
    await screen.findByText('Welcome')

    const cell = gridCard('Welcome').closest('.grid__cell')
    expect(cell.style.gridColumn).toBe('2 / 5')
  })

  it('surfaces an API failure instead of rendering an empty grid', async () => {
    await renderApp({
      agendaRepository: stubAgendaRepository({
        listSessions: vi.fn().mockRejectedValue(new Error('boom')),
      }),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the agenda')
  })
})

// --------------------------------------------------------------------------
// Requirement 2: build a personal schedule
// --------------------------------------------------------------------------
describe('Requirement 2 - build a personal schedule', () => {
  it('starts with an empty panel', async () => {
    await renderApp()
    await screen.findByText('Bridging the Gap')

    expect(within(panel()).getByText(/Pick sessions from the grid/)).toBeInTheDocument()
  })

  it('adds a session when its card is clicked', async () => {
    const user = userEvent.setup()
    const { schedule } = await renderApp()
    await screen.findByText('Bridging the Gap')

    await user.click(cardButton('Bridging the Gap'))

    await waitFor(() => expect(schedule.add).toHaveBeenCalledWith('me', 'd1-bridging'))
    expect(within(panel()).getByText('Bridging the Gap')).toBeInTheDocument()
  })

  it('marks the card as selected', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Bridging the Gap')

    await user.click(cardButton('Bridging the Gap'))

    await waitFor(() =>
      expect(cardButton('Bridging the Gap')).toHaveAttribute('aria-pressed', 'true'),
    )
  })

  it('removes the session when the card is clicked again', async () => {
    const user = userEvent.setup()
    const { schedule } = await renderApp()
    await screen.findByText('Bridging the Gap')

    await user.click(cardButton('Bridging the Gap'))
    await waitFor(() => expect(schedule.add).toHaveBeenCalled())
    await user.click(cardButton('Bridging the Gap'))

    await waitFor(() => expect(schedule.remove).toHaveBeenCalledWith('me', 'd1-bridging'))
    expect(within(panel()).getByText(/Pick sessions from the grid/)).toBeInTheDocument()
  })

  it('removes a session from the panel’s own control', async () => {
    const user = userEvent.setup()
    const { schedule } = await renderApp()
    await screen.findByText('Bridging the Gap')
    await user.click(cardButton('Bridging the Gap'))
    await waitFor(() => expect(schedule.add).toHaveBeenCalled())

    await user.click(within(panel()).getByRole('button', { name: /Remove Bridging the Gap/ }))

    await waitFor(() => expect(schedule.remove).toHaveBeenCalledWith('me', 'd1-bridging'))
  })

  it('shows a running count of picks', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Bridging the Gap')

    await user.click(cardButton('Bridging the Gap'))
    await user.click(cardButton('Leadership'))

    await waitFor(() =>
      expect(within(panel()).getByText('2', { selector: '.panel__count' })).toBeInTheDocument(),
    )
  })

  it('restores an existing schedule on load', async () => {
    await renderApp({ scheduleRepository: stubScheduleRepository(['d1-bridging']) })

    await waitFor(() =>
      expect(within(panel()).getByText('Bridging the Gap')).toBeInTheDocument(),
    )
  })

  it('keeps picks across a day switch', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Bridging the Gap')
    await user.click(cardButton('Bridging the Gap'))

    await user.click(screen.getByRole('tab', { name: /Day 2/ }))

    expect(within(panel()).getByText('Bridging the Gap')).toBeInTheDocument()
  })

  it('rolls the pick back when the request fails', async () => {
    const user = userEvent.setup()
    const failing = stubScheduleRepository()
    failing.add = vi.fn().mockRejectedValue(new Error('offline'))

    await renderApp({ scheduleRepository: failing })
    await screen.findByText('Bridging the Gap')

    await user.click(cardButton('Bridging the Gap'))

    await waitFor(() =>
      expect(cardButton('Bridging the Gap')).toHaveAttribute('aria-pressed', 'false'),
    )
    expect(within(panel()).getByText(/Pick sessions from the grid/)).toBeInTheDocument()
  })
})

// --------------------------------------------------------------------------
// Requirement 3: catch time conflicts
// --------------------------------------------------------------------------
describe('Requirement 3 - catch time conflicts', () => {
  it('shows no banner for a clash-free schedule', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Bridging the Gap')

    await user.click(cardButton('Bridging the Gap'))
    await user.click(cardButton('Leadership'))

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('flags two sessions booked in the same slot', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Bridging the Gap')

    await user.click(cardButton('Bridging the Gap'))
    await user.click(cardButton('AI Blueprint Workshop'))

    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('1 time conflict')
    expect(banner).toHaveTextContent('overlaps by 35 min')
  })

  it('marks both conflicting cards', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Bridging the Gap')

    await user.click(cardButton('Bridging the Gap'))
    await user.click(cardButton('AI Blueprint Workshop'))

    await waitFor(() => {
      expect(gridCard('Bridging the Gap')).toHaveClass('has-conflict--overlap')
      expect(gridCard('AI Blueprint Workshop')).toHaveClass('has-conflict--overlap')
    })
  })

  it('flags a tight transition between rooms', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Bridging the Gap')
    await user.click(screen.getByRole('tab', { name: /Day 2/ }))
    await screen.findByText('From Chaos to Process')

    // 17:00-17:35 in Start, then 17:40-18:15 in Ignition: a 5-minute gap.
    await user.click(cardButton('From Chaos to Process'))
    await user.click(cardButton('The Unexpected Obvious of Growth'))

    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('1 tight transition')
    expect(banner).toHaveTextContent('only 5 min between rooms')
  })

  it('clears the conflict when one side is removed', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Bridging the Gap')

    await user.click(cardButton('Bridging the Gap'))
    await user.click(cardButton('AI Blueprint Workshop'))
    await screen.findByRole('status')

    await user.click(cardButton('AI Blueprint Workshop'))

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('does not treat a break as a conflict', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Networking Lunch')

    await user.click(cardButton('Networking Lunch'))
    await user.click(cardButton('Bridging the Gap'))

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('does not flag sessions on different days', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Bridging the Gap')
    await user.click(cardButton('Bridging the Gap'))

    await user.click(screen.getByRole('tab', { name: /Day 2/ }))
    await screen.findByText('From Chaos to Process')
    await user.click(cardButton('From Chaos to Process'))

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('jumps to the right day when a banner entry is clicked', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Bridging the Gap')
    await user.click(cardButton('Bridging the Gap'))
    await user.click(cardButton('AI Blueprint Workshop'))

    const banner = await screen.findByRole('status')
    await user.click(within(banner).getByRole('button', { name: 'Bridging the Gap' }))

    expect(screen.getByRole('tab', { name: /Day 1/ })).toHaveAttribute('aria-selected', 'true')
  })
})

// --------------------------------------------------------------------------
// Requirement 4: add to calendar
// --------------------------------------------------------------------------
describe('Requirement 4 - calendar export', () => {
  it('offers a download pointing at the .ics endpoint', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Bridging the Gap')
    await user.click(cardButton('Bridging the Gap'))

    const link = within(panel()).getByRole('link', { name: /Add to calendar/ })
    expect(link).toHaveAttribute('href', '/api/schedule/me/calendar.ics')
    expect(link).toHaveAttribute('download', 'startfest-schedule.ics')
  })

  it('disables the export while the schedule is empty', async () => {
    await renderApp()
    await screen.findByText('Bridging the Gap')

    const link = within(panel()).getByRole('link', { name: /Add to calendar/ })
    expect(link).toHaveAttribute('aria-disabled', 'true')
    expect(link).toHaveClass('is-disabled')
  })
})

// --------------------------------------------------------------------------
// Requirement 5: see who else is going
// --------------------------------------------------------------------------
describe('Requirement 5 - see who else is going', () => {
  it('shows an avatar stack on a session with attendees', async () => {
    await renderApp()
    await screen.findByText('Bridging the Gap')

    const card = gridCard('Bridging the Gap')
    await waitFor(() =>
      expect(within(card).getByTestId('avatar-stack')).toBeInTheDocument(),
    )
  })

  it('caps the visible faces and shows an overflow chip', async () => {
    await renderApp()
    await screen.findByText('Bridging the Gap')
    const card = gridCard('Bridging the Gap')

    await waitFor(() => expect(within(card).getByText('+2')).toBeInTheDocument())
    expect(within(card).getByText('AC')).toBeInTheDocument()
  })

  it('labels the stack with the total going', async () => {
    await renderApp()
    await screen.findByText('Bridging the Gap')
    const card = gridCard('Bridging the Gap')

    await waitFor(() =>
      expect(within(card).getByTestId('avatar-stack')).toHaveAttribute(
        'aria-label',
        '5 attending',
      ),
    )
  })

  it('renders no stack for a session nobody is attending', async () => {
    await renderApp()
    await screen.findByText('Leadership')

    const card = gridCard('Leadership')
    expect(within(card).queryByTestId('avatar-stack')).not.toBeInTheDocument()
  })

  it('opens the full roster when the stack is clicked', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Bridging the Gap')
    const card = gridCard('Bridging the Gap')
    await waitFor(() => within(card).getByTestId('avatar-stack'))

    await user.click(within(card).getByTestId('avatar-stack'))

    const dialog = await screen.findByRole('dialog', { name: 'Who else is going' })
    expect(within(dialog).getByText('Avery Chen')).toBeInTheDocument()
    expect(within(dialog).getByText('Elias Brandt')).toBeInTheDocument()
  })

  it('closes the roster again', async () => {
    const user = userEvent.setup()
    await renderApp()
    await screen.findByText('Bridging the Gap')
    const card = gridCard('Bridging the Gap')
    await waitFor(() => within(card).getByTestId('avatar-stack'))

    await user.click(within(card).getByTestId('avatar-stack'))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not toggle the session when the avatars are clicked', async () => {
    const user = userEvent.setup()
    const { schedule } = await renderApp()
    await screen.findByText('Bridging the Gap')
    const card = gridCard('Bridging the Gap')
    await waitFor(() => within(card).getByTestId('avatar-stack'))

    await user.click(within(card).getByTestId('avatar-stack'))

    expect(schedule.add).not.toHaveBeenCalled()
  })
})
