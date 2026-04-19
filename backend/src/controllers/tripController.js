import { query, withTransaction } from '../config/db.js';
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
    const created = await withTransaction(async (client) => {
      const routeResult = await client.query(
        `SELECT id, distance_km FROM routes WHERE mine_id = $1 AND factory_id = $2`,
        [req.body.mine_id, req.body.factory_id]
      );
      const route = routeResult.rows[0];
      if (!route) throw new ApiError(400, 'Create a route before creating a trip for this mine and factory');

      const vehicleResult = await client.query(
        `SELECT id, status FROM vehicles WHERE id = $1 AND is_active = TRUE`,
        [req.body.vehicle_id]
      );
      const vehicle = vehicleResult.rows[0];
      if (!vehicle) throw new ApiError(400, 'Selected vehicle was not found');
      if (vehicle.status === 'repair') throw new ApiError(400, 'Selected vehicle is under repair');

      let driverName = req.body.driver_name?.trim();
      if (req.body.driver_id) {
        const driverResult = await client.query(
          `SELECT id, name, status FROM drivers WHERE id = $1 AND is_active = TRUE`,
          [req.body.driver_id]
        );
        const driver = driverResult.rows[0];
        if (!driver) throw new ApiError(400, 'Selected driver was not found');
        if (driver.status === 'vacation' || driver.status === 'inactive') {
          throw new ApiError(400, `Selected driver is ${driver.status}`);
        }
        driverName = driver.name;
      }

      const tripResult = await client.query(
        `INSERT INTO trips (
          trip_date, lr_number, vehicle_id, driver_id, driver_name, mine_id, factory_id,
          route_id, distance_km, weight_tons, rate_per_ton, notes, created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING *`,
        [
          req.body.trip_date,
          req.body.lr_number,
          req.body.vehicle_id,
          req.body.driver_id || null,
          driverName,
          req.body.mine_id,
          req.body.factory_id,
          route.id,
          route.distance_km,
          req.body.weight_tons,
          req.body.rate_per_ton,
          req.body.notes || null,
          req.user.id
        ]
      );

      const trip = tripResult.rows[0];
      const expense = req.body.expense || {};
      await client.query(
        `INSERT INTO expenses (trip_id, diesel_litres, diesel_cost, driver_allowance, toll, other_expenses)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          trip.id,
          expense.diesel_litres || 0,
          expense.diesel_cost || 0,
          expense.driver_allowance || 0,
          expense.toll || 0,
          expense.other_expenses || 0
        ]
      );

      if (req.body.driver_id) {
        await client.query(
          `UPDATE drivers
           SET status = 'on_duty', current_vehicle_id = $1, vacation_from = NULL, vacation_to = NULL, updated_at = NOW()
           WHERE id = $2`,
          [req.body.vehicle_id, req.body.driver_id]
        );
      }

      await client.query(
        `UPDATE vehicles SET status = 'on_trip' WHERE id = $1 AND status <> 'repair'`,
        [req.body.vehicle_id]
      );

      const financialResult = await client.query('SELECT * FROM trip_financials WHERE id = $1', [trip.id]);
      return financialResult.rows[0];
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}
