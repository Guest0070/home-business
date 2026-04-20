import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

export async function listPayments(req, res, next) {
  try {
    const values = [];
    const clauses = [];
    if (req.query.factoryId) {
      values.push(req.query.factoryId);
      clauses.push(`p.factory_id = $${values.length}`);
    }
    const result = await query(
      `SELECT p.*, f.name AS factory_name, dord.do_number
       FROM payments p
       JOIN factories f ON f.id = p.factory_id
       LEFT JOIN delivery_orders dord ON dord.id = p.delivery_order_id
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY p.payment_date DESC, p.created_at DESC`,
      values
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createPayment(req, res, next) {
  try {
    const payment = await withTransaction(async (client) => {
      let factoryId = req.body.factory_id || null;
      let deliveryOrderId = req.body.delivery_order_id || null;

      if (deliveryOrderId) {
        const orderResult = await client.query(
          `SELECT id, do_number, factory_id
           FROM delivery_orders
           WHERE id = $1`,
          [deliveryOrderId]
        );
        const order = orderResult.rows[0];
        if (!order) throw new ApiError(400, 'Selected delivery order was not found');
        if (!order.factory_id) throw new ApiError(400, 'Selected delivery order does not have a party assigned');
        if (factoryId && factoryId !== order.factory_id) {
          throw new ApiError(400, 'Selected party does not match the delivery order party');
        }
        factoryId = order.factory_id;
      }

      if (!factoryId) {
        throw new ApiError(400, 'Select a party or delivery order before saving payment');
      }

      const result = await client.query(
        `INSERT INTO payments (factory_id, delivery_order_id, payment_date, amount, mode, reference_no, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          factoryId,
          deliveryOrderId,
          req.body.payment_date,
          req.body.amount,
          req.body.mode,
          req.body.reference_no || null,
          req.body.notes || null,
          req.user.id
        ]
      );

      const created = result.rows[0];
      const allocationTotal = (req.body.allocations || []).reduce((sum, row) => sum + Number(row.amount), 0);
      if (allocationTotal > Number(req.body.amount)) {
        throw new ApiError(400, 'Allocated amount cannot exceed payment amount');
      }

      for (const row of req.body.allocations || []) {
        await client.query(
          `INSERT INTO payment_trip_allocations (payment_id, trip_id, amount)
           VALUES ($1,$2,$3)`,
          [created.id, row.trip_id, row.amount]
        );
      }

      return created;
    });

    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
}

export async function getLedger(_req, res, next) {
  try {
    const result = await query('SELECT * FROM party_ledger ORDER BY pending_balance DESC, factory_name');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}
