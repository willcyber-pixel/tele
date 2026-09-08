import { Avatar } from './Avatar'

/** The full roster for one session. Pure list rendering. */
export function AttendeePopover({ people, onDismiss }) {
  return (
    <div className="popover" role="dialog" aria-label="Who else is going">
      <div className="popover__head">
        <span>Who else is going</span>
        <button type="button" onClick={onDismiss} aria-label="Close">
          ×
        </button>
      </div>
      <ul className="popover__list">
        {people.map((person) => (
          <li key={person.id}>
            <Avatar
              initials={person.initials}
              color={person.color}
              ink={person.ink}
              label={person.label}
              size={28}
              ring={false}
            />
            <span className="popover__who">
              <strong>{person.name}</strong>
              {person.subtitle && <em>{person.subtitle}</em>}
            </span>
          </li>
        ))}
        {people.length === 0 && <li className="popover__empty">No one yet.</li>}
      </ul>
    </div>
  )
}
