import { query, withTransaction } from '../config/db.js';
import { buildBankStatementHash, importBankStatement, previewBankStatement } from '../services/bankStatementService.js';
import { ApiError } from '../utils/apiError.js';

function addMonths(dateText, offset) {
  const base = new Date(`${dateText}T00:00:00`);
  const next = new Date(base.getTime());
  next.setMonth(next.getMonth() + offset);
  return next.toISOString().slice(0, 10);
}

function monthsBetweenInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
}

export async function listBankAccounts(_req, res, next) {
  try {
    const includeInactive = _req.query.includeInactive === 'true';
    const result = await query(
      `SELECT bank_account_id AS id, *
       FROM bank_account_balances
       ${includeInactive ? '' : 'WHERE bank_account_id IN (SELECT id FROM bank_accounts WHERE is_active = TRUE)'}
       ORDER BY account_name`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createBankAccount(req, res, next) {
  try {
    const result = await query(
      `INSERT INTO bank_accounts (
        account_name, bank_name, account_holder_name, account_number_last4, ifsc_code,
        opening_balance, zoho_account_name, tally_ledger_name, is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        req.body.account_name.trim(),
        req.body.bank_name.trim(),
        req.body.account_holder_name || null,
        req.body.account_number_last4 || null,
        req.body.ifsc_code || null,
        req.body.opening_balance || 0,
        req.body.zoho_account_name || null,
        req.body.tally_ledger_name || null,
        req.body.is_active ?? true
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function listBankTransactions(req, res, next) {
  try {
    const values = [];
    const clauses = [];
    if (req.query.accountId) {
      values.push(req.query.accountId);
      clauses.push(`t.bank_account_id = $${values.length}`);
    }
    if (req.query.from) {
      values.push(req.query.from);
      clauses.push(`t.entry_date >= $${values.length}`);
    }
    if (req.query.to) {
      values.push(req.query.to);
      clauses.push(`t.entry_date <= $${values.length}`);
    }

    const result = await query(
      `SELECT
        t.*,
        a.account_name,
        a.bank_name
       FROM bank_transactions t
       JOIN bank_accounts a ON a.id = t.bank_account_id
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY t.entry_date DESC, t.created_at DESC`,
      values
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createBankTransaction(req, res, next) {
  try {
    const accountResult = await query('SELECT id FROM bank_accounts WHERE id = $1', [req.body.bank_account_id]);
    if (!accountResult.rows[0]) throw new ApiError(400, 'Selected bank account was not found');

    const statementHash = buildBankStatementHash(req.body.bank_account_id, {
      entry_date: req.body.entry_date,
      direction: req.body.direction,
      amount: Number(req.body.amount),
      narration: req.body.narration,
      reference_no: req.body.reference_no || null
    });

    const result = await query(
      `INSERT INTO bank_transactions (
        bank_account_id, entry_date, value_date, direction, amount,
        narration, reference_no, balance_after, source_type, statement_hash, created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'manual',$9,$10)
      ON CONFLICT (statement_hash) DO NOTHING
      RETURNING *`,
      [
        req.body.bank_account_id,
        req.body.entry_date,
        req.body.value_date || null,
        req.body.direction,
        req.body.amount,
        req.body.narration.trim(),
        req.body.reference_no || null,
        req.body.balance_after || null,
        statementHash,
        req.user.id
      ]
    );
    if (!result.rows[0]) {
      throw new ApiError(409, 'A matching bank transaction is already present for this account');
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function previewStatement(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'Upload a CSV or Excel statement file');
    if (!req.body.bank_account_id) throw new ApiError(400, 'Choose a bank account before importing');
    res.json(await previewBankStatement(req.file.buffer, req.file.originalname, req.body.bank_account_id));
  } catch (error) {
    next(error);
  }
}

export async function importStatement(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'Upload a CSV or Excel statement file');
    if (!req.body.bank_account_id) throw new ApiError(400, 'Choose a bank account before importing');
    res.json(await importBankStatement(req.file.buffer, req.file.originalname, req.body.bank_account_id, req.user.id));
  } catch (error) {
    next(error);
  }
}

export async function listLoans(_req, res, next) {
  try {
    const includeInactive = _req.query.includeInactive === 'true';
    const [loanRows, installmentRows] = await Promise.all([
      query(
        `SELECT *
         FROM loan_schedule_status
         ${includeInactive ? '' : 'WHERE is_active = TRUE'}
         ORDER BY next_installment_due NULLS LAST, lender_name, loan_name`
      ),
      query(
        `SELECT
          i.id,
          i.loan_id,
          i.due_date,
          i.amount,
          i.status,
          i.paid_on,
          i.notes,
          l.loan_name,
          l.lender_name,
          a.account_name
         FROM bank_loan_installments i
         JOIN bank_loans l ON l.id = i.loan_id
         LEFT JOIN bank_accounts a ON a.id = l.bank_account_id
         ${includeInactive ? '' : 'WHERE l.is_active = TRUE'}
         ORDER BY i.due_date ASC, l.loan_name`
      )
    ]);

    res.json({
      loans: loanRows.rows,
      installments: installmentRows.rows
    });
  } catch (error) {
    next(error);
  }
}

export async function createLoan(req, res, next) {
  try {
    const payload = await withTransaction(async (client) => {
      if (req.body.bank_account_id) {
        const accountResult = await client.query('SELECT id FROM bank_accounts WHERE id = $1', [req.body.bank_account_id]);
        if (!accountResult.rows[0]) throw new ApiError(400, 'Selected bank account was not found');
      }

      const result = await client.query(
        `INSERT INTO bank_loans (
          bank_account_id, loan_name, lender_name, sanction_date, disbursement_date,
          principal_amount, outstanding_amount, emi_amount, interest_rate, repayment_day,
          next_due_date, end_date, reminder_days, narration, zoho_loan_name, tally_ledger_name, is_active
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING *`,
        [
          req.body.bank_account_id || null,
          req.body.loan_name.trim(),
          req.body.lender_name.trim(),
          req.body.sanction_date || null,
          req.body.disbursement_date || null,
          req.body.principal_amount,
          req.body.outstanding_amount ?? req.body.principal_amount,
          req.body.emi_amount || null,
          req.body.interest_rate || null,
          req.body.repayment_day || null,
          req.body.next_due_date || null,
          req.body.end_date || null,
          req.body.reminder_days ?? 7,
          req.body.narration || null,
          req.body.zoho_loan_name || null,
          req.body.tally_ledger_name || null,
          req.body.is_active ?? true
        ]
      );

      const loan = result.rows[0];
      if (loan.next_due_date && loan.emi_amount) {
        const totalInstallments = loan.end_date
          ? monthsBetweenInclusive(loan.next_due_date, loan.end_date)
          : 1;

        for (let index = 0; index < totalInstallments; index += 1) {
          await client.query(
            `INSERT INTO bank_loan_installments (loan_id, due_date, amount, status)
             VALUES ($1,$2,$3,'due')
             ON CONFLICT (loan_id, due_date) DO NOTHING`,
            [loan.id, addMonths(loan.next_due_date, index), loan.emi_amount]
          );
        }
      }

      return loan;
    });

    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
}

export async function updateInstallmentStatus(req, res, next) {
  try {
    const installment = await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE bank_loan_installments
         SET status = $1,
          paid_on = CASE WHEN $1 = 'paid' THEN COALESCE($2, CURRENT_DATE) ELSE NULL END,
          notes = COALESCE($3, notes)
         WHERE id = $4
         RETURNING *`,
        [req.body.status, req.body.paid_on || null, req.body.notes || null, req.params.id]
      );
      const row = result.rows[0];
      if (!row) throw new ApiError(404, 'Loan installment not found');

      if (row.status === 'paid') {
        await client.query(
          `UPDATE bank_loans
           SET outstanding_amount = GREATEST(outstanding_amount - $1, 0),
            updated_at = NOW()
           WHERE id = $2`,
          [row.amount, row.loan_id]
        );
      }

      return row;
    });

    res.json(installment);
  } catch (error) {
    next(error);
  }
}

export async function deleteBankAccount(req, res, next) {
  try {
    const linked = await query(
      `SELECT
        (SELECT COUNT(*)::INT FROM bank_transactions WHERE bank_account_id = $1) AS transaction_count,
        (SELECT COUNT(*)::INT FROM payments WHERE bank_account_id = $1) AS payment_count,
        (SELECT COUNT(*)::INT FROM bank_loans WHERE bank_account_id = $1) AS loan_count`,
      [req.params.id]
    );

    const row = linked.rows[0];
    const hasLinks = Number(row?.transaction_count || 0) > 0 || Number(row?.payment_count || 0) > 0 || Number(row?.loan_count || 0) > 0;

    if (hasLinks) {
      const archived = await query(
        `UPDATE bank_accounts
         SET is_active = FALSE
         WHERE id = $1
         RETURNING *`,
        [req.params.id]
      );
      if (!archived.rows[0]) throw new ApiError(404, 'Bank account not found');
      return res.json({
        mode: 'archived',
        message: 'Bank account has transaction history, so it was archived instead of being fully deleted.',
        record: archived.rows[0]
      });
    }

    const result = await query(
      `DELETE FROM bank_accounts
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) throw new ApiError(404, 'Bank account not found');
    res.json({
      mode: 'deleted',
      message: 'Bank account removed successfully.',
      record: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteBankTransaction(req, res, next) {
  try {
    const existing = await query(
      `SELECT id, source_type, payment_id
       FROM bank_transactions
       WHERE id = $1`,
      [req.params.id]
    );
    const row = existing.rows[0];
    if (!row) throw new ApiError(404, 'Bank transaction not found');
    if (row.payment_id || row.source_type === 'payment') {
      throw new ApiError(400, 'This bank transaction was created from a payment. Remove the payment instead.');
    }

    await query('DELETE FROM bank_transactions WHERE id = $1', [req.params.id]);
    res.json({
      mode: 'deleted',
      message: 'Bank transaction removed successfully.'
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteLoan(req, res, next) {
  try {
    const linked = await query(
      `SELECT COUNT(*)::INT AS installment_count
       FROM bank_loan_installments
       WHERE loan_id = $1`,
      [req.params.id]
    );
    if (Number(linked.rows[0]?.installment_count || 0) > 0) {
      const archived = await query(
        `UPDATE bank_loans
         SET is_active = FALSE,
          updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [req.params.id]
      );
      if (!archived.rows[0]) throw new ApiError(404, 'Bank loan not found');
      return res.json({
        mode: 'archived',
        message: 'Bank loan has installment history, so it was archived instead of being fully deleted.',
        record: archived.rows[0]
      });
    }

    const result = await query(
      `DELETE FROM bank_loans
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) throw new ApiError(404, 'Bank loan not found');
    res.json({
      mode: 'deleted',
      message: 'Bank loan removed successfully.',
      record: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
}
