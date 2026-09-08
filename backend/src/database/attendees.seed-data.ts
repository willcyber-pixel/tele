export interface SeedAttendee {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
}

/** The signed-in user for the POC. No auth yet -- this id is the stand-in. */
export const CURRENT_ATTENDEE_ID = 'me';

export const ATTENDEES_SEED: SeedAttendee[] = [
  { id: 'me', name: 'You', title: null, company: null },
  { id: 'a-avery', name: 'Avery Chen', title: 'Product Lead', company: 'Nordmark' },
  { id: 'a-bianca', name: 'Bianca Ortiz', title: 'Founder', company: 'Lumen Labs' },
  { id: 'a-caleb', name: 'Caleb Nguyen', title: 'Head of Growth', company: 'Pestie' },
  { id: 'a-dana', name: 'Dana Whitfield', title: 'VP Engineering', company: 'MX' },
  { id: 'a-elias', name: 'Elias Brandt', title: 'CTO', company: 'SponsorCX' },
  { id: 'a-farah', name: 'Farah Haddad', title: 'Design Director', company: 'Owlet' },
  { id: 'a-gwen', name: 'Gwen Alvarez', title: 'Partner', company: 'Album VC' },
  { id: 'a-hugo', name: 'Hugo Sandoval', title: 'Data Lead', company: 'Instructure' },
  { id: 'a-imani', name: 'Imani Clarke', title: 'Chief of Staff', company: 'Lendio' },
  { id: 'a-jonas', name: 'Jonas Petrov', title: 'Solutions Architect', company: 'Atonom' },
  { id: 'a-kira', name: 'Kira Lindqvist', title: 'Head of Ops', company: 'Savvos Health' },
  { id: 'a-liam', name: 'Liam Okafor', title: 'Founder', company: 'Model Forge' },
  { id: 'a-maya', name: 'Maya Rousseau', title: 'CMO', company: 'Fullcast' },
  { id: 'a-noor', name: 'Noor Rahman', title: 'Engineering Manager', company: 'Traeger' },
  { id: 'a-omar', name: 'Omar Delgado', title: 'Community Lead', company: 'Silicon Slopes' },
  { id: 'a-priya', name: 'Priya Raman', title: 'Principal PM', company: 'Ampleo' },
  { id: 'a-quinn', name: 'Quinn Foster', title: 'Recruiter', company: 'Enclavix' },
  { id: 'a-rosa', name: 'Rosa Milani', title: 'Head of Content', company: 'KP Media' },
  { id: 'a-sami', name: 'Sami Torres', title: 'Sales Director', company: 'DataXGrowth' },
  { id: 'a-tomas', name: 'Tomas Eriksen', title: 'Staff Engineer', company: 'Izeni' },
];

/**
 * Deterministic pseudo-random generator (mulberry32).
 *
 * Attendance is fabricated for the POC, but it must be *stable*: the same
 * session shows the same faces on every boot and in every test run. Seeding
 * from the session id gives that for free, with no fixture table to maintain.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Pick a stable subset of attendees for a session. Excludes the current user:
 * their own attendance comes from real schedule rows, not from this seed.
 */
export function seededAttendeesForSession(sessionId: string): string[] {
  const pool = ATTENDEES_SEED.filter((a) => a.id !== CURRENT_ATTENDEE_ID);
  const random = mulberry32(hashString(sessionId));

  // Fisher-Yates over a copy, then take a seeded-random slice.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const count = 2 + Math.floor(random() * 8); // 2..9 attendees
  return shuffled.slice(0, count).map((a) => a.id);
}
