import { query } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

function normalizeDateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function buildDateWhere(column, filters = {}, timestampColumn = null) {
  const values = [];
  const clauses = [];

  if (filters.from_at) {
    values.push(timestampColumn ? filters.from_at : normalizeDateOnly(filters.from_at));
    clauses.push(`${timestampColumn || column} >= $${values.length}`);
  } else if (filters.from) {
    values.push(filters.from);
    clauses.push(`${column} >= $${values.length}`);
  }

  if (filters.to_at) {
    values.push(timestampColumn ? filters.to_at : normalizeDateOnly(filters.to_at));
    clauses.push(`${timestampColumn || column} <= $${values.length}`);
  } else if (filters.to) {
    values.push(filters.to);
    clauses.push(`${column} <= $${values.length}`);
  }

  return {
    values,
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  };
}

function formatDateValue(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    if (value === null || value === undefined) return '';
    const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))
  ].join('\n');
}

function mapSalesBookPreset(kind, rows) {
  if (kind === 'payments') {
    return rows.map((row) => ({
      Date: formatDateValue(row.payment_date),
      Customer: row.factory_name,
      'Deposit To': row.bank_account_name || '',
      'Payment Number': row.reference_no || row.id,
      'Reference Number': row.do_number || '',
      Amount: row.amount,
      Description: row.narration || row.notes || '',
      'Mode': row.mode
    }));
  }

  if (kind === 'bank-transactions') {
    return rows.map((row) => ({
      Date: formatDateValue(row.entry_date),
      Account: row.zoho_account_name || row.account_name,
      Description: row.narration,
      Deposits: row.direction === 'credit' ? row.amount : '',
      Withdrawals: row.direction === 'debit' ? row.amount : '',
      Reference: row.reference_no || '',
      Balance: row.balance_after || ''
    }));
  }

  return rows;
}

function mapLedgerVoucherPreset(kind, rows) {
  if (kind === 'payments') {
    return rows.map((row) => ({
      Date: formatDateValue(row.payment_date),
      'Voucher Type': 'Receipt',
      'Ledger Name': row.tally_ledger_name || row.bank_account_name || row.factory_name,
      'Contra Ledger': row.factory_name,
      Amount: row.amount,
      'Dr/Cr': 'Cr',
      Narration: row.narration || row.notes || '',
      Reference: row.reference_no || row.do_number || ''
    }));
  }

  if (kind === 'bank-transactions') {
    return rows.map((row) => ({
      Date: formatDateValue(row.entry_date),
      'Voucher Type': row.direction === 'credit' ? 'Receipt' : 'Payment',
      'Ledger Name': row.tally_ledger_name || row.account_name,
      Amount: row.amount,
      'Dr/Cr': row.direction === 'credit' ? 'Cr' : 'Dr',
      Narration: row.narration,
      Reference: row.reference_no || ''
    }));
  }

  if (kind === 'loan-installments') {
    return rows.map((row) => ({
      Date: formatDateValue(row.due_date),
      'Voucher Type': 'Journal',
      'Ledger Name': row.tally_ledger_name || row.loan_name,
      Amount: row.amount,
      'Dr/Cr': row.status === 'paid' ? 'Cr' : 'Dr',
      Narration: row.narration || row.notes || '',
      Reference: row.lender_name
    }));
  }

  return rows;
}

export function applyExportPreset(kind, rows, preset = 'standard') {
  const normalizedPreset = String(preset || 'standard').toLowerCase();
  if (normalizedPreset === 'zoho' || normalizedPreset === 'sales-book') {
    return mapSalesBookPreset(kind, rows);
  }
  if (normalizedPreset === 'tally' || normalizedPreset === 'ledger-voucher') {
    return mapLedgerVoucherPreset(kind, rows);
  }
  return rows;
}

