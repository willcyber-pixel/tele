/**
 * Track metadata: the six tracks from the printed agenda, plus the resource
 * room. Colours are picked to stay legible against the dark grid on both
 * the badge fill and the card's left rule.
 */
export const TRACKS = [
  { id: 'ai', label: 'AI', color: '#c6f24e', ink: '#1a2b00' },
  { id: 'marketing', label: 'Marketing', color: '#2fd6a6', ink: '#003122' },
  { id: 'operations', label: 'Operations', color: '#6cd8f5', ink: '#00303d' },
  { id: 'funding', label: 'Funding', color: '#a98bff', ink: '#1c0d47' },
  { id: 'selfLeadership', label: 'Self Leadership', color: '#e879c8', ink: '#3d0030' },
  { id: 'sales', label: 'Sales', color: '#4d94ff', ink: '#001f4d' },
  { id: 'resource', label: 'Resource Room', color: '#9aa7b8', ink: '#141c26' },
];

const TRACK_BY_ID = new Map(TRACKS.map((t) => [t.id, t]));

/** The six tracks shown in the legend; the resource room is not a track. */
export const LEGEND_TRACKS = TRACKS.filter((t) => t.id !== 'resource');

export const NEUTRAL_TRACK = { id: null, label: '', color: '#8fa3bd', ink: '#0b1622' };

export function trackFor(trackId) {
  return TRACK_BY_ID.get(trackId) ?? NEUTRAL_TRACK;
}
