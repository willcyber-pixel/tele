import { SessionCard } from './SessionCard'

/**
 * The time-versus-room canvas.
 *
 * Pure presentation: it is handed row heights, column count and per-session
 * placements already computed by the layout domain, and turns them into CSS
 * grid coordinates. It never looks at a date.
 */
export function AgendaGrid({
  rooms,
  rowHeights,
  timeLabels,
  cards,
  onToggle,
  onAvatarsClick,
  openPopoverId,
  onPopoverDismiss,
}) {
  const style = {
    gridTemplateColumns: `var(--gutter) repeat(${rooms.length}, minmax(0, 1fr))`,
    gridTemplateRows: rowHeights.map((h) => `${h}px`).join(' '),
  }

  return (
    <div className="grid-scroll">
      <div className="grid-head" style={{ gridTemplateColumns: style.gridTemplateColumns }}>
        <div className="grid-head__gutter" />
        {rooms.map((room) => (
          <div key={room.id} className="grid-head__room">
            <span className="grid-head__badge">{room.badge}</span>
            {room.label}
          </div>
        ))}
      </div>

      <div className="grid" style={style}>
        {timeLabels.map((label) => (
          <div
            key={label.key}
            className="grid__time"
            style={{ gridRow: `${label.rowStart} / span 1`, gridColumn: 1 }}
          >
            <span className="grid__time-start">{label.start}</span>
            <span className="grid__time-end">{label.end}</span>
          </div>
        ))}

        {cards.map((card) => (
          <div
            key={card.session.id}
            className="grid__cell"
            style={{
              gridRow: `${card.rowStart} / ${card.rowEnd}`,
              gridColumn: `${card.columnStart} / ${card.columnEnd}`,
              // Lanes split a room column between concurrent sessions without
              // changing the column's own width.
              width: card.lanes > 1 ? `calc(100% / ${card.lanes})` : undefined,
              marginLeft:
                card.lanes > 1 ? `calc(${card.lane} * 100% / ${card.lanes})` : undefined,
            }}
          >
            <SessionCard
              session={card.session}
              onToggle={onToggle}
              onAvatarsClick={onAvatarsClick}
              showPopover={openPopoverId === card.session.id}
              onPopoverDismiss={onPopoverDismiss}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