export async function loadDataset(kind, filters = {}) {
  if (kind === 'trip-profit') {
    const { where, values } = buildDateWhere('trip_date', filters, 'created_at');
    return query(`SELECT * FROM trip_financials ${where} ORDER BY trip_date DESC, created_at DESC`, values).then((result) => result.rows);
  }

  if (kind === 'truck-profit') {
    const { where, values } = buildDateWhere('trip_date', filters, 'created_at');
    return query(
      `SELECT vehicle_id, vehicle_no, ownership, COUNT(*)::INT AS trips,
        ROUND(SUM(freight), 2) AS freight,
        ROUND(SUM(total_expense), 2) AS expenses,
        ROUND(SUM(profit), 2) AS profit,
        ROUND(SUM(distance_km), 2) AS distance_km
       FROM trip_financials
       ${where}
       GROUP BY vehicle_id, vehicle_no, ownership
       ORDER BY profit DESC`,
      values
    ).then((result) => result.rows);
  }

  if (kind === 'driver-performance') {
    const { where, values } = buildDateWhere('trip_date', filters, 'created_at');
    return query(
      `SELECT
        driver_id,
        driver_name,
        COUNT(*)::INT AS total_trips,
        ROUND(SUM(profit), 2) AS total_profit,
        ROUND(AVG(profit), 2) AS average_profit,
        ROUND(SUM(distance_km) / NULLIF(SUM(diesel_litres), 0), 2) AS mileage,
        COUNT(*) FILTER (WHERE abnormal_diesel)::INT AS abnormal_diesel_trips
       FROM trip_financials
       ${where}
       GROUP BY driver_id, driver_name
       ORDER BY total_profit DESC, mileage DESC NULLS LAST`,
      values
    ).then((result) => result.rows);
  }

  if (kind === 'diesel-usage') {
    const { where, values } = buildDateWhere('trip_date', filters, 'created_at');
    return query(
      `SELECT lr_number, trip_date, vehicle_no, driver_name, mine_name, factory_name,
        distance_km, diesel_litres, mileage, abnormal_diesel
       FROM trip_financials
       ${where}
       ORDER BY abnormal_diesel DESC, trip_date DESC`,
      values
    ).then((result) => result.rows);
  }

  if (kind === 'delivery-orders') {
    const { where, values } = buildDateWhere('issue_date', filters, 'created_at');
    return query(
      `SELECT *
       FROM delivery_order_progress
       ${where}
       ORDER BY issue_date DESC, do_number DESC`,
      values
    ).then((result) => result.rows);
  }

  if (kind === 'payments') {
    const { where, values } = buildDateWhere('p.payment_date', filters, 'p.created_at');
    return query(
      `SELECT
        p.id,
        p.payment_date,
        p.amount,
        p.mode,
        p.reference_no,
        p.notes,
        p.narration,
        f.name AS factory_name,
        dord.do_number,
        ba.account_name AS bank_account_name,
        ba.zoho_account_name,
        ba.tally_ledger_name
       FROM payments p
       JOIN factories f ON f.id = p.factory_id
       LEFT JOIN delivery_orders dord ON dord.id = p.delivery_order_id
       LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
       ${where}
       ORDER BY p.payment_date DESC, p.created_at DESC`,
      values
    ).then((result) => result.rows);
  }

  if (kind === 'salary-payments') {
    const { where, values } = buildDateWhere('p.payment_date', filters, 'p.created_at');
    return query(
      `SELECT
        p.id,
        p.payment_date,
        p.amount,
        p.reference_no,
        p.narration,
        p.notes,
        d.name AS driver_name,
        d.salary AS driver_salary
       FROM driver_salary_payments p
       JOIN drivers d ON d.id = p.driver_id
       ${where}
       ORDER BY p.payment_date DESC, p.created_at DESC`,
      values
    ).then((result) => result.rows);
  }

  if (kind === 'bank-transactions') {
    const { where, values } = buildDateWhere('t.entry_date', filters, 't.created_at');
    return query(
      `SELECT
        t.id,
        t.entry_date,
        t.value_date,
        t.direction,
        t.amount,
        t.narration,
        t.reference_no,
        t.balance_after,
        t.source_type,
        a.account_name,
        a.bank_name,
        a.zoho_account_name,
        a.tally_ledger_name
       FROM bank_transactions t
       JOIN bank_accounts a ON a.id = t.bank_account_id
       ${where}
       ORDER BY t.entry_date DESC, t.created_at DESC`,
      values
    ).then((result) => result.rows);
  }

  if (kind === 'bank-accounts') {
    return query(
      `SELECT
        bank_account_id AS id,
        account_name,
        bank_name,
        account_holder_name,
        account_number_last4,
        ifsc_code,
        opening_balance,
        current_balance,
        zoho_account_name,
        tally_ledger_name
       FROM bank_account_balances
       ORDER BY account_name, bank_name`
    ).then((result) => result.rows);
  }

  if (kind === 'bank-loans') {
    const { where, values } = buildDateWhere('COALESCE(next_installment_due, next_due_date)', filters);
    return query(
      `SELECT *
       FROM loan_schedule_status
       ${where}
       ORDER BY next_installment_due NULLS LAST, lender_name, loan_name`,
      values
    ).then((result) => result.rows);
  }

  if (kind === 'loan-installments') {
    const { where, values } = buildDateWhere('i.due_date', filters, 'i.created_at');
    return query(
      `SELECT
        i.id,
        i.due_date,
        i.amount,
        i.status,
        i.paid_on,
        i.notes,
        l.loan_name,
        l.lender_name,
        l.narration,
        l.tally_ledger_name,
        a.account_name
       FROM bank_loan_installments i
       JOIN bank_loans l ON l.id = i.loan_id
       LEFT JOIN bank_accounts a ON a.id = l.bank_account_id
       ${where}
       ORDER BY i.due_date ASC, l.loan_name`,
      values
    ).then((result) => result.rows);
  }

  if (kind === 'compliance-reminders') {
    const { where, values } = buildDateWhere('due_date', filters);
    return query(
      `SELECT *
       FROM compliance_reminders
       ${where}
       ORDER BY due_date ASC, vehicle_no`,
      values
    ).then((result) => result.rows);
  }

  if (kind === 'vehicles') {
    return query(
      `SELECT vehicle_no, ownership, owner_name, chassis_last5, status, is_active
       FROM vehicles
       ORDER BY vehicle_no`
    ).then((result) => result.rows);
  }

  throw new ApiError(400, `Unsupported export kind: ${kind}`);
}
