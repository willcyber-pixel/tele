import { AgendaProvider } from './blocs/agenda/AgendaProvider'
import { ScheduleProvider } from './blocs/schedule/ScheduleProvider'
import { TrackLegend } from './components/TrackLegend'
import { AgendaGridContainer } from './containers/AgendaGridContainer'
import { ConflictBannerContainer } from './containers/ConflictBannerContainer'
import { DayTabsContainer } from './containers/DayTabsContainer'
import { SchedulePanelContainer } from './containers/SchedulePanelContainer'
import { LEGEND_TRACKS } from './domain/tracks'

/**
 * Composition root. Providers own state, containers bind it, components
 * render it -- App itself only arranges the pieces.
 */
export default function App() {
  return (
    <AgendaProvider>
      <ScheduleProvider>
        <div className="app">
          <header className="masthead">
            <div className="masthead__brand">
              <span className="masthead__kicker">Silicon Slopes</span>
              <h1>StartFEST Agenda</h1>
              <p className="masthead__meta">
                2 Days · 6 Tracks · 3 Rooms · Mountain America Event Venue,
                Loveland Living Planet Aquarium
              </p>
            </div>
            <span className="masthead__dates">June 23–24</span>
          </header>

          <TrackLegend tracks={LEGEND_TRACKS} />
          <DayTabsContainer />
          <ConflictBannerContainer />

          <div className="layout">
            <main className="layout__grid">
              <AgendaGridContainer />
            </main>
            <SchedulePanelContainer />
          </div>
        </div>
      </ScheduleProvider>
    </AgendaProvider>
  )
}
