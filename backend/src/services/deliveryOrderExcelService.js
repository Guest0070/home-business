import ExcelJS from 'exceljs';
import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

const columns = [
  { header: 'do_number', key: 'do_number', width: 18 },
  { header: 'issue_date', key: 'issue_date', width: 14 },
  { header: 'mine_name', key: 'mine_name', width: 22 },
  { header: 'factory_name', key: 'factory_name', width: 24 },
  { header: 'total_tons', key: 'total_tons', width: 14 },
  { header: 'rate_per_ton', key: 'rate_per_ton', width: 14 },
  { header: 'dispatch_target_date', key: 'dispatch_target_date', width: 18 },
  { header: 'valid_until', key: 'valid_until', width: 16 },
  { header: 'broker_name', key: 'broker_name', width: 20 },
  { header: 'priority', key: 'priority', width: 12 },
  { header: 'status', key: 'status', width: 14 },
  { header: 'notes', key: 'notes', width: 30 }
];

const statusValues = new Set(['open', 'completed', 'cancelled']);
const priorityValues = new Set(['low', 'normal', 'high', 'urgent']);

function styleSheet(sheet) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length }
  };
}

function normaliseText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && value.text) return String(value.text).trim();
  return String(value).trim();
}

function parseDateText(value) {
  const text = normaliseText(value);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('must use yyyy-mm-dd');
  return text;
}

