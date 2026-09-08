import { Avatar } from './Avatar'

/**
 * Overlapping circular avatars showing who else is going, pinned to the top
 * corner of a session card.
 *
 * Presentation only: the caller supplies an already-prepared list of
 * { id, initials, color, ink, label } plus the overflow count.
 */
export function AvatarStack({
  people,
  overflow = 0,
  size = 26,
  onClick,
  expanded = false,
}) {
  if (people.length === 0 && overflow === 0) return null

  const label = `${people.length + overflow} attending`

  return (
    <button
      type="button"
      className="avatar-stack"
      onClick={onClick}
      aria-label={label}
      aria-expanded={onClick ? expanded : undefined}
      data-testid="avatar-stack"
    >
      {people.map((person) => (
        <Avatar
          key={person.id}
          initials={person.initials}
          color={person.color}
          ink={person.ink}
          label={person.label}
          size={size}
        />
      ))}
      {overflow > 0 && (
        <Avatar
          initials={`+${overflow}`}
          color="var(--avatar-overflow-bg)"
          ink="var(--avatar-overflow-ink)"
          label={`${overflow} more attending`}
          size={size}
        />
      )}
    </button>
  )
}
