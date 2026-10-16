# EventSphere Management

A MERN event-operations platform: events, venues, exhibition booths, exhibitors,
sessions, ticketing with QR check-in, live analytics, an activity/alerts feed, a
conflict-aware calendar, budget & team tasks, and an optional AI Event Copilot.

```
EventSphere_Management_E-PROJECT/
├─ package.json          # root runner: `npm start` boots backend + frontend
├─ backend/              # Express + MongoDB (Mongoose) + Socket.IO API
│  ├─ server.js          # app, route mounts, Socket.IO rooms/auth
│  ├─ config/db.js       # Mongo connection with retry
│  ├─ models/            # 28 Mongoose models
│  ├─ controllers/       # request handlers
│  ├─ routes/            # routers mounted under /api/*
│  ├─ middleware/auth.js # `protect` (JWT) + `authorize(...roles)`
│  ├─ utils/             # validation, scheduling, csv, pdfReport, aiProvider, rateLimit, activity, mailer
│  └─ tests/             # Node built-in test runner (no DB required)
└─ frontend/             # Vite + React 19 SPA (state-based navigation, no URL router)
   ├─ index.html
   ├─ public/            # favicon, manifest, service worker, images/ (project-local assets)
   ├─ src/main.jsx       # app shell, pages, Ctrl+K palette, GSAP, sockets
   ├─ src/pages/planning.jsx  # the seven advanced module pages
   ├─ src/components/ui.jsx   # shared UI primitives (Modal, PageTitle, SmartImage, Skeleton…)
   ├─ src/lib/                # api.js, planning.js, palette.js
   ├─ src/styles/             # design-system.css, typography.css, planning.css, vip-*.css
   └─ tests/                  # Node built-in unit tests for pure helpers
```

Page navigation is state-based (there is no URL router). Pages are switched with
`window.dispatchEvent(new CustomEvent('eventsphere:navigate',{detail:'<page>'}))`
or by clicking any element with `data-page="<id>"` (the sidebar and Ctrl+K palette
both use this).

## Run locally (Windows)

1. Install **Node.js 20+** (Node 24 is what this project was verified on).
2. Install **MongoDB Community Server** and make sure its Windows service is
   running. The default `backend/.env` uses
   `mongodb://127.0.0.1:27017/eventsphere`. To use MongoDB Atlas instead, replace
   `MONGO_URI` in `backend/.env` with your Atlas connection string.
3. Copy `frontend/.env.example` to `frontend/.env` and set
   `VITE_GOOGLE_CLIENT_ID` to your Google OAuth Client ID.
4. Copy `backend/.env.example` to `backend/.env` and set the same
   `GOOGLE_CLIENT_ID`, plus `GOOGLE_CLIENT_SECRET` and a long random
   `JWT_SECRET`. Never put `GOOGLE_CLIENT_SECRET` (or any server secret) in
   `frontend/.env`.
5. From the project root, start both apps:

```bash
npm install
npm start
```

Open http://localhost:5173 (frontend) — the API and Socket.IO run on
http://localhost:5000.

> If PowerShell blocks `npm` with a "running scripts is disabled" error, use
> `npm.cmd` instead (e.g. `npm.cmd start`, `npm.cmd --prefix frontend run build`).

### Seed demo data (optional)

Once MongoDB is connected, populate a full demo workspace:

```bash
npm.cmd --prefix backend run seed             # seeds only when the DB has no events
npm.cmd --prefix backend run seed -- --force  # wipe the seeded event data and reseed
```

This creates 4 events (one live, one upcoming, one completed, one draft), venues,
32 booths, sessions (including an intentional room clash so conflict detection has
something to find), tickets + paid orders + check-ins, budget entries (planned vs
actual), team tasks, notifications, an activity feed, exhibitors, sponsors, staff,
leads, feedback and message threads. **User accounts are never deleted**, and an
organizer you already registered is reused so the seeded events belong to it.

Demo logins created by the seed (password `Password123`):

| Email | Role | Sees |
| --- | --- | --- |
| `admin@eventsphere.demo` | admin | everything |
| `staff@eventsphere.demo` | staff | check-in desk |
| `exhibitor@eventsphere.demo` | exhibitor | own booths/leads |
| `attendee@eventsphere.demo` | attendee | own tickets |

Log in with your own organizer account to see the seeded events scoped to it.

### If MongoDB does not connect (Windows)

- Press `Win + R`, type `services.msc`, and press Enter.
- Find **MongoDB Server** and click **Start**. If it is not listed, install
  MongoDB Community Server first, or use a MongoDB Atlas URI.
- Confirm `backend/.env` contains
  `MONGO_URI=mongodb://127.0.0.1:27017/eventsphere` when using local MongoDB. Do
  not wrap the URI in angle brackets.
- The backend opens port 5000 even while MongoDB is unavailable, so the frontend
  still loads; database-backed routes return errors until MongoDB is reachable.
  The server retries the connection every 5 seconds. `GET /api/health` reports
  `database: "connected" | "disconnected"`.

### Google Sign-In

