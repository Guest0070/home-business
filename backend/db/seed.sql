BEGIN;

INSERT INTO users (name, email, password_hash, role)
VALUES (
  'System Admin',
  'admin@coal-tms.local',
  crypt('Admin@12345', gen_salt('bf', 10)),
  'admin'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO mines (name, location) VALUES
  ('Dhanbad Mine', 'Dhanbad'),
  ('Korba Mine', 'Korba')
ON CONFLICT (name) DO NOTHING;

INSERT INTO factories (name, contact_name, phone, address) VALUES
  ('Shakti Steel Plant', 'Accounts Team', '9000000001', 'Raipur Industrial Area'),
  ('Eastern Cement Works', 'Billing Desk', '9000000002', 'Asansol')
ON CONFLICT (name) DO NOTHING;

INSERT INTO vehicles (vehicle_no, ownership, owner_name) VALUES
  ('CG04AB1234', 'own', 'Coal Logistics'),
  ('JH10MK4567', 'market', 'Ramesh Transport')
ON CONFLICT (vehicle_no) DO NOTHING;

INSERT INTO drivers (name, phone, license_no, salary, per_trip_allowance, status, current_vehicle_id)
SELECT 'Raju Kumar', '9000000101', 'DL-RJ-1001', 22000, 700, 'available', v.id
FROM vehicles v
WHERE v.vehicle_no = 'CG04AB1234'
ON CONFLICT (license_no) DO NOTHING;

INSERT INTO drivers (name, phone, license_no, salary, per_trip_allowance, status)
VALUES ('Sanjay Yadav', '9000000102', 'DL-SY-1002', 21000, 650, 'available')
ON CONFLICT (license_no) DO NOTHING;

INSERT INTO routes (mine_id, factory_id, distance_km, expected_diesel_litres)
SELECT m.id, f.id, 320, 95
FROM mines m, factories f
WHERE m.name = 'Dhanbad Mine' AND f.name = 'Shakti Steel Plant'
ON CONFLICT (mine_id, factory_id) DO NOTHING;

INSERT INTO routes (mine_id, factory_id, distance_km, expected_diesel_litres)
SELECT m.id, f.id, 180, 55
FROM mines m, factories f
WHERE m.name = 'Korba Mine' AND f.name = 'Eastern Cement Works'
ON CONFLICT (mine_id, factory_id) DO NOTHING;

COMMIT;
