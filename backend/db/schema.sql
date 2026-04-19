BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'user', 'company');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_ownership AS ENUM ('own', 'market');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_status AS ENUM ('available', 'standby', 'on_trip', 'repair');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE driver_status AS ENUM ('available', 'on_duty', 'vacation', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  company_name VARCHAR(160),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_no VARCHAR(40) NOT NULL UNIQUE,
  ownership vehicle_ownership NOT NULL,
  owner_name VARCHAR(140),
  status vehicle_status NOT NULL DEFAULT 'available',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS status vehicle_status NOT NULL DEFAULT 'available';

CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40),
  license_no VARCHAR(80) UNIQUE,
  salary NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (salary >= 0),
  per_trip_allowance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (per_trip_allowance >= 0),
  status driver_status NOT NULL DEFAULT 'available',
  current_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  vacation_from DATE,
  vacation_to DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    status <> 'vacation'
    OR (vacation_from IS NOT NULL AND vacation_to IS NOT NULL AND vacation_to >= vacation_from)
  )
);

CREATE TABLE IF NOT EXISTS mines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL UNIQUE,
  location VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL UNIQUE,
  contact_name VARCHAR(120),
  phone VARCHAR(40),
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mine_id UUID NOT NULL REFERENCES mines(id) ON DELETE RESTRICT,
  factory_id UUID NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
  distance_km NUMERIC(10,2) NOT NULL CHECK (distance_km > 0),
  expected_diesel_litres NUMERIC(10,2) CHECK (expected_diesel_litres IS NULL OR expected_diesel_litres > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mine_id, factory_id)
);

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_date DATE NOT NULL,
  lr_number VARCHAR(80) NOT NULL UNIQUE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  driver_name VARCHAR(120) NOT NULL,
  mine_id UUID NOT NULL REFERENCES mines(id) ON DELETE RESTRICT,
  factory_id UUID NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
  distance_km NUMERIC(10,2) NOT NULL CHECK (distance_km > 0),
  weight_tons NUMERIC(10,3) NOT NULL CHECK (weight_tons > 0),
  rate_per_ton NUMERIC(12,2) NOT NULL CHECK (rate_per_ton >= 0),
  freight NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(weight_tons * rate_per_ton, 2)) STORED,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE trips ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL UNIQUE REFERENCES trips(id) ON DELETE CASCADE,
  diesel_litres NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (diesel_litres >= 0),
  diesel_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (diesel_cost >= 0),
  driver_allowance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (driver_allowance >= 0),
  toll NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (toll >= 0),
  other_expenses NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (other_expenses >= 0),
  total_expense NUMERIC(14,2) GENERATED ALWAYS AS (diesel_cost + driver_allowance + toll + other_expenses) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
  payment_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  mode VARCHAR(40) NOT NULL DEFAULT 'bank',
  reference_no VARCHAR(120),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_trip_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  UNIQUE (payment_id, trip_id)
);

CREATE INDEX IF NOT EXISTS idx_trips_trip_date ON trips(trip_date);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_name ON trips(LOWER(driver_name));
CREATE INDEX IF NOT EXISTS idx_trips_factory ON trips(factory_id);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_payments_factory ON payments(factory_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

DROP VIEW IF EXISTS driver_performance;
DROP VIEW IF EXISTS trip_financials;
DROP VIEW IF EXISTS party_ledger;

CREATE OR REPLACE VIEW trip_financials AS
SELECT
  t.id,
  t.trip_date,
  t.lr_number,
  t.driver_id,
  t.driver_name,
  d.status AS driver_status,
  t.vehicle_id,
  v.vehicle_no,
  v.ownership,
  t.mine_id,
  m.name AS mine_name,
  t.factory_id,
  f.name AS factory_name,
  t.route_id,
  t.distance_km,
  t.weight_tons,
  t.rate_per_ton,
  t.freight,
  t.created_at,
  t.updated_at,
  COALESCE(e.diesel_litres, 0) AS diesel_litres,
  COALESCE(e.diesel_cost, 0) AS diesel_cost,
  COALESCE(e.driver_allowance, 0) AS driver_allowance,
  COALESCE(e.toll, 0) AS toll,
  COALESCE(e.other_expenses, 0) AS other_expenses,
  COALESCE(e.total_expense, 0) AS total_expense,
  ROUND(t.freight - COALESCE(e.total_expense, 0), 2) AS profit,
  CASE WHEN COALESCE(e.diesel_litres, 0) > 0 THEN ROUND(t.distance_km / e.diesel_litres, 2) ELSE NULL END AS mileage,
  CASE
    WHEN e.diesel_litres IS NULL OR e.diesel_litres = 0 THEN FALSE
    WHEN t.distance_km / e.diesel_litres < 2.5 THEN TRUE
    WHEN r.expected_diesel_litres IS NOT NULL AND e.diesel_litres > r.expected_diesel_litres * 1.2 THEN TRUE
    ELSE FALSE
  END AS abnormal_diesel
FROM trips t
JOIN vehicles v ON v.id = t.vehicle_id
LEFT JOIN drivers d ON d.id = t.driver_id
JOIN mines m ON m.id = t.mine_id
JOIN factories f ON f.id = t.factory_id
JOIN routes r ON r.id = t.route_id
LEFT JOIN expenses e ON e.trip_id = t.id;

CREATE OR REPLACE VIEW party_ledger AS
WITH billing AS (
  SELECT factory_id, SUM(freight) AS total_billing
  FROM trips
  GROUP BY factory_id
),
receipts AS (
  SELECT factory_id, SUM(amount) AS payments_received
  FROM payments
  GROUP BY factory_id
)
SELECT
  f.id AS factory_id,
  f.name AS factory_name,
  COALESCE(b.total_billing, 0) AS total_billing,
  COALESCE(r.payments_received, 0) AS payments_received,
  COALESCE(b.total_billing, 0) - COALESCE(r.payments_received, 0) AS pending_balance
FROM factories f
LEFT JOIN billing b ON b.factory_id = f.id
LEFT JOIN receipts r ON r.factory_id = f.id;

CREATE OR REPLACE VIEW driver_performance AS
SELECT
  driver_name,
  COUNT(*)::INT AS total_trips,
  ROUND(SUM(profit), 2) AS total_profit,
  ROUND(AVG(profit), 2) AS average_profit,
  ROUND(SUM(distance_km) / NULLIF(SUM(diesel_litres), 0), 2) AS mileage,
  COUNT(*) FILTER (WHERE abnormal_diesel)::INT AS abnormal_diesel_trips
FROM trip_financials
GROUP BY driver_name;

COMMIT;
