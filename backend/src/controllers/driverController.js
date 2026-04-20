import { query, withTransaction } from '../config/db.js';
import { appendDriverStatusHistory, todayDate } from '../services/driverStatusService.js';
import { ApiError } from '../utils/apiError.js';

async function createDriverRecord(client, payload) {
  const result = await client.query(
    `INSERT INTO drivers (
      name, phone, license_no, salary, per_trip_allowance, status,
      current_vehicle_id, vacation_from, vacation_to, notes, is_active
     )
     VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      payload.name.trim(),
      payload.phone || null,
      payload.license_no || null,
      payload.salary || 0,
      payload.status || 'available',
      payload.current_vehicle_id || null,
      payload.vacation_from || null,
      payload.vacation_to || null,
      payload.notes || null,
      payload.is_active ?? true
    ]
  );

  const driver = result.rows[0];
  await appendDriverStatusHistory(client, {
    driverId: driver.id,
    status: driver.status,
    startDate: driver.status === 'vacation' ? (driver.vacation_from || todayDate()) : todayDate(),
    endDate: driver.status === 'vacation' ? driver.vacation_to : null,
    notes: driver.notes
  });
  return driver;
}

export async function listDrivers(req, res, next) {
  try {
    const clauses = [];
    const values = [];
    if (req.query.status) {
      values.push(req.query.status);
      clauses.push(`d.status = $${values.length}`);
    }
    if (req.query.activeOnly === 'true') {
      clauses.push('d.is_active = TRUE');
    }

    const result = await query(
      `WITH history_totals AS (
        SELECT
          driver_id,
          COALESCE(SUM(
            CASE
              WHEN status IN ('available', 'on_duty')
              THEN (COALESCE(end_date, CURRENT_DATE) - start_date + 1)
              ELSE 0
            END
          ), 0)::INT AS active_days,
          COALESCE(SUM(
            CASE
              WHEN status = 'vacation'
              THEN (COALESCE(end_date, CURRENT_DATE) - start_date + 1)
              ELSE 0
            END
          ), 0)::INT AS vacation_days
        FROM driver_status_history
        GROUP BY driver_id
      )
      SELECT d.*, v.vehicle_no AS current_vehicle_no,
        COALESCE(dp.total_trips, 0) AS total_trips,
        COALESCE(dp.total_profit, 0) AS total_profit,
        dp.average_profit,
        dp.mileage,
        COALESCE(dp.abnormal_diesel_trips, 0) AS abnormal_diesel_trips,
        COALESCE(ht.active_days, 0) AS active_days,
        COALESCE(ht.vacation_days, 0) AS vacation_days
       FROM drivers d
       LEFT JOIN vehicles v ON v.id = d.current_vehicle_id
       LEFT JOIN driver_performance dp ON dp.driver_id = d.id OR LOWER(dp.driver_name) = LOWER(d.name)
       LEFT JOIN history_totals ht ON ht.driver_id = d.id
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY
        CASE d.status
          WHEN 'available' THEN 1
          WHEN 'on_duty' THEN 2
          WHEN 'vacation' THEN 3
          ELSE 4
        END,
        d.name`,
      values
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function listDriverHistory(_req, res, next) {
  try {
    const result = await query(
      `SELECT h.id, h.driver_id, d.name AS driver_name, h.status, h.start_date, h.end_date, h.notes
       FROM driver_status_history h
       JOIN drivers d ON d.id = h.driver_id
       ORDER BY d.name, h.start_date DESC, h.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createDriver(req, res, next) {
  try {
    const driver = await withTransaction((client) => createDriverRecord(client, req.body));
    res.status(201).json(driver);
  } catch (error) {
    next(error);
  }
}

export async function createDriverFromName(client, name) {
  const trimmed = name?.trim();
  if (!trimmed) throw new ApiError(400, 'Driver name is required');

  const existing = await client.query(
    `SELECT * FROM drivers WHERE LOWER(name) = LOWER($1) AND is_active = TRUE ORDER BY created_at ASC LIMIT 1`,
    [trimmed]
  );
  if (existing.rows[0]) return existing.rows[0];

  return createDriverRecord(client, { name: trimmed, status: 'available' });
}

export async function updateDriverStatus(req, res, next) {
  try {
    const status = req.body.status;
    const vacationFrom = status === 'vacation' ? req.body.vacation_from : null;
    const vacationTo = status === 'vacation' ? req.body.vacation_to : null;
    const currentVehicleId = status === 'on_duty' ? req.body.current_vehicle_id || null : req.body.current_vehicle_id || null;

    if (status === 'vacation' && (!vacationFrom || !vacationTo)) {
      throw new ApiError(400, 'Vacation requires from and to dates');
    }

    const updated = await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE drivers
         SET status = $1,
          current_vehicle_id = $2,
          vacation_from = $3,
          vacation_to = $4,
          notes = COALESCE($5, notes),
          updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [status, currentVehicleId, vacationFrom, vacationTo, req.body.notes || null, req.params.id]
      );

      const driver = result.rows[0];
      if (!driver) throw new ApiError(404, 'Driver not found');

      await appendDriverStatusHistory(client, {
        driverId: driver.id,
        status,
        startDate: status === 'vacation' ? vacationFrom : todayDate(),
        endDate: status === 'vacation' ? vacationTo : null,
        notes: req.body.notes || null
      });

      return driver;
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function updateDriver(req, res, next) {
  try {
    const result = await query(
      `UPDATE drivers
       SET name = $1,
        phone = $2,
        license_no = $3,
        salary = $4,
        per_trip_allowance = 0,
        current_vehicle_id = $5,
        notes = $6,
        is_active = $7,
        updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        req.body.name.trim(),
        req.body.phone || null,
        req.body.license_no || null,
        req.body.salary || 0,
        req.body.current_vehicle_id || null,
        req.body.notes || null,
        req.body.is_active ?? true,
        req.params.id
      ]
    );
    if (!result.rows[0]) throw new ApiError(404, 'Driver not found');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}
