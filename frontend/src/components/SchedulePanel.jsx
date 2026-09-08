/** The user's picks, in time order, with the calendar export action. */
export function SchedulePanel({ items, count, calendarUrl, onRemove, onToggleTimeZone, timeZoneLabel }) {
  return (
    <aside className="panel">
      <header className="panel__head">
        <h2>
          My schedule <span className="panel__count">{count}</span>
        </h2>
        <button type="button" className="panel__tz" onClick={onToggleTimeZone}>
          {timeZoneLabel}
        </button>
      </header>

      {count === 0 ? (
        <p className="panel__empty">
          Pick sessions from the grid and they will collect here.
        </p>
      ) : (
        <ol className="panel__list">
          {items.map((item) => (
            <li key={item.id} className={item.conflict ? `is-${item.conflict}` : undefined}>
              <span className="panel__when">{item.timeRange}</span>
              <span className="panel__what">
                <strong>{item.title}</strong>
                <em>{item.room}</em>
              </span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.title}`}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}

      <a
        className={count === 0 ? 'panel__export is-disabled' : 'panel__export'}
        href={calendarUrl}
        aria-disabled={count === 0}
        onClick={(clickEvent) => count === 0 && clickEvent.preventDefault()}
        download="startfest-schedule.ics"
      >
        Add to calendar (.ics)
      </a>
    </aside>
  )
}