The browser only receives `VITE_GOOGLE_CLIENT_ID`. In Google Cloud Console add
`http://localhost:5173` as an authorized JavaScript origin. The backend verifies
the Google ID token before creating/signing in the EventSphere user.

### Dependency repair

The root runner checks for the actual required modules instead of assuming an
existing `node_modules` folder is healthy, and runs `npm install` automatically
when dependencies are incomplete.

---

# EventSphere Planning modules

Seven production modules, each backed by MongoDB, protected by the same
JWT/role middleware as the rest of the API, and rendering honest loading /
empty / error states — there are no hardcoded stats or simulated successes.

| Module | Frontend page | API |
| --- | --- | --- |
| Live Analytics & Reports | Reports | `/api/analytics/summary`, `/api/analytics/breakdown`, `/api/analytics/export.csv`, `/api/analytics/report.pdf` |
| QR Ticketing & Check-in | Check-in | `/api/checkin`, `/api/checkin/verify/:token`, `/api/checkin/tickets/:id/qr`, `/api/checkin/stats` |
| Activity Feed & Alerts | Activity | `/api/activity`, `/api/notifications`, `/api/notifications/unread-count` |
| Calendar & Conflict Detection | Calendar | `/api/calendar`, `/api/calendar/events`, `/api/calendar/conflicts` |
| AI Event Copilot | AI Copilot | `/api/copilot/status`, `/api/copilot/ask` |
| Budget & Team Tasks | Budget / Team Tasks | `/api/budget`, `/api/budget/export.csv`, `/api/tasks` |
| 3D Booth Designer | Booth Designer | `PUT /api/booths/expo/:expoId/layout`, `PUT /api/booths/:id/assign` |

## Database models (`backend/models`)

| Area | Models |
| --- | --- |
| Identity & people | `User`, `Membership`, `Staff`, `Speaker` |
| Events | `Expo` (an event), `ExpoRegistration`, `EventEngagement` |
| Venues & booths | `Venue`, `Booth`, `Exhibitor`, `ExhibitorApplication` |
| Programme | `Session` |
| Ticketing | `TicketSetting`, `TicketOrder`, `CheckIn`, `Certificate` |
| Finance & work | `FinanceTransaction` (planned/actual budget entries), `Task` |
| Comms & CRM | `Message`, `Notification`, `Activity` (activity feed), `AuditLog`, `Lead`, `Campaign`, `EmailTemplate`, `Sponsor`, `Feedback`, `OperationItem` |

Ownership model: `admin` can act on everything; an `organizer` is scoped to
events they created (`Expo.createdBy`); other roles only see their own records.

## API surface

All routes are mounted under `/api` in `backend/server.js`. Public (no token)
endpoints are intentionally limited to `GET /api/health`, the marketing health
route `/`, listing events (`GET /api/expos`, `GET /api/expos/:id`) and
`GET /api/booths/expo/:expoId`. Every other route is protected by `protect`
(verified JWT) and, where relevant, `authorize(...roles)`.

| Mount | Notes |
| --- | --- |
| `/api/auth` | register/login, Google + GitHub sign-in, profile, session revocation |
| `/api/expos` | events (list/read public; create/update/delete admin+organizer) |
| `/api/venues`, `/api/booths` | venue map + booth designer; booth reserve is exhibitor-only |
| `/api/exhibitors`, `/api/exhibitor-applications` | exhibitor records + applications |
| `/api/sessions` | programme sessions (conflict-checked, admin+organizer) |
| `/api/ticket-settings`, `/api/ticket-orders` | pass configuration, orders, QR tokens |
| `/api/checkin` | atomic QR check-in, verify, QR image, stats (admin/organizer/staff) |
| `/api/analytics` | overview, report summary/breakdown, CSV + PDF export (admin/organizer) |
| `/api/activity`, `/api/notifications` | activity feed + alerts |
| `/api/calendar` | month/range schedule, event list, conflict check |
| `/api/copilot` | provider status (any role) + grounded `ask` (rate-limited, all roles) |
| `/api/budget`, `/api/tasks` | budget entries (admin/organizer) and team tasks (any signed-in user) |
| `/api/advanced`, `/api/enterprise`, `/api/experience` | audit, registrations, experience-OS aggregation |
| `/api/messages`, `/api/staff`, `/api/feedback` | realtime messaging, staff & payroll, feedback |

Check-in is atomic: a ticket is accepted only when its order is `status: "paid"`
and `checkedInAt` is still null; the unique `CheckIn.ticket` index turns a
duplicate scan into a `409` instead of a double check-in.

## Realtime (Socket.IO)

Connect with the JWT in the handshake: `io(SOCKET, { auth: { token } })`.
A verified socket is auto-joined to its private room; unverified sockets stay
anonymous. Rooms: `user:<id>` (notifications, messages, revocations) and
`expo:<id>` (attendance, engagement, operations).

