import ExcelJS from 'exceljs';
import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

const columns = [
  { header: 'vehicle_no', key: 'vehicle_no', width: 18 },
  { header: 'ownership', key: 'ownership', width: 14 },
  { header: 'owner_name', key: 'owner_name', width: 24 },
  { header: 'status', key: 'status', width: 14 },
  { header: 'is_active', key: 'is_active', width: 12 }
];

const ownershipValues = new Set(['own', 'market']);
const statusValues = new Set(['available', 'standby', 'on_trip', 'repair']);

function styleSheet(sheet) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length }
  };
  sheet.columns = columns;
}

function normaliseText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value.text) return String(value.text).trim();
  return String(value).trim();
}

function parseBoolean(value) {
  const text = normaliseText(value).toLowerCase();
  if (!text) return null;
  if (['yes', 'true', '1', 'active'].includes(text)) return true;
  if (['no', 'false', '0', 'inactive'].includes(text)) return false;
  throw new Error('is_active must be yes/no or true/false');
}

function buildSummaryRows(sheet) {
  const headerRow = sheet.getRow(1);
  const headerMap = new Map();
  headerRow.eachCell((cell, colNumber) => {
    headerMap.set(normaliseText(cell.value).toLowerCase(), colNumber);
  });

  const missing = ['vehicle_no'].filter((header) => !headerMap.has(header));
  if (missing.length) throw new ApiError(400, `Missing required column(s): ${missing.join(', ')}`);

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const vehicleNo = normaliseText(row.getCell(headerMap.get('vehicle_no')).value).toUpperCase();
    const ownershipText = headerMap.has('ownership') ? normaliseText(row.getCell(headerMap.get('ownership')).value).toLowerCase() : '';
    const ownerNameText = headerMap.has('owner_name') ? normaliseText(row.getCell(headerMap.get('owner_name')).value) : '';
    const statusText = headerMap.has('status') ? normaliseText(row.getCell(headerMap.get('status')).value).toLowerCase() : '';
    const isActiveRaw = headerMap.has('is_active') ? row.getCell(headerMap.get('is_active')).value : '';

    if (!vehicleNo && !ownershipText && !ownerNameText && !statusText && !normaliseText(isActiveRaw)) return;

    const rowData = {
      rowNumber,
      vehicle_no: vehicleNo,
      ownership: ownershipText || null,
      owner_name: ownerNameText || null,
      status: statusText || null,
      is_active: null,
      errors: [],
      warnings: []
    };

    if (!vehicleNo) rowData.errors.push('vehicle_no is required');
    if (rowData.ownership && !ownershipValues.has(rowData.ownership)) {
      rowData.errors.push('ownership must be own or market');
    }
    if (rowData.status && !statusValues.has(rowData.status)) {
      rowData.errors.push('status must be available, standby, on_trip, or repair');
    }

    try {
      rowData.is_active = parseBoolean(isActiveRaw);
    } catch (error) {
      rowData.errors.push(error.message);
    }

    rows.push(rowData);
  });

  return rows;
}

async function enrichRows(rows) {
  const existing = await query(
    `SELECT id, vehicle_no, ownership, owner_name, status, is_active
     FROM vehicles`
  );
  const existingMap = new Map(existing.rows.map((row) => [row.vehicle_no.toUpperCase(), row]));

  return rows.map((row) => {
    const existingRow = existingMap.get(row.vehicle_no);
    const action = existingRow ? 'update' : 'create';
    if (!existingRow && !row.ownership) {
      row.errors.push('ownership is required for new vehicles');
    }

    return {
      ...row,
      action,
      existing: existingRow ? {
        ownership: existingRow.ownership,
        owner_name: existingRow.owner_name,
        status: existingRow.status,
        is_active: existingRow.is_active
      } : null,
      final: {
        ownership: row.ownership || existingRow?.ownership || null,
        owner_name: row.owner_name ?? existingRow?.owner_name ?? null,
        status: row.status || existingRow?.status || 'available',
        is_active: row.is_active ?? existingRow?.is_active ?? true
      }
    };
  });
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

async function loadWorkbookRows(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet('Vehicles') || workbook.worksheets[0];
  if (!sheet) throw new ApiError(400, 'Workbook has no sheets');
  return buildSummaryRows(sheet);
}

export async function previewVehicleWorkbook(buffer) {
  const rows = await enrichRows(await loadWorkbookRows(buffer));
  if (rows.length === 0) throw new ApiError(400, 'No vehicle rows found');
  return buildSummary(rows);
}

export async function buildVehicleTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Coal TMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Vehicles');
  styleSheet(sheet);
  sheet.addRows([
    { vehicle_no: 'CG04AB1234', ownership: 'own', owner_name: 'Coal Logistics', status: 'available', is_active: 'yes' },
    { vehicle_no: 'JH10MK4567', ownership: 'market', owner_name: '', status: 'standby', is_active: '' },
    { vehicle_no: 'OD09TR8899', ownership: 'own', owner_name: '', status: '', is_active: '' }
  ]);

  const help = workbook.addWorksheet('Instructions');
  help.columns = [{ width: 28 }, { width: 74 }];
  help.addRows([
    ['Column', 'How to fill'],
    ['vehicle_no', 'Required. Existing truck numbers will be updated.'],
    ['ownership', 'Required for new trucks. Blank on existing rows means keep current value.'],
    ['owner_name', 'Optional. Blank means keep current value on updates.'],
    ['status', 'Optional. Use available, standby, on_trip, or repair. Blank means keep current value on updates.'],
    ['is_active', 'Optional. Use yes/no or true/false. Blank means keep current value on updates.']
  ]);
  help.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  help.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };

  return workbook;
}

export async function buildVehicleExportWorkbook() {
  const result = await query(
    `SELECT vehicle_no, ownership, owner_name, status, is_active
     FROM vehicles
     ORDER BY vehicle_no`
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Coal TMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Vehicles');
  styleSheet(sheet);
  sheet.addRows(result.rows);
  return workbook;
}

export async function importVehiclesFromWorkbook(buffer) {
  const summary = await previewVehicleWorkbook(buffer);
  await withTransaction(async (client) => {
    for (const row of summary.rows) {
      if (row.errors.length) continue;
      if (row.action === 'update') {
        await client.query(
          `UPDATE vehicles
           SET ownership = $1, owner_name = $2, status = $3, is_active = $4
           WHERE vehicle_no = $5`,
          [row.final.ownership, row.final.owner_name, row.final.status, row.final.is_active, row.vehicle_no]
        );
      } else {
        await client.query(
          `INSERT INTO vehicles (vehicle_no, ownership, owner_name, status, is_active)
           VALUES ($1,$2,$3,$4,$5)`,
          [row.vehicle_no, row.final.ownership, row.final.owner_name, row.final.status, row.final.is_active]
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
      vehicle_no: row.vehicle_no,
      errors: row.errors
    }))
  };
}

