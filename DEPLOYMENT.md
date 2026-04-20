# Deployment Guide

This project now supports two simple running modes:

1. `Development mode`
   - Frontend on `5173`
   - Backend API on `4000`
   - Best for making changes

2. `Hosted mode`
   - Backend serves the built frontend
   - One URL only
   - Best for your laptop-hosted office use or a VPS

## Hosted Mode On Your Laptop

Run:

```powershell
.\scripts\start-hosted.ps1
```

Open:

- Local: `http://127.0.0.1:4000`
- Network: `http://YOUR-LAPTOP-IP:4000`

Stop:

```powershell
.\scripts\stop-hosted.ps1
```

This mode:
- builds the frontend
- starts PostgreSQL if your project-local PostgreSQL is available
- starts the backend in production-style mode
- serves the frontend from Express

## Hosted Mode On Linux

This project now includes shell scripts too:

```bash
./scripts/start-dev.sh
./scripts/stop-dev.sh
./scripts/start-hosted.sh
./scripts/stop-hosted.sh
```

Linux hosted mode assumes:
- Node.js is installed
- PostgreSQL is already running
- `backend/.env` is configured

## Hosted Mode On A VPS Or Cloud Server

Minimum stack:
- Node.js
- PostgreSQL
- this project folder

Recommended flow:

1. Copy the project to the server
2. Create `backend/.env`
3. Set production values:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE
DATABASE_SSL=false
JWT_SECRET=use-a-long-random-secret
JWT_EXPIRES_IN=8h
SERVE_FRONTEND=true
FRONTEND_DIST=../frontend/dist
CLIENT_ORIGIN=https://your-domain.com
```

4. Install dependencies:

```bash
cd backend && npm install
cd ../frontend && npm install
```

5. Build frontend:

```bash
cd frontend
npm run build
```

6. Apply schema:

```bash
cd ../backend
npm run db:schema
```

7. Start app:

```bash
npm run start
```

Then place Nginx or another reverse proxy in front of `http://127.0.0.1:4000`.

## Shared Web Hosting Server

This app is compatible with a web hosting server **only if that hosting supports Node.js apps and PostgreSQL**.

Important:
- normal static hosting is **not enough**
- PHP-only shared hosting is **not enough**
- you need Node.js process support and PostgreSQL access

If your hosting panel supports Node.js applications:

1. Upload the project
2. Set `backend/.env`
3. Install backend and frontend dependencies
4. Build frontend
5. Set:

```env
NODE_ENV=production
SERVE_FRONTEND=true
FRONTEND_DIST=../frontend/dist
```

6. Start the backend app through the hosting panel

Because the backend can now serve the frontend directly, this is much easier than managing two separate deployments.

## PM2 Option

This project includes:

[ecosystem.config.cjs](C:/Users/divya/Documents/Codex/2026-04-19-i-want-you-to-act-as/tms-coal-logistics/ecosystem.config.cjs)

Example:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

## Important Notes

- In hosted mode, the frontend and backend come from the same origin, so deployment is simpler.
- In development mode, frontend and backend stay separate for easier coding.
- If you use a public domain later, put HTTPS in front of the app.
- Change the default admin password and `JWT_SECRET` before public deployment.
- If you want to expose from your own PC instead of renting a server, see:
  [PUBLIC-HOSTING.md](C:/Users/divya/Documents/Codex/2026-04-19-i-want-you-to-act-as/tms-coal-logistics/PUBLIC-HOSTING.md)