function parseNumber(value, label, { positive = false, nonNegative = false } = {}) {
  const text = normaliseText(value);
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a valid number`);
  if (positive && number <= 0) throw new Error(`${label} must be greater than zero`);
  if (nonNegative && number < 0) throw new Error(`${label} cannot be negative`);
  return number;
}

function buildSummary(rows) {
  return {
    totalRows: rows.length,
    creates: rows.filter((row) => row.action === 'create' && row.errors.length === 0).length,
    updates: rows.filter((row) => row.action === 'update' && row.errors.length === 0).length,
    failed: rows.filter((row) => row.errors.length > 0).length,
    rows
  };
}

function readRows(sheet) {
  const headerMap = new Map();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headerMap.set(normaliseText(cell.value).toLowerCase(), colNumber);
  });

  const missing = ['do_number'].filter((header) => !headerMap.has(header));
  if (missing.length) throw new ApiError(400, `Missing required column(s): ${missing.join(', ')}`);

  const get = (row, key) => headerMap.has(key) ? row.getCell(headerMap.get(key)).value : '';
  const rows = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const doNumber = normaliseText(get(row, 'do_number')).toUpperCase();
    const mineName = normaliseText(get(row, 'mine_name')) || null;
    const factoryName = normaliseText(get(row, 'factory_name')) || null;
    const brokerName = normaliseText(get(row, 'broker_name')) || null;
    const priority = normaliseText(get(row, 'priority')).toLowerCase() || null;
    const status = normaliseText(get(row, 'status')).toLowerCase() || null;
    const notes = normaliseText(get(row, 'notes')) || null;

    const hasAnyData = [
      doNumber,
      get(row, 'issue_date'),
      mineName,
      factoryName,
      get(row, 'total_tons'),
      get(row, 'rate_per_ton'),
      get(row, 'dispatch_target_date'),
      get(row, 'valid_until'),
      brokerName,
      priority,
      status,
      notes
    ].some((value) => normaliseText(value));

    if (!hasAnyData) return;

    const errors = [];
    let issueDate = null;
    let totalTons = null;
    let ratePerTon = null;
    let dispatchTargetDate = null;
    let validUntil = null;

    if (!doNumber) errors.push('do_number is required');
    if (status && !statusValues.has(status)) errors.push('status must be open, completed, or cancelled');
    if (priority && !priorityValues.has(priority)) errors.push('priority must be low, normal, high, or urgent');

    try { issueDate = parseDateText(get(row, 'issue_date')); } catch (error) { errors.push(`issue_date ${error.message}`); }
    try { totalTons = parseNumber(get(row, 'total_tons'), 'total_tons', { positive: true }); } catch (error) { errors.push(error.message); }
    try { ratePerTon = parseNumber(get(row, 'rate_per_ton'), 'rate_per_ton', { nonNegative: true }); } catch (error) { errors.push(error.message); }
    try { dispatchTargetDate = parseDateText(get(row, 'dispatch_target_date')); } catch (error) { errors.push(`dispatch_target_date ${error.message}`); }
    try { validUntil = parseDateText(get(row, 'valid_until')); } catch (error) { errors.push(`valid_until ${error.message}`); }

    if (dispatchTargetDate && validUntil && validUntil < dispatchTargetDate) {
      errors.push('valid_until must be on or after dispatch_target_date');
    }

    rows.push({
      rowNumber,
      do_number: doNumber || null,
      issue_date: issueDate,
      mine_name: mineName,
      factory_name: factoryName,
      total_tons: totalTons,
      rate_per_ton: ratePerTon,
      dispatch_target_date: dispatchTargetDate,
      valid_until: validUntil,
      broker_name: brokerName,
      priority,
      status,
      notes,
      errors,
      warnings: []
    });
  });

  return rows;
}

async function loadWorkbookRows(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet('DeliveryOrders') || workbook.worksheets[0];
  if (!sheet) throw new ApiError(400, 'Workbook has no sheets');
  return readRows(sheet);
}

async function enrichRows(rows) {
  const [existingOrders, mines, factories] = await Promise.all([
    query(`SELECT id, do_number, issue_date, mine_id, factory_id, total_tons, rate_per_ton, dispatch_target_date, valid_until, broker_name, priority, status, notes FROM delivery_orders`),
    query(`SELECT id, name FROM mines`),
    query(`SELECT id, name FROM factories`)
  ]);

  const existingMap = new Map(existingOrders.rows.map((row) => [row.do_number.toUpperCase(), row]));
  const mineMap = new Map(mines.rows.map((row) => [row.name.toLowerCase(), row]));
  const factoryMap = new Map(factories.rows.map((row) => [row.name.toLowerCase(), row]));

  return rows.map((row) => {
    const existing = existingMap.get(row.do_number);
    const mine = row.mine_name ? mineMap.get(row.mine_name.toLowerCase()) || null : null;
    const factory = row.factory_name ? factoryMap.get(row.factory_name.toLowerCase()) || null : null;

    if (row.mine_name && !mine) row.errors.push(`mine ${row.mine_name} was not found`);
    if (row.factory_name && !factory) row.errors.push(`factory ${row.factory_name} was not found`);

    if (!existing && !row.issue_date) row.errors.push('issue_date is required for new delivery orders');
    if (!existing && row.total_tons === null) row.errors.push('total_tons is required for new delivery orders');

    const final = {
      do_number: row.do_number,
      issue_date: row.issue_date || existing?.issue_date || null,
      mine_id: mine?.id || existing?.mine_id || null,
      mine_name: mine?.name || row.mine_name || null,
      factory_id: factory?.id || existing?.factory_id || null,
      factory_name: factory?.name || row.factory_name || null,
      total_tons: row.total_tons ?? existing?.total_tons ?? null,
      rate_per_ton: row.rate_per_ton ?? existing?.rate_per_ton ?? null,
      dispatch_target_date: row.dispatch_target_date ?? existing?.dispatch_target_date ?? null,
      valid_until: row.valid_until ?? existing?.valid_until ?? null,
      broker_name: row.broker_name ?? existing?.broker_name ?? null,
      priority: row.priority || existing?.priority || 'normal',
      status: row.status || existing?.status || 'open',
      notes: row.notes ?? existing?.notes ?? null
    };

    return {
      ...row,
      action: existing ? 'update' : 'create',
      existing_id: existing?.id || null,
      existing: existing ? {
        issue_date: existing.issue_date,
        mine_id: existing.mine_id,
        factory_id: existing.factory_id,
        total_tons: existing.total_tons,
        rate_per_ton: existing.rate_per_ton,
        dispatch_target_date: existing.dispatch_target_date,
        valid_until: existing.valid_until,
        broker_name: existing.broker_name,
        priority: existing.priority,
        status: existing.status,
        notes: existing.notes
      } : null,
      final,
      preview_text: [
        final.do_number,
        final.factory_name || final.mine_name || null,
        final.total_tons !== null ? `${final.total_tons} tons` : null,
        final.status
      ].filter(Boolean).join(' | ')
    };
  });
}

export async function previewDeliveryOrderWorkbook(buffer) {
  const rows = await enrichRows(await loadWorkbookRows(buffer));
  if (rows.length === 0) throw new ApiError(400, 'No delivery order rows found');
  return buildSummary(rows);
}

export async function importDeliveryOrdersFromWorkbook(buffer, userId) {
  const summary = await previewDeliveryOrderWorkbook(buffer);

  await withTransaction(async (client) => {
    for (const row of summary.rows) {
      if (row.errors.length) continue;

      if (row.action === 'update') {
        await client.query(
          `UPDATE delivery_orders
           SET issue_date = $1,
            mine_id = $2,
            factory_id = $3,
            total_tons = $4,
            rate_per_ton = $5,
            dispatch_target_date = $6,
            valid_until = $7,
            broker_name = $8,
            priority = $9,
            status = $10,
            notes = $11,
            updated_at = NOW()
           WHERE id = $12`,
          [
            row.final.issue_date,
            row.final.mine_id,
            row.final.factory_id,
            row.final.total_tons,
            row.final.rate_per_ton,
            row.final.dispatch_target_date,
            row.final.valid_until,
            row.final.broker_name,
            row.final.priority,
            row.final.status,
            row.final.notes,
            row.existing_id
          ]
        );
      } else {
        await client.query(
          `INSERT INTO delivery_orders (
            do_number, issue_date, mine_id, factory_id, total_tons, rate_per_ton,
            dispatch_target_date, valid_until, broker_name, priority, status, notes, created_by
          )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            row.final.do_number,
            row.final.issue_date,
            row.final.mine_id,
            row.final.factory_id,
            row.final.total_tons,
            row.final.rate_per_ton,
            row.final.dispatch_target_date,
            row.final.valid_until,
            row.final.broker_name,
            row.final.priority,
            row.final.status,
            row.final.notes,
            userId
          ]
        );
      }
    }
  });

  return {
    totalRows: summary.totalRows,
    created: summary.creates,
    updated: summary.updates,
    failed: summary.failed,
    errors: summary.rows.filter((row) => row.errors.length).map((row) => ({
      row: row.rowNumber,
      do_number: row.do_number,
      errors: row.errors
    }))
  };
}

