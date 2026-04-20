import { query } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

const wheelseyePortalUrl = process.env.WHEELSEYE_PORTAL_URL || 'https://wheelseye.com/portal/';

export async function listGpsVehicles(_req, res, next) {
  try {
    const result = await query(
      `SELECT
        v.id,
        v.vehicle_no,
        v.ownership,
        v.status,
        v.is_active,
        v.gps_provider,
        v.gps_vehicle_ref,
        last_trip.trip_date AS last_trip_date,
        last_trip.driver_name AS last_driver_name
       FROM vehicles v
       LEFT JOIN LATERAL (
        SELECT trip_date, driver_name
        FROM trip_financials tf
        WHERE tf.vehicle_id = v.id
        ORDER BY tf.trip_date DESC, tf.created_at DESC
        LIMIT 1
       ) AS last_trip ON TRUE
       ORDER BY v.vehicle_no`
    );

    res.json({
      provider: 'wheelseye',
      mode: 'portal',
      portalUrl: wheelseyePortalUrl,
      apiReady: Boolean(process.env.WHEELSEYE_API_BASE_URL && process.env.WHEELSEYE_API_TOKEN),
      vehicles: result.rows
    });
  } catch (error) {
    next(error);
  }
}

export async function updateGpsConfig(req, res, next) {
  try {
    const result = await query(
      `UPDATE vehicles
       SET gps_provider = $1,
        gps_vehicle_ref = $2
       WHERE id = $3
       RETURNING *`,
      [
        req.body.gps_provider || null,
        req.body.gps_vehicle_ref?.trim() || null,
        req.params.id
      ]
    );

    if (!result.rows[0]) throw new ApiError(404, 'Vehicle not found');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}
