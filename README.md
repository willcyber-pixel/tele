# StartFEST Scheduler (POC)

Conference scheduling app for the StartFEST 2026 agenda. npm-workspaces
monorepo: React frontend, NestJS + SQLite backend.

```
.
├── frontend/   @startfest/web   React 18 + Vite
├── backend/    @startfest/api   NestJS 10 + TypeORM + SQLite
└── render.yaml                  single-service deploy blueprint
```

## Running it

```bash
npm install     # installs both workspaces from the root
npm run dev     # API on :3000, web on :5173
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend,
so there is no base URL or CORS configuration to set.

The database seeds itself on first boot — 38 agenda items, 21 attendees, and a
stable set of fabricated attendance rows.

## Scripts

| Script | Does |
| --- | --- |
| `npm install` | Installs both workspaces (one lockfile at the root) |
| `npm run dev` | Both dev servers, concurrently |
| `npm run build` | Builds API then frontend |
| `npm start` | Runs the built API, which also serves the built frontend |
| `npm test` | Everything — 250 tests |
| `npm run test:unit` | Unit tests only, both sides |
| `npm run test:e2e` | Backend e2e against real SQLite |

Per-workspace: `npm run <script> -w @startfest/api` (or `@startfest/web`).

## Deploying to Render

Committed `render.yaml` describes it, or configure manually:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check | `/api/sessions` |

**One service, not two.** In production the Nest process serves the React build
out of `frontend/dist` alongside the API, so there is one origin, no CORS, and
no second service to pay for. `ServeStaticModule` is registered only when that
build directory exists, so running the API alone in development still works.

`PORT` is read from the environment; the server binds `0.0.0.0`.

**`--include=dev` is not optional.** Render sets `NODE_ENV=production`, which
makes npm default to `omit=dev` — so `@nestjs/cli`, `vite` and `typescript`
would never be installed, and the build dies with `nest: not found` (exit 127).
They are genuinely build-time tools, so they belong in devDependencies; the
install flag is the right fix rather than promoting them to dependencies.

> **SQLite on the free plan is ephemeral.** The container's filesystem resets
> on every restart and redeploy. The agenda re-seeds itself on boot, so the app
> always comes up fully populated — but **picks people made are lost**. That is
> an acceptable trade for a demo; for anything real, attach a Render persistent
> disk (the commented block in `render.yaml`) or move to Postgres/MSSQL.

## Testing

| Suite | Tests | What it covers |
| --- | --- | --- |
| `backend/src/domain/*.spec.ts` | 40 | Conflict sweep and RFC 5545 generation, in isolation |
| `backend/test/app.e2e-spec.ts` | 43 | All five requirements over HTTP against real SQLite |
| `frontend/src/domain/*.test.js` | 66 | Time maths, grid layout, conflict detection |
| `frontend/src/blocs/*.test.js` | 37 | Reducer transitions, optimistic update and rollback |
| `frontend/src/viewmodels/*.test.js` | 29 | Domain → props mapping |
| `frontend/src/App.test.jsx` | 35 | Requirements driven through real user interaction |

The e2e suite runs against in-memory SQLite and is written to run unchanged
against MSSQL.

## Architecture

A light BLoC pattern: business logic never sits in presentation.

```
domain/       pure functions — time, layout, conflicts. No React, no fetch.
data/         repositories + the one module that knows fetch exists.
blocs/        events, reducers, selectors (pure) + providers (side effects).
viewmodels/   domain entities → component props.
components/   pure renderers. Props in, callbacks out.
containers/   bind blocs to components. The only place the two blocs meet.
```

The rule that keeps it honest: **`components/` imports nothing from `blocs/`,
`data/`, or `domain/`.** A component is handed a finished view model and
renders it. That is what makes the reducers and the layout engine testable
without mounting anything.

### Backend

```
domain/       conflicts.ts, ics.ts — framework-free, no Nest, no TypeORM
sessions/     agenda read model
attendees/    rosters, with a batched lookup
schedule/     picks, conflicts, calendar export
database/     driver config + idempotent seeding
```

## How each requirement is met

**Browse the agenda in a grid.** CSS Grid with rooms as columns and a row
lattice derived from every distinct start/end instant, so a session's height
comes from its real duration. Breaks are compressed to a fixed height —
90 minutes of lunch at true scale is a dead bar taller than any talk.
Concurrent sessions in one room (Start Room at 10:30 on Day 1) split into
lanes automatically.

**Build a personal schedule.** Click a card to toggle. Updates are optimistic
and reconcile against the server's response; a failed request rolls back.

**Catch time conflicts.** Every time is stored as a UTC instant, and overlap is
computed on epoch milliseconds — never on wall-clock strings. Sort-then-sweep,
O(n log n). Two severities: a hard **overlap**, and a **tight transition**
(under 10 minutes between different rooms), which is a warning rather than a
clash.

**Add to calendar.** `GET /api/schedule/:id/calendar.ics` returns RFC 5545
iCalendar with `text/calendar` and a download disposition. Timestamps are
emitted as UTC so any client renders them correctly. Line folding at 75 octets
and text escaping are both implemented and tested, including the multi-byte
case that naive generators corrupt.

> `.cal` is not a real format — `.ics` is what Google Calendar, Outlook and
> Apple Calendar all consume.

**See who else is going.** Circular initials avatars pinned to each card's
top-right corner, three visible plus a `+N` chip, click for the full roster.
Colour is hashed from the attendee id, so a person is the same colour
everywhere. Rosters are fetched in one batched request rather than one per
card.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/sessions?day=1` | Agenda, optionally filtered |
| `GET` | `/api/sessions/:id` | One session |
| `GET` | `/api/sessions/:id/attendees` | Who is going |
| `GET` | `/api/attendees/by-session?ids=a,b,c` | Batched rosters |
| `GET` | `/api/schedule/:attendeeId` | A personal schedule |
| `POST` | `/api/schedule/:attendeeId/sessions/:id` | Add a pick (idempotent) |
| `DELETE` | `/api/schedule/:attendeeId/sessions/:id` | Remove a pick |
| `GET` | `/api/schedule/:attendeeId/conflicts` | Detected conflicts |
| `GET` | `/api/schedule/:attendeeId/calendar.ics` | Calendar download |

## Switching to MSSQL

Copy `backend/.env.example` to `backend/.env` and set `DB_DRIVER=mssql` plus
the connection variables. Entity column types (`varchar`, `boolean`,
`simple-json`) are already portable, so no schema rewrite is involved.

`synchronize` is deliberately SQLite-only. On MSSQL it stays off and TypeORM
migrations take over.

## POC scope

Known shortcuts, all deliberate:

- **No auth.** The current user is the hardcoded attendee id `me`.
- **Fabricated attendance.** Seeded deterministically from the session id, so
  it is stable across restarts. Real rows would come from real users.
- **Conflict logic exists twice** — `backend/src/domain/conflicts.ts` and
  `frontend/src/domain/conflicts.js`. The frontend copy is what makes toggling
  a card repaint instantly instead of waiting on a round trip; the backend
  stays authoritative. The proper fix is a shared workspace package.
- **`synchronize: true` on SQLite.** Fine while the data is disposable, wrong
  the moment it is not.
