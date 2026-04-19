import { query } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

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
      `SELECT d.*, v.vehicle_no AS current_vehicle_no,
        COALESCE(dp.total_trips, 0) AS total_trips,
        COALESCE(dp.total_profit, 0) AS total_profit,
        dp.average_profit,
        dp.mileage,
        COALESCE(dp.abnormal_diesel_trips, 0) AS abnormal_diesel_trips
       FROM drivers d
       LEFT JOIN vehicles v ON v.id = d.current_vehicle_id
       LEFT JOIN driver_performance dp ON LOWER(dp.driver_name) = LOWER(d.name)
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

export async function createDriver(req, res, next) {
  try {
    const result = await query(
      `INSERT INTO drivers (
        name, phone, license_no, salary, per_trip_allowance, status,
        current_vehicle_id, vacation_from, vacation_to, notes, is_active
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        req.body.name.trim(),
        req.body.phone || null,
        req.body.license_no || null,
        req.body.salary || 0,
        req.body.per_trip_allowance || 0,
        req.body.status || 'available',
        req.body.current_vehicle_id || null,
        req.body.vacation_from || null,
        req.body.vacation_to || null,
        req.body.notes || null,
        req.body.is_active ?? true
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
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

    const result = await query(
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

    if (!result.rows[0]) throw new ApiError(404, 'Driver not found');
    res.json(result.rows[0]);
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
        per_trip_allowance = $5,
        current_vehicle_id = $6,
        notes = $7,
        is_active = $8,
        updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        req.body.name.trim(),
        req.body.phone || null,
        req.body.license_no || null,
        req.body.salary || 0,
        req.body.per_trip_allowance || 0,
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

