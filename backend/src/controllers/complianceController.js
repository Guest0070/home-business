import { query } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

export async function getComplianceSummary(_req, res, next) {
  try {
    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE reminder_state = 'overdue')::INT AS overdue,
        COUNT(*) FILTER (WHERE reminder_state = 'due_soon')::INT AS due_soon,
        COUNT(*) FILTER (WHERE reminder_state = 'ok')::INT AS active,
        COUNT(*)::INT AS total
       FROM compliance_reminders
       WHERE status <> 'completed'`
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function listComplianceItems(req, res, next) {
  try {
    const values = [];
    const clauses = [];

    if (req.query.vehicleId) {
      values.push(req.query.vehicleId);
      clauses.push(`vehicle_id = $${values.length}`);
    }
    if (req.query.from) {
      values.push(req.query.from);
      clauses.push(`due_date >= $${values.length}`);
    }
    if (req.query.to) {
      values.push(req.query.to);
      clauses.push(`due_date <= $${values.length}`);
    }

    const result = await query(
      `SELECT *
       FROM compliance_reminders
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY due_date ASC, vehicle_no`,
      values
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createComplianceItem(req, res, next) {
  try {
    const vehicleResult = await query('SELECT id FROM vehicles WHERE id = $1', [req.body.vehicle_id]);
    if (!vehicleResult.rows[0]) throw new ApiError(400, 'Selected vehicle was not found');

    const result = await query(
      `INSERT INTO vehicle_compliance_items (
        vehicle_id, document_type, reference_no, provider_name, issue_date, due_date, reminder_days, status, notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        req.body.vehicle_id,
        req.body.document_type,
        req.body.reference_no || null,
        req.body.provider_name || null,
        req.body.issue_date || null,
        req.body.due_date,
        req.body.reminder_days ?? 15,
        req.body.status || 'active',
        req.body.notes || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateComplianceItem(req, res, next) {
  try {
    const result = await query(
      `UPDATE vehicle_compliance_items
       SET document_type = $1,
        reference_no = $2,
        provider_name = $3,
        issue_date = $4,
        due_date = $5,
        reminder_days = $6,
        status = $7,
        notes = $8,
        updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        req.body.document_type,
        req.body.reference_no || null,
        req.body.provider_name || null,
        req.body.issue_date || null,
        req.body.due_date,
        req.body.reminder_days ?? 15,
        req.body.status || 'active',
        req.body.notes || null,
        req.params.id
      ]
    );
    if (!result.rows[0]) throw new ApiError(404, 'Compliance item not found');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteComplianceItem(req, res, next) {
  try {
    const result = await query(
      `DELETE FROM vehicle_compliance_items
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) throw new ApiError(404, 'Compliance item not found');
    res.json({
      mode: 'deleted',
      message: 'Compliance reminder removed successfully.',
      record: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
}
