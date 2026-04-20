# Coal Logistics Transport Management System

Production-oriented Transport Management System for coal logistics businesses that move coal from mines to factories using owned and market trucks.

## Stack

- Backend: Node.js, Express, PostgreSQL, JWT
- Frontend: React, Vite, Tailwind CSS
- Database: PostgreSQL schema with views for profit, ledger, dashboard, reports

## Folder Structure

```text
tms-coal-logistics/
  docker-compose.yml
  backend/
    .env.example
    package.json
    db/
      schema.sql
      seed.sql
    src/
      app.js
      server.js
      config/db.js
      controllers/
      middleware/
      routes/
      services/
      utils/
  frontend/
    .env.example
    package.json
    index.html
    tailwind.config.js
    postcss.config.js
    src/
      main.jsx
      App.jsx
      api/client.js
      components/
      pages/
```

## Setup Without Docker

This repository includes a no-Docker native PostgreSQL option for Windows. PostgreSQL binaries can live inside `tools/pgsql`, and the data directory can live inside `runtime/postgres-data`.

If native PostgreSQL has already been initialized for this project, start everything with:

```powershell
.\scripts\start-dev.ps1
```

Start for your whole local network:

```powershell
.\scripts\start-network.ps1
```

Stop everything:

```powershell
.\scripts\stop-dev.ps1
```

Stop the local PostgreSQL server with:

```powershell
.\scripts\stop-postgres.ps1
```

You can also use any PostgreSQL database:

- Local native PostgreSQL installed on Windows
- A PostgreSQL database on another machine
- A managed PostgreSQL provider

Update `backend/.env`:

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE
DATABASE_SSL=false
```

For managed PostgreSQL providers that require TLS:

```bash
DATABASE_SSL=true
```

Then apply the database schema and seed data using Node:

```bash
cd backend
cp .env.example .env
npm install
npm run db:setup
```

Start the backend:

```bash
npm run dev
```

Start the frontend:

```bash
cd ../frontend
cp .env.example .env
npm install
npm run dev
```

## Setup With Docker

1. Start PostgreSQL:

```bash
docker compose up -d db
```

2. Create schema and seed data:

```bash
docker compose exec -T db psql -U tms_user -d tms_db < backend/db/schema.sql
docker compose exec -T db psql -U tms_user -d tms_db < backend/db/seed.sql
```

3. Start backend:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

4. Start frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Default login after seeding:

- Email: `admin@coal-tms.local`
- Password: `Admin@12345`

Daily operating guide:

[HOW-TO-RUN.md](C:/Users/divya/Documents/Codex/2026-04-19-i-want-you-to-act-as/tms-coal-logistics/HOW-TO-RUN.md)

## Core Business Logic

- Freight is calculated as `weight_tons * rate_per_ton`.
- Distance is fetched from the `routes` table using selected mine and factory.
- Expenses are stored per trip and totalled automatically.
- Profit is exposed through the `trip_financials` view as `freight - total_expense`.
- Driver ranking is calculated from trips grouped by typed driver name.
- Party ledger combines factory billing from trips, payments, and pending balance.
- Abnormal diesel usage is flagged when mileage is below `2.5 km/l` or diesel exceeds route expected diesel by more than 20%.

## API Overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users`, `POST /api/users` (admin only)
- `GET /api/dashboard`
- `GET /api/vehicles`, `POST /api/vehicles`
- `GET /api/mines`, `POST /api/mines`
- `GET /api/factories`, `POST /api/factories`
- `GET /api/routes`, `POST /api/routes`, `GET /api/routes/distance?mineId=&factoryId=`
- `GET /api/trips`, `POST /api/trips`, `GET /api/trips/:id`
- `GET /api/payments`, `POST /api/payments`
- `GET /api/reports/trip-profit`
- `GET /api/reports/truck-profit`
- `GET /api/reports/driver-performance`
- `GET /api/reports/diesel-usage`
