import { query } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

export async function listDeliveryOrders(_req, res, next) {
  try {
    const result = await query(
      `SELECT *
       FROM delivery_order_progress
       ORDER BY
        CASE status WHEN 'open' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
        issue_date DESC,
        do_number DESC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createDeliveryOrder(req, res, next) {
  try {
    const result = await query(
      `INSERT INTO delivery_orders (
        do_number, issue_date, mine_id, factory_id, total_tons, rate_per_ton, status, notes, created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        req.body.do_number.trim(),
        req.body.issue_date,
        req.body.mine_id || null,
        req.body.factory_id || null,
        req.body.total_tons,
        req.body.rate_per_ton || null,
        req.body.status || 'open',
        req.body.notes || null,
        req.user.id
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function getDeliveryOrder(req, res, next) {
  try {
    const orderResult = await query('SELECT * FROM delivery_order_progress WHERE id = $1', [req.params.id]);
    const order = orderResult.rows[0];
    if (!order) throw new ApiError(404, 'Delivery order not found');

    const tripsResult = await query(
      `SELECT id, trip_date, lr_number, vehicle_no, driver_name, weight_tons, freight, total_expense, profit
       FROM trip_financials
       WHERE delivery_order_id = $1
       ORDER BY trip_date DESC, created_at DESC`,
      [req.params.id]
    );

    res.json({ ...order, trips: tripsResult.rows });
  } catch (error) {
    next(error);
  }
}