| Direction | Event | Meaning |
| --- | --- | --- |
| client → server | `user:join` | join your own verified `user:<id>` room |
| client → server | `expo:join` / `expo:leave` | subscribe/unsubscribe to an event room |
| server → client | `notification:new` | a new notification for the user |
| server → client | `activity:new` | a new entry on the activity feed |
| server → client | `attendance:checkin` | someone checked in for the event |
| server → client | `message:new` | a new direct message |
| server → client | `ticket:paid` | your ticket order was confirmed |
| server → client | `lead:new`, `engagement:new`, `operation:new`, `operation:update` | experience-OS records |
| server → client | `auth:revoked` | the session was revoked; the client signs out |

## Design system & media assets

- `src/styles/design-system.css` is the single source of reusable tokens
  (`--ds-space-*`, `--ds-radius-*`, `--ds-shadow-*`, `--ds-icon-*`, motion,
  layering) and primitives (`.ds-card`, `.ds-badge`, `.ds-media`, skeletons,
  `.ds-stagger`, hover/press utilities) used across all seven modules.
- `src/styles/typography.css` sets Space Grotesk headings with Inter body text.
- The seven module pages share the midnight-blue / electric-blue / cyan identity
  via the same tokens, the `PageTitle` emblem, `page-enter` transitions, skeleton
  loaders and staggered entrances.
- `prefers-reduced-motion` and the in-app **Reduce motion** preference
  (Settings) both disable animation.
- Images are project-local (`frontend/public/images/…`). `SmartImage` keeps a
  fixed aspect ratio, lazy-loads, and falls back to an on-brand placeholder if a
  source fails; the large public-site hero was re-encoded from a 2.7 MB PNG to a
  ~248 KB JPEG.

## Enabling the AI Copilot (optional)

The copilot stays disabled until you provide a provider in `backend/.env`:

```
AI_PROVIDER=openai          # openai | groq | openrouter | deepseek | mistral | together | gemini | custom
AI_MODEL=gpt-4o-mini        # must be a model id the provider actually supports
AI_API_KEY=sk-...           # read on the server only, never sent to the browser
AI_BASE_URL=                # required only when AI_PROVIDER=custom
AI_TIMEOUT_MS=15000
```

When no provider is configured the UI shows a configuration message and
`/api/copilot/ask` returns `configured:false` — it never invents an answer.
Responses are grounded in a JSON summary of only the records the requesting
user is authorised to see; the model cannot query the database directly.

## Tests

Both suites use Node's built-in test runner and need **no database**.

```bash
# backend: 106 unit tests (conflict detection, validation, CSV/PDF, AI provider
# contract, rate limiter, and a smoke-load of every model/controller/route)
npm.cmd --prefix backend test

# frontend: 10 unit tests for the Ctrl+K palette search helpers
npm.cmd --prefix frontend test
```

Build the frontend for production verification:

```bash
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run preview   # serves dist/ (default port 4173)
```

> The app registers a service worker (`frontend/public/sw.js`). HTML/navigation
> requests are **network-first**, so a rebuild is picked up on the next load,
> while immutable `/assets/` files are cache-first for speed. If a browser still
> shows an old build, unregister the service worker and clear caches once.

## Windows commands

```bash
# from the project root
npm.cmd install         # installs backend + frontend dependencies
npm.cmd start           # runs backend (5000) + frontend (5173) together

# individual pieces
npm.cmd --prefix backend run dev     # backend only
npm.cmd --prefix frontend run dev    # frontend only
```

Database: install MongoDB Community Server, make sure the **MongoDB Server**
service is running, and confirm `backend/.env` contains
`MONGO_URI=mongodb://127.0.0.1:27017/eventsphere`. Atlas works too — replace
`MONGO_URI` with your Atlas connection string.

## Known limitations

- Stripe is not configured in this environment, so no live checkout is claimed.
  The existing ticket purchase flow is an explicit `paymentProvider`
  `"manual_demo"` path; entry check-in only accepts orders already in a paid
  state, and there is no simulated payment success.
- `GET /api/expos` (and `GET /api/booths/expo/:expoId`) are public listings, so
  the Events page and the Ctrl+K event suggestions show the same public event
  list to every signed-in user. Locking these down would change the existing
  public/marketing behaviour and was left unchanged.
- Google/GitHub OAuth, camera QR scanning (`BarcodeDetector`), and mobile viewports
  still require real credentials/hardware and were reviewed structurally only.

### Runtime verification (2026-10-13)

Exercised against a running MongoDB + backend (Node 24) with the seed above:

- `admin@eventsphere.demo` email/password login returns a real JWT; the dashboard
  and all seven module pages render live MongoDB data (e.g. Events 4, Tickets 22,
  Revenue PKR 236,000; calendar surfaces the seeded room clash).
- Check-in is atomic end to end: first scan `201`, duplicate `409`, unpaid `400`,
  and `GET /checkin/tickets/:id/qr` returns a QR data-URL.
- Every protected GET returned `200` for an authorised role and `401`/`403` for an
  unauthenticated request; `/api/expos` remains public by design.
- One expectation to note: `/api/budget` and `/api/tasks` require `?expo=<id>`
  (they answer `400 A valid event is required.` without it), which is why the UI
  always sends a selected event.
