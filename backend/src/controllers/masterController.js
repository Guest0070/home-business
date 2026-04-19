import { query } from '../config/db.js';

const allowedMasters = {
  vehicles: {
    table: 'vehicles',
    order: 'vehicle_no',
    create: ['vehicle_no', 'ownership', 'owner_name', 'status', 'is_active']
  },
  mines: {
    table: 'mines',
    order: 'name',
    create: ['name', 'location', 'is_active']
  },
  factories: {
    table: 'factories',
    order: 'name',
    create: ['name', 'contact_name', 'phone', 'address', 'is_active']
  }
};

export function listMaster(kind) {
  return async (_req, res, next) => {
    try {
      const config = allowedMasters[kind];
      const result = await query(`SELECT * FROM ${config.table} ORDER BY ${config.order}`);
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
      const values = config.create.map((field) => req.body[field] ?? null);
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
