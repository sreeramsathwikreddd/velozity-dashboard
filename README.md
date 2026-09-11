# Velozity Client Project Dashboard

Real-time internal dashboard: role-based project/task management + live activity feed.

## Stack

- Frontend: React + TypeScript (Vite)
- Backend: Node.js + Express + TypeScript
- DB: PostgreSQL via Prisma
- Real-time: Socket.io
- Jobs: node-cron

## Local setup (Docker — preferred)

```bash
git clone <repo-url>
cd velozity-dashboard
docker compose up --build
```

This starts Postgres, runs migrations, seeds the DB, and starts both services:
- Backend: http://localhost:4000
- Frontend: http://localhost:5173

Seed accounts (password for all: `Password123!`):
- `admin@velozity.dev` — Admin
- `pm1@velozity.dev`, `pm2@velozity.dev` — Project Managers
- `dev1@velozity.dev` .. `dev4@velozity.dev` — Developers

## Local setup (without Docker)

```bash
# Postgres running locally, then:
cd backend
cp .env.example .env      # edit DATABASE_URL if needed
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev

# separate terminal
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Database schema

`User(role) — Client — Project(managerId → User) — Task(projectId, assignedToId) — TaskActivity(taskId, projectId, actorId) — Notification(userId, taskId) — RefreshToken(userId)`

- `Project.managerId` ties a project to exactly one PM — this is the field every PM-scoped query filters on.
- `Task` has indexes on `projectId`, `assignedToId`, `status`, `priority`, `dueDate`, and a composite `(projectId, status)` — these are exactly the columns the filter/list endpoints query and sort by.
- `TaskActivity` is indexed on `(projectId, createdAt)` for the feed/catch-up queries (scoped by project, ordered by time) and on `taskId` for a single task's history.
- `Notification` is indexed on `(userId, read)` for the unread-count badge and `(userId, createdAt)` for the dropdown list.
- Status changes are written to `TaskActivity` as part of the same DB transaction as the `Task` update — the log is a real table, not derived from `updatedAt`.

Full schema: `backend/prisma/schema.prisma`.

## Architectural decisions

**WebSocket library: Socket.io**, not native `ws`. Reasons: built-in room support maps directly onto the access model (a `project:{id}` room per PM's project, a `user:{id}` room per person, a `global` room for admin), automatic reconnection, and a handshake `auth` payload that made it straightforward to authenticate the socket with the same JWT used for HTTP. Native WebSocket would have meant hand-rolling all three.

**Role-filtered feed**: filtering happens at emit time, not at render time. When a task's status changes, the server computes exactly which rooms should hear about it (`global`, the owning project's room, and the assignee's personal room) and emits once — Socket.io de-dupes for sockets in more than one matching room. A developer's socket is never subscribed to a project room at all, so there's no filter to bypass: the event simply never reaches their socket. Room membership itself is re-validated server-side on every `project:join` request (PM ownership checked against the DB, not trusted from the client).

**Missed-event catch-up**: `GET /api/tasks/activity/catchup` reads the last 20 `TaskActivity` rows from Postgres, scoped by the same role logic as the live feed. Nothing is cached in memory — a restart or multi-instance deployment doesn't lose anything.

**Token storage**: access token (15 min) is returned in the login response body and kept only in memory on the frontend (a module-level variable, never `localStorage`). The refresh token (7 days) is set as an `HttpOnly`, `SameSite=Lax` cookie scoped to `/api/auth`, so it's inaccessible to JS and immune to XSS-based exfiltration. Refresh tokens are stored server-side hashed (SHA-256) and rotated on every use — using an old one fails.

**Job queue: node-cron**, not Bull/Redis. The only background job here is a single sweep ("flag tasks past due") with no payload, no per-job retry logic, and no need for distributed workers. Bull earns its complexity when jobs carry data and need retry/backoff/dead-letter handling; this doesn't, so adding Redis would be unjustified infrastructure for the problem.

**Role enforcement**: every protected route runs `authenticate` (verifies JWT, attaches `req.user`) and then applies role scoping *inside the Prisma `where` clause itself* — e.g. a developer's task query is `{ assignedToId: req.user.id }`, not "fetch all, then filter." A modified JWT claiming a different role still only unlocks what that role's queries allow; a modified `sub` claiming a different user id still only returns rows where that id owns the resource. There is no endpoint that relies on the frontend to hide a button.

## Known limitations

- No automated test suite (unit/integration tests) included given the time box — manual verification only.
- Frontend styling is functional, not polished (inline styles, no design system).
- No pagination on task/activity lists beyond the fixed limits noted in the code — fine at seed-data scale, would need cursor pagination at real volume.
- No rate limiting on auth endpoints.
- Notification delivery is at-most-once over the socket; a client offline at the moment of emit relies on the DB-backed `/notifications` list on next load rather than a guaranteed-delivery queue.
- Single-server Socket.io setup — a multi-instance deployment would need the Redis adapter for cross-instance room broadcast, not included here.
