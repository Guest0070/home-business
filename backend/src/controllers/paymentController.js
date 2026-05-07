import { query, withTransaction } from '../config/db.js';
import { buildBankStatementHash } from '../services/bankStatementService.js';
import {
  buildReconciliationTemplateWorkbook,
  importReconciliationWorkbook,
  previewReconciliationWorkbook
} from '../services/reconciliationService.js';
import { ApiError } from '../utils/apiError.js';

async function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

export async function listPayments(req, res, next) {
  try {
    const values = [];
    const clauses = [];
    if (req.query.factoryId) {
      values.push(req.query.factoryId);
      clauses.push(`p.factory_id = $${values.length}`);
    }
    if (req.query.bankAccountId) {
      values.push(req.query.bankAccountId);
      clauses.push(`p.bank_account_id = $${values.length}`);
    }
    const result = await query(
      `SELECT p.*, f.name AS factory_name, dord.do_number, t.lr_number, v.vehicle_no, ba.account_name AS bank_account_name
       FROM payments p
       JOIN factories f ON f.id = p.factory_id
       LEFT JOIN delivery_orders dord ON dord.id = p.delivery_order_id
       LEFT JOIN trips t ON t.id = p.trip_id
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
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
      let bankAccountId = req.body.bank_account_id || null;

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
      if (bankAccountId) {
        const bankAccountResult = await client.query('SELECT id FROM bank_accounts WHERE id = $1', [bankAccountId]);
        if (!bankAccountResult.rows[0]) {
          throw new ApiError(400, 'Selected bank account was not found');
        }
      }

      const result = await client.query(
        `INSERT INTO payments (
          factory_id, delivery_order_id, bank_account_id, payment_date, amount,
          mode, reference_no, narration, notes, created_by, payment_type
        )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'receipt')
         RETURNING *`,
        [
          factoryId,
          deliveryOrderId,
          bankAccountId,
          req.body.payment_date,
          req.body.amount,
          req.body.mode,
          req.body.reference_no || null,
          req.body.narration || null,
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

      if (bankAccountId) {
        await client.query(
          `INSERT INTO bank_transactions (
            bank_account_id, entry_date, direction, amount, narration, reference_no,
            source_type, payment_id, statement_hash, created_by
          )
           VALUES ($1,$2,'credit',$3,$4,$5,'payment',$6,$7,$8)
           ON CONFLICT (statement_hash) DO NOTHING`,
          [
            bankAccountId,
            req.body.payment_date,
            req.body.amount,
            req.body.narration || req.body.notes || `Payment received`,
            req.body.reference_no || null,
            created.id,
            buildBankStatementHash(bankAccountId, {
              entry_date: req.body.payment_date,
              direction: 'credit',
              amount: Number(req.body.amount),
              narration: req.body.narration || req.body.notes || 'Payment received',
              reference_no: req.body.reference_no || null
            }),
            req.user.id
          ]
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

export async function deletePayment(req, res, next) {
  try {
    const removed = await withTransaction(async (client) => {
      const existing = await client.query(
        'SELECT * FROM payments WHERE id = $1',
        [req.params.id]
      );
      const payment = existing.rows[0];
      if (!payment) throw new ApiError(404, 'Payment not found');

      await client.query('DELETE FROM bank_transactions WHERE payment_id = $1', [req.params.id]);
      await client.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
      return payment;
    });

    res.json({
      mode: 'deleted',
      message: 'Payment removed successfully.',
      record: removed
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadReconciliationTemplate(_req, res, next) {
  try {
    await sendWorkbook(res, await buildReconciliationTemplateWorkbook(), 'shortage-reconciliation-template.xlsx');
  } catch (error) {
    next(error);
  }
}

export async function previewReconciliation(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'Upload an Excel .xlsx file');
    res.json(await previewReconciliationWorkbook(req.file.buffer));
  } catch (error) {
    next(error);
  }
}

export async function importReconciliation(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'Upload an Excel .xlsx file');
    res.json(await importReconciliationWorkbook(req.file.buffer, req.user.id));
  } catch (error) {
    next(error);
  }
}
