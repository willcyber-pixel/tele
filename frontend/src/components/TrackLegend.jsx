/** The track colour key from the printed agenda. */
export function TrackLegend({ tracks }) {
  return (
    <div className="legend">
      <span className="legend__label">Tracks</span>
      <ul className="legend__items">
        {tracks.map((track) => (
          <li key={track.id}>
            <i style={{ background: track.color }} aria-hidden="true" />
            {track.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
