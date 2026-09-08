/** Summary of clashes across the whole schedule. Renders nothing when clear. */
export function ConflictBanner({ overlaps, tights, items, onSelect }) {
  if (overlaps === 0 && tights === 0) return null

  return (
    <section
      className={overlaps > 0 ? 'banner banner--overlap' : 'banner banner--tight'}
      role="status"
    >
      <h3 className="banner__head">
        {overlaps > 0
          ? `${overlaps} time ${overlaps === 1 ? 'conflict' : 'conflicts'}`
          : `${tights} tight ${tights === 1 ? 'transition' : 'transitions'}`}
        {overlaps > 0 && tights > 0 && ` · ${tights} tight`}
      </h3>

      <ul className="banner__list">
        {items.map((item) => (
          <li key={item.key} className={`banner__item banner__item--${item.severity}`}>
            <button type="button" onClick={() => onSelect(item.aId)}>
              {item.aTitle}
            </button>
            <span className="banner__vs">{item.detail}</span>
            <button type="button" onClick={() => onSelect(item.bId)}>
              {item.bTitle}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
