import { query } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

export async function listRoutes(_req, res, next) {
  try {
    const result = await query(
      `SELECT r.*, m.name AS mine_name, f.name AS factory_name
       FROM routes r
       JOIN mines m ON m.id = r.mine_id
       JOIN factories f ON f.id = r.factory_id
       ORDER BY m.name, f.name`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createRoute(req, res, next) {
  try {
    const result = await query(
      `INSERT INTO routes (mine_id, factory_id, distance_km, expected_diesel_litres)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.body.mine_id, req.body.factory_id, req.body.distance_km, req.body.expected_diesel_litres || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function getDistance(req, res, next) {
  try {
    const result = await query(
      `SELECT id AS route_id, distance_km, expected_diesel_litres
       FROM routes
       WHERE mine_id = $1 AND factory_id = $2`,
      [req.query.mineId, req.query.factoryId]
    );
    if (!result.rows[0]) throw new ApiError(404, 'No route configured for selected mine and factory');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

