import { AttendeePopover } from './AttendeePopover'
import { AvatarStack } from './AvatarStack'

/**
 * One session in the grid.
 *
 * Pure presentation. It receives a prepared view model -- already-formatted
 * times, resolved track colours, a computed conflict severity, a prepared
 * avatar list -- and renders it. No date maths, no domain imports, no
 * knowledge of how a conflict is detected or where attendees come from.
 */
export function SessionCard({
  session,
  onToggle,
  onAvatarsClick,
  showPopover = false,
  onPopoverDismiss,
}) {
  const {
    id,
    title,
    speakers,
    description,
    timeRange,
    track,
    variant,
    selected,
    pending,
    conflict,
    avatars,
    avatarOverflow,
    roster,
  } = session

  const classes = [
    'card',
    `card--${variant}`,
    selected && 'is-selected',
    pending && 'is-pending',
    conflict && `has-conflict has-conflict--${conflict}`,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} style={{ '--track': track.color, '--track-ink': track.ink }}>
      <button
        type="button"
        className="card__hit"
        onClick={() => onToggle(id)}
        aria-pressed={selected}
        disabled={pending}
        aria-label={`${title}, ${timeRange}${selected ? ', on your schedule' : ''}`}
      >
        <span className="card__top">
          {track.label && <span className="card__track">{track.label}</span>}
          {conflict && (
            <span className={`card__flag card__flag--${conflict}`}>
              {conflict === 'overlap' ? 'Clash' : 'Tight'}
            </span>
          )}
        </span>

        <span className="card__title">{title}</span>

        {speakers.length > 0 && (
          <span className="card__speakers">
            {speakers.map((speaker) => (
              <span key={speaker.name} className="card__speaker">
                <strong>{speaker.name}</strong>
                {speaker.title && <em>{speaker.title}</em>}
              </span>
            ))}
          </span>
        )}

        {description && <span className="card__desc">{description}</span>}

        <span className="card__foot">{timeRange}</span>
      </button>

      {selected && (
        <span className="card__check" aria-hidden="true">
          ✓
        </span>
      )}

      <span className="card__avatars">
        <AvatarStack
          people={avatars}
          overflow={avatarOverflow}
          expanded={showPopover}
          onClick={(clickEvent) => {
            clickEvent.stopPropagation()
            onAvatarsClick(id)
          }}
        />
      </span>

      {showPopover && <AttendeePopover people={roster} onDismiss={onPopoverDismiss} />}
    </div>
  )
}
