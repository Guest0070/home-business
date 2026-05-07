import { query } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

const allowedMasters = {
  vehicles: {
    table: 'vehicles',
    label: 'Vehicle',
    order: 'vehicle_no',
    create: ['vehicle_no', 'ownership', 'owner_name', 'chassis_last5', 'status', 'is_active'],
    hasActive: true
  },
  mines: {
    table: 'mines',
    label: 'Mine',
    order: 'name',
    create: ['name', 'location', 'is_active'],
    hasActive: true
  },
  factories: {
    table: 'factories',
    label: 'Factory',
    order: 'name',
    create: ['name', 'contact_name', 'phone', 'address', 'is_active'],
    hasActive: true
  }
};

export function listMaster(kind) {
  return async (req, res, next) => {
    try {
      const config = allowedMasters[kind];
      const where = config.hasActive && req.query.includeInactive !== 'true'
        ? 'WHERE is_active = TRUE'
        : '';
      if (kind === 'vehicles') {
        const result = await query(
          `WITH dispatch_docs AS (
            SELECT
              vehicle_id,
              MIN(due_date) FILTER (WHERE document_type IN ('pollution_certificate', 'all_india_permit') AND status <> 'completed') AS next_dispatch_doc_due,
              COUNT(*) FILTER (
                WHERE document_type IN ('pollution_certificate', 'all_india_permit')
                  AND status <> 'completed'
                  AND due_date <= CURRENT_DATE + INTERVAL '2 days'
              )::INT AS hard_block_count,
              COUNT(*) FILTER (
                WHERE document_type IN ('pollution_certificate', 'all_india_permit')
                  AND status <> 'completed'
                  AND due_date > CURRENT_DATE + INTERVAL '2 days'
                  AND due_date <= CURRENT_DATE + INTERVAL '7 days'
              )::INT AS warning_count
            FROM vehicle_compliance_items
            GROUP BY vehicle_id
          )
          SELECT
            v.*,
            d.next_dispatch_doc_due,
            CASE
              WHEN COALESCE(d.hard_block_count, 0) > 0 THEN 'blocked'
              WHEN COALESCE(d.warning_count, 0) > 0 THEN 'warning'
              ELSE 'clear'
            END AS dispatch_compliance_status,
            CASE
              WHEN COALESCE(d.hard_block_count, 0) > 0 THEN 'PUCC or All India Permit expires within 48 hours'
              WHEN COALESCE(d.warning_count, 0) > 0 THEN 'PUCC or All India Permit expires within 7 days'
              ELSE NULL
            END AS dispatch_compliance_reason
          FROM vehicles v
          LEFT JOIN dispatch_docs d ON d.vehicle_id = v.id
          ${where ? 'WHERE v.is_active = TRUE' : ''}
          ORDER BY v.vehicle_no`
        );
        res.json(result.rows);
        return;
      }
      const result = await query(`SELECT * FROM ${config.table} ${where} ORDER BY ${config.order}`);
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  };
}

export function createMaster(kind) {
  return async (req, res, next) => {
    try {
      const config = allowedMasters[kind];
      const values = config.create.map((field) => {
        const value = req.body[field];
        return value === '' ? null : (value ?? null);
      });
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      const result = await query(
        `INSERT INTO ${config.table} (${config.create.join(', ')})
         VALUES (${placeholders})
         RETURNING *`,
        values
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  };
}

export async function updateVehicleStatus(req, res, next) {
  try {
    const result = await query(
      `UPDATE vehicles
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [req.body.status, req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export function deleteMaster(kind) {
  return async (req, res, next) => {
    try {
      const config = allowedMasters[kind];
      if (!config) throw new ApiError(404, 'Master type not supported');

      if (kind === 'vehicles') {
        const linkedTrips = await query(
          'SELECT COUNT(*)::INT AS count FROM trips WHERE vehicle_id = $1',
          [req.params.id]
        );

        if (Number(linkedTrips.rows[0]?.count || 0) > 0) {
          const archived = await query(
            `UPDATE vehicles
             SET is_active = FALSE,
              status = 'repair',
              updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [req.params.id]
          );
          if (!archived.rows[0]) throw new ApiError(404, 'Vehicle not found');
          return res.json({
            mode: 'archived',
            message: 'Vehicle has trip history, so it was archived instead of being fully deleted.',
            record: archived.rows[0]
          });
        }
      }

      const result = await query(
        `DELETE FROM ${config.table}
         WHERE id = $1
         RETURNING *`,
        [req.params.id]
      );

      if (!result.rows[0]) throw new ApiError(404, 'Record not found');
      res.json({
        mode: 'deleted',
        message: `${config.label} removed successfully.`,
        record: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  };
}
