/**
 * A single circular avatar. Pure presentation: it is told the initials and
 * the colour, and derives nothing itself.
 */
export function Avatar({ initials, color, ink, label, size = 26, ring = true }) {
  return (
    <span
      className="avatar"
      title={label}
      aria-label={label}
      role="img"
      style={{
        width: size,
        height: size,
        background: color,
        color: ink,
        fontSize: Math.round(size * 0.38),
        boxShadow: ring ? '0 0 0 2px var(--avatar-ring)' : 'none',
      }}
    >
      {initials}
    </span>
  )
}