export async function buildDeliveryOrderTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Coal TMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('DeliveryOrders');
  styleSheet(sheet);
  sheet.addRows([
    {
      do_number: 'DO-2026-001',
      issue_date: '2026-04-20',
      mine_name: 'Dipka Mine',
      factory_name: 'Shree Cement',
      total_tons: 3000,
      rate_per_ton: 820,
      dispatch_target_date: '2026-04-24',
      valid_until: '2026-04-30',
      broker_name: 'Agarwal Coal Movers',
      priority: 'high',
      status: 'open',
      notes: 'Fresh D.O.'
    },
    {
      do_number: 'DO-2026-001',
      issue_date: '',
      mine_name: '',
      factory_name: '',
      total_tons: '',
      rate_per_ton: '',
      dispatch_target_date: '',
      valid_until: '2026-05-02',
      broker_name: '',
      priority: '',
      status: '',
      notes: 'Update the same D.O. later by keeping only the changed values'
    }
  ]);

  const help = workbook.addWorksheet('Instructions');
  help.columns = [{ width: 28 }, { width: 88 }];
  help.addRows([
    ['Column', 'How to fill'],
    ['do_number', 'Required. Existing D.O. numbers will be updated, new numbers will create fresh delivery orders.'],
    ['issue_date', 'Required for new rows. Blank on updates means keep the current issue date. Use yyyy-mm-dd.'],
    ['mine_name / factory_name', 'Optional. Must match existing master names exactly enough to be found. Blank on updates keeps the current route.'],
    ['total_tons', 'Required for new rows. Blank on updates keeps the current ordered tonnage.'],
    ['rate_per_ton', 'Optional. Blank on updates keeps the current rate.'],
    ['dispatch_target_date / valid_until', 'Optional. Blank on updates keeps the current dates. Use yyyy-mm-dd.'],
    ['broker_name', 'Optional. Blank on updates keeps the current broker.'],
    ['priority', 'Optional. Use low, normal, high, or urgent. Blank on updates keeps the current priority.'],
    ['status', 'Optional. Use open, completed, or cancelled. Blank on updates keeps the current status.'],
    ['notes', 'Optional. Blank on updates keeps the current notes.']
  ]);
  help.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  help.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };

  return workbook;
}

export async function buildDeliveryOrderExportWorkbook() {
  const result = await query(
    `SELECT
      dord.do_number,
      dord.issue_date,
      m.name AS mine_name,
      f.name AS factory_name,
      dord.total_tons,
      dord.rate_per_ton,
      dord.dispatch_target_date,
      dord.valid_until,
      dord.broker_name,
      dord.priority,
      dord.status,
      dord.notes
     FROM delivery_orders dord
     LEFT JOIN mines m ON m.id = dord.mine_id
     LEFT JOIN factories f ON f.id = dord.factory_id
     ORDER BY dord.issue_date DESC, dord.do_number DESC`
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Coal TMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('DeliveryOrders');
  styleSheet(sheet);
  sheet.addRows(result.rows);
  return workbook;
}
