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
        do_number, issue_date, mine_id, factory_id, total_tons, rate_per_ton,
        dispatch_target_date, valid_until, broker_name, priority,
        status, notes, created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        req.body.do_number.trim(),
        req.body.issue_date,
        req.body.mine_id || null,
        req.body.factory_id || null,
        req.body.total_tons,
        req.body.rate_per_ton || null,
        req.body.dispatch_target_date || null,
        req.body.valid_until || null,
        req.body.broker_name || null,
        req.body.priority || null,
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

export async function updateDeliveryOrder(req, res, next) {
  try {
    const result = await query(
      `UPDATE delivery_orders
       SET do_number = $1,
        issue_date = $2,
        mine_id = $3,
        factory_id = $4,
        total_tons = $5,
        rate_per_ton = $6,
        dispatch_target_date = $7,
        valid_until = $8,
        broker_name = $9,
        priority = $10,
        status = $11,
        notes = $12,
        updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        req.body.do_number.trim(),
        req.body.issue_date,
        req.body.mine_id || null,
        req.body.factory_id || null,
        req.body.total_tons,
        req.body.rate_per_ton || null,
        req.body.dispatch_target_date || null,
        req.body.valid_until || null,
        req.body.broker_name || null,
        req.body.priority || null,
        req.body.status || 'open',
        req.body.notes || null,
        req.params.id
      ]
    );

    if (!result.rows[0]) throw new ApiError(404, 'Delivery order not found');
    res.json(result.rows[0]);
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

export async function deleteDeliveryOrder(req, res, next) {
  try {
    const linked = await query(
      `SELECT
        (SELECT COUNT(*)::INT FROM trips WHERE delivery_order_id = $1) AS trip_count,
        (SELECT COUNT(*)::INT FROM payments WHERE delivery_order_id = $1) AS payment_count`,
      [req.params.id]
    );

    const row = linked.rows[0];
    if (Number(row?.trip_count || 0) > 0 || Number(row?.payment_count || 0) > 0) {
      throw new ApiError(400, 'This delivery order is already linked to trips or payments, so it cannot be removed.');
    }

    const result = await query(
      `DELETE FROM delivery_orders
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) throw new ApiError(404, 'Delivery order not found');
    res.json({
      mode: 'deleted',
      message: 'Delivery order removed successfully.',
      record: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
}
