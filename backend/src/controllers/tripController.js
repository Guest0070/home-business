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
