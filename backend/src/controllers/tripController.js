import { query, withTransaction } from '../config/db.js';
import { saveTripFromPayload } from '../services/tripService.js';
import { ApiError } from '../utils/apiError.js';

function buildTripFilters(filters) {
  const clauses = [];
  const values = [];

  const add = (sql, value) => {
    values.push(value);
    clauses.push(sql.replace('?', `$${values.length}`));
  };

  if (filters.from) add('trip_date >= ?', filters.from);
  if (filters.to) add('trip_date <= ?', filters.to);
  if (filters.driver) add('LOWER(driver_name) LIKE LOWER(?)', `%${filters.driver}%`);
  if (filters.factoryId) add('factory_id = ?', filters.factoryId);
  if (filters.vehicleId) add('vehicle_id = ?', filters.vehicleId);

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values
  };
}

export async function listTrips(req, res, next) {
  try {
    const { where, values } = buildTripFilters(req.query);
    const result = await query(
      `SELECT *
       FROM trip_financials
       ${where}
       ORDER BY trip_date DESC, created_at DESC
       LIMIT 300`,
      values
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getTrip(req, res, next) {
  try {
    const result = await query('SELECT * FROM trip_financials WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) throw new ApiError(404, 'Trip not found');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function createTrip(req, res, next) {
  try {
    const saved = await withTransaction((client) => saveTripFromPayload(client, req.body, req.user.id));
    res.status(saved.action === 'create' ? 201 : 200).json(saved.trip);
  } catch (error) {
    next(error);
  }
}

export async function listTripHalts(req, res, next) {
  try {
    const result = await query(
      `SELECT h.*, t.lr_number, t.trip_date, v.vehicle_no, t.driver_name
       FROM trip_halt_logs h
       JOIN trips t ON t.id = h.trip_id
       JOIN vehicles v ON v.id = t.vehicle_id
       WHERE h.trip_id = $1
       ORDER BY h.started_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createTripHalt(req, res, next) {
  try {
    const result = await withTransaction(async (client) => {
      const trip = await client.query('SELECT id FROM trips WHERE id = $1', [req.params.id]);
      if (!trip.rows[0]) throw new ApiError(404, 'Trip not found');

      const created = await client.query(
        `INSERT INTO trip_halt_logs (trip_id, halt_type, started_at, location, notes, reported_by)
         VALUES ($1,$2,COALESCE($3::timestamptz, NOW()),$4,$5,$6)
         RETURNING *`,
        [
          req.params.id,
          req.body.halt_type || 'breakdown',
          req.body.started_at || null,
          req.body.location || null,
          req.body.notes || null,
          req.user.id
        ]
      );
      return created.rows[0];
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function closeTripHalt(req, res, next) {
  try {
    const result = await query(
      `UPDATE trip_halt_logs
       SET ended_at = COALESCE($1::timestamptz, NOW()),
        notes = COALESCE($2, notes)
       WHERE id = $3 AND trip_id = $4
       RETURNING *`,
      [req.body.ended_at || null, req.body.notes || null, req.params.haltId, req.params.id]
    );
    if (!result.rows[0]) throw new ApiError(404, 'Halt log not found');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}
