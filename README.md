# Bowl Tournament Management System (MVP Skeleton)

Minimal Node.js API skeleton for the Bowl Tournament Management System. Railway-ready for early development. Manual score input first. APIs for integrations/OCR reserved.

## Local Development

1. Install dependencies:
   - `npm install`
2. Start server:
   - `npm start`
3. Health check:
   - Open `http://localhost:3000/health`

## Endpoints (MVP)
- `GET /` – service metadata
- `GET /health` – health check
- `GET /api/version` – API version
- `POST /api/auth/login` – mock login `{ role: "player" | "club" | "official" }`
- `GET /api/clubs` – placeholder list (empty)
- `GET /api/matches` – placeholder list
- `POST /api/players` – create player with `photoUrl` and `nationality`
- `GET/POST /api/admin/titles` – custom titles
- `POST /api/admin/roles` – define roles with parent and permissions
- `POST /api/matches` – create a match `{ playerIds:[..], framesPerMatch }`
- `POST /api/matches/:id/frames` – submit manual scores per frame `{ frameNo, rolls:[{playerId,pins:[...]}] }`
- `POST /api/integrations/ocr/scoreboard` – reserved, returns 501
- `GET /api/integrations/centers/:id/scores` – reserved, returns 501

## Railway Deployment
Railway detects Node projects automatically. Two options:

1) Buildpack/Nixpacks:
- Push this project to GitHub
- Create a Railway project and connect the repo
- Railway will run `npm install` and `npm start` (listens on `$PORT`)

2) Dockerfile:
- Keep the provided `Dockerfile`
- On Railway, enable Docker deployment from the repo

## GitHub Actions
- `.github/workflows/ci.yml` runs on push/PR to main
- `.github/workflows/db-init.yml` can be manually dispatched to apply `db/schema.sql`
- 在 GitHub 專案設定 Secrets 新增 `DATABASE_URL` 給 db-init 使用

## Next Steps
- Add authentication (JWT) and RBAC
- Wire up PostgreSQL on Railway and run `db/schema.sql`
- Implement QR-based match flow and admin UIs
- Add charts on a lightweight frontend (React/Chart.js)

## Environment Variables
- `DATABASE_URL` PostgreSQL connection string
- `PGSSL` set `true` when using managed Postgres with SSL (e.g., Railway)
- `INIT_DB` set `true` on first deploy to auto-apply `db/schema.sql` (requires `DATABASE_URL`). Set back to `false` afterwards.
