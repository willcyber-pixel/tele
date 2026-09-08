/** Day switcher. Emits the chosen day; holds no state of its own. */
export function DayTabs({ days, activeDay, onSelect }) {
  return (
    <div className="daytabs" role="tablist" aria-label="Conference day">
      {days.map((day) => (
        <button
          key={day.value}
          type="button"
          role="tab"
          aria-selected={day.value === activeDay}
          className={day.value === activeDay ? 'daytabs__tab is-active' : 'daytabs__tab'}
          onClick={() => onSelect(day.value)}
        >
          <span className="daytabs__n">Day {day.value}</span>
          <span className="daytabs__name">{day.label}</span>
        </button>
      ))}
    </div>
  )
}
