import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

function normaliseText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && value.text) return String(value.text).trim();
  return String(value).trim();
}

function parseDateValue(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = normaliseText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    const day = slash[1].padStart(2, '0');
    const month = slash[2].padStart(2, '0');
    return `${slash[3]}-${month}-${day}`;
  }

  throw new Error('date must use yyyy-mm-dd or dd/mm/yyyy');
}

function parseAmount(value, label) {
  const text = normaliseText(value).replaceAll(',', '');
  if (!text) return null;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} must be a non-negative number`);
  return amount;
}

function parseDirection(value) {
  const text = normaliseText(value).toLowerCase();
  if (!text) return null;
  if (['credit', 'cr', 'deposit'].includes(text)) return 'credit';
  if (['debit', 'dr', 'withdrawal'].includes(text)) return 'debit';
  throw new Error('direction must be credit or debit');
}

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current);
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  if (current !== '' || row.length) {
    row.push(current);
    if (row.some((cell) => cell !== '')) rows.push(row);
  }

  return rows;
}

export function buildBankStatementHash(bankAccountId, row) {
  const payload = [
    bankAccountId,
    row.entry_date,
    row.value_date || '',
    row.direction,
    row.amount?.toFixed(2) || '0.00',
    (row.narration || '').trim().toLowerCase(),
    (row.reference_no || '').trim().toLowerCase(),
    row.balance_after === null || row.balance_after === undefined ? '' : Number(row.balance_after).toFixed(2)
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}

function resolveHeader(headerMap, aliases) {
  return aliases.find((alias) => headerMap.has(alias)) || null;
}

function readWorkbookRows(sheet) {
  const headerMap = new Map();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headerMap.set(normaliseText(cell.value).toLowerCase(), colNumber);
  });

  const dateHeader = resolveHeader(headerMap, ['entry_date', 'transaction_date', 'txn_date', 'date']);
  const narrationHeader = resolveHeader(headerMap, ['narration', 'description', 'particulars', 'remarks']);
  if (!dateHeader) throw new ApiError(400, 'Statement must include a transaction date column');
  if (!narrationHeader) throw new ApiError(400, 'Statement must include a narration or description column');

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const get = (aliases) => {
      const key = resolveHeader(headerMap, aliases);
      if (!key) return '';
      return row.getCell(headerMap.get(key)).value;
    };

    const entryDateRaw = get(['entry_date', 'transaction_date', 'txn_date', 'date']);
    const narrationRaw = get(['narration', 'description', 'particulars', 'remarks']);
    const referenceRaw = get(['reference_no', 'reference', 'ref_no', 'ref', 'utr', 'cheque_no']);
    const directionRaw = get(['direction', 'dr_cr', 'type']);
    const debitRaw = get(['debit', 'debit_amount', 'withdrawal']);
    const creditRaw = get(['credit', 'credit_amount', 'deposit']);
    const amountRaw = get(['amount']);
    const valueDateRaw = get(['value_date']);
    const balanceRaw = get(['balance', 'closing_balance']);

    const anything = [entryDateRaw, narrationRaw, referenceRaw, directionRaw, debitRaw, creditRaw, amountRaw, valueDateRaw, balanceRaw]
      .some((value) => normaliseText(value));
    if (!anything) return;

    const rowData = {
      rowNumber,
      entry_date: null,
      value_date: null,
      direction: null,
      amount: null,
      narration: normaliseText(narrationRaw) || null,
      reference_no: normaliseText(referenceRaw) || null,
      balance_after: null,
      errors: [],
      warnings: []
    };

    try { rowData.entry_date = parseDateValue(entryDateRaw); } catch (error) { rowData.errors.push(`entry_date ${error.message}`); }
    try { rowData.value_date = parseDateValue(valueDateRaw); } catch (error) { rowData.errors.push(`value_date ${error.message}`); }
    try { rowData.balance_after = parseAmount(balanceRaw, 'balance'); } catch (error) { rowData.errors.push(error.message); }

    let direction = null;
    let amount = null;
    try { direction = parseDirection(directionRaw); } catch (error) { rowData.errors.push(error.message); }

    try {
      const debit = parseAmount(debitRaw, 'debit');
      const credit = parseAmount(creditRaw, 'credit');
      const directAmount = parseAmount(amountRaw, 'amount');

      if (debit !== null) {
        direction = 'debit';
        amount = debit;
      } else if (credit !== null) {
        direction = 'credit';
        amount = credit;
      } else if (directAmount !== null && direction) {
        amount = directAmount;
      }
    } catch (error) {
      rowData.errors.push(error.message);
    }

    rowData.direction = direction;
    rowData.amount = amount;

    if (!rowData.narration) rowData.errors.push('narration is required');
    if (!rowData.entry_date) rowData.errors.push('entry_date is required');
    if (!rowData.direction || rowData.amount === null) {
      rowData.errors.push('statement row must include either debit or credit amount');
    }

    rows.push(rowData);
  });

  return rows;
}

async function loadStatementRows(buffer, originalName) {
  if (originalName.toLowerCase().endsWith('.csv')) {
    const records = parseCsv(buffer.toString('utf8'));
    if (!records.length) throw new ApiError(400, 'CSV statement is empty');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Statement');
    records.forEach((record) => sheet.addRow(record));
    return readWorkbookRows(sheet);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet('Statement') || workbook.worksheets[0];
  if (!sheet) throw new ApiError(400, 'Workbook has no sheets');
  return readWorkbookRows(sheet);
}

function buildSummary(rows) {
  return {
    totalRows: rows.length,
    creates: rows.filter((row) => row.action === 'create' && row.errors.length === 0).length,
    duplicates: rows.filter((row) => row.action === 'duplicate').length,
    failed: rows.filter((row) => row.errors.length > 0).length,
    rows
  };
}

async function enrichRows(bankAccountId, rows) {
  const accountResult = await query('SELECT id, account_name FROM bank_accounts WHERE id = $1', [bankAccountId]);
  const account = accountResult.rows[0];
  if (!account) throw new ApiError(400, 'Selected bank account was not found');

  const hashes = rows
    .filter((row) => row.errors.length === 0)
    .map((row) => buildBankStatementHash(bankAccountId, row));

  const existingResult = hashes.length
    ? await query('SELECT statement_hash FROM bank_transactions WHERE statement_hash = ANY($1::text[])', [hashes])
    : { rows: [] };
  const existingHashes = new Set(existingResult.rows.map((row) => row.statement_hash));

  return rows.map((row) => {
    const statementHash = row.errors.length ? null : buildBankStatementHash(bankAccountId, row);
    const action = row.errors.length
      ? 'error'
      : existingHashes.has(statementHash)
        ? 'duplicate'
        : 'create';

    if (action === 'duplicate') {
      row.warnings.push('Already imported earlier, will be skipped');
    }

    return {
      ...row,
      statement_hash: statementHash,
      action,
      preview_text: `${row.entry_date} | ${row.direction || ''} | ${row.amount || ''} | ${row.narration || ''}`,
      bank_account_name: account.account_name
    };
  });
}

export async function previewBankStatement(buffer, originalName, bankAccountId) {
  const rows = await enrichRows(bankAccountId, await loadStatementRows(buffer, originalName));
  if (rows.length === 0) throw new ApiError(400, 'No statement rows found');
  return buildSummary(rows);
}

export async function importBankStatement(buffer, originalName, bankAccountId, userId) {
  const summary = await previewBankStatement(buffer, originalName, bankAccountId);
  await withTransaction(async (client) => {
    for (const row of summary.rows) {
      if (row.errors.length || row.action === 'duplicate') continue;
      await client.query(
        `INSERT INTO bank_transactions (
          bank_account_id, entry_date, value_date, direction, amount,
          narration, reference_no, balance_after, source_type, statement_hash, created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'statement',$9,$10)`,
        [
          bankAccountId,
          row.entry_date,
          row.value_date || null,
          row.direction,
          row.amount,
          row.narration,
          row.reference_no,
          row.balance_after,
          row.statement_hash,
          userId
        ]
      );
    }
  });

  return {
    totalRows: summary.totalRows,
    created: summary.creates,
    duplicates: summary.duplicates,
    failed: summary.failed,
    errors: summary.rows.filter((row) => row.errors.length).map((row) => ({
      row: row.rowNumber,
      errors: row.errors
    }))
  };
}
