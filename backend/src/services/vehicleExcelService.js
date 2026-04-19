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
  return String(value).trim();
}

function parseBoolean(value) {
  const text = normaliseText(value).toLowerCase();
  if (!text || ['yes', 'true', '1', 'active'].includes(text)) return true;
  if (['no', 'false', '0', 'inactive'].includes(text)) return false;
  throw new Error('is_active must be yes/no or true/false');
}

function readRows(sheet) {
  const headerRow = sheet.getRow(1);
  const headerMap = new Map();
  headerRow.eachCell((cell, colNumber) => {
    headerMap.set(normaliseText(cell.value).toLowerCase(), colNumber);
  });

  const missing = ['vehicle_no', 'ownership'].filter((header) => !headerMap.has(header));
  if (missing.length) throw new ApiError(400, `Missing required column(s): ${missing.join(', ')}`);

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const vehicleNo = normaliseText(row.getCell(headerMap.get('vehicle_no')).value).toUpperCase();
    const ownership = normaliseText(row.getCell(headerMap.get('ownership')).value).toLowerCase();
    const ownerName = headerMap.has('owner_name') ? normaliseText(row.getCell(headerMap.get('owner_name')).value) : '';
    const status = headerMap.has('status') ? normaliseText(row.getCell(headerMap.get('status')).value).toLowerCase() || 'available' : 'available';
    const isActiveRaw = headerMap.has('is_active') ? row.getCell(headerMap.get('is_active')).value : true;

    if (!vehicleNo && !ownership && !ownerName) return;

    const errors = [];
    if (!vehicleNo) errors.push('vehicle_no is required');
    if (!ownershipValues.has(ownership)) errors.push('ownership must be own or market');
    if (!statusValues.has(status)) errors.push('status must be available, standby, on_trip, or repair');

    let isActive = true;
    try {
      isActive = parseBoolean(isActiveRaw);
    } catch (error) {
      errors.push(error.message);
    }

    rows.push({
      rowNumber,
      vehicle_no: vehicleNo,
      ownership,
      owner_name: ownerName || null,
      status,
      is_active: isActive,
      errors
    });
  });

  return rows;
}

export async function buildVehicleTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Coal TMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Vehicles');
  styleSheet(sheet);
  sheet.addRows([
    { vehicle_no: 'CG04AB1234', ownership: 'own', owner_name: 'Coal Logistics', status: 'available', is_active: 'yes' },
    { vehicle_no: 'JH10MK4567', ownership: 'market', owner_name: 'Ramesh Transport', status: 'standby', is_active: 'yes' }
  ]);

  const help = workbook.addWorksheet('Instructions');
  help.columns = [{ width: 28 }, { width: 70 }];
  help.addRows([
    ['Column', 'How to fill'],
    ['vehicle_no', 'Required. Truck number. Existing truck numbers will be updated.'],
    ['ownership', 'Required. Use own or market.'],
    ['owner_name', 'Optional. Truck owner or transporter name.'],
    ['status', 'Use available, standby, on_trip, or repair. Repair trucks cannot be selected for trips.'],
    ['is_active', 'Use yes/no or true/false. Blank means yes.']
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
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet('Vehicles') || workbook.worksheets[0];
  if (!sheet) throw new ApiError(400, 'Workbook has no sheets');

  const rows = readRows(sheet);
  if (rows.length === 0) throw new ApiError(400, 'No vehicle rows found');

  const summary = {
    totalRows: rows.length,
    created: 0,
    updated: 0,
    failed: 0,
    errors: []
  };

  await withTransaction(async (client) => {
    for (const row of rows) {
      if (row.errors.length) {
        summary.failed += 1;
        summary.errors.push({ row: row.rowNumber, vehicle_no: row.vehicle_no, errors: row.errors });
        continue;
      }

      const existing = await client.query('SELECT id FROM vehicles WHERE vehicle_no = $1', [row.vehicle_no]);
      if (existing.rows[0]) {
        await client.query(
          `UPDATE vehicles
           SET ownership = $1, owner_name = $2, status = $3, is_active = $4
           WHERE vehicle_no = $5`,
          [row.ownership, row.owner_name, row.status, row.is_active, row.vehicle_no]
        );
        summary.updated += 1;
      } else {
        await client.query(
          `INSERT INTO vehicles (vehicle_no, ownership, owner_name, status, is_active)
           VALUES ($1,$2,$3,$4,$5)`,
          [row.vehicle_no, row.ownership, row.owner_name, row.status, row.is_active]
        );
        summary.created += 1;
      }
    }
  });

  return summary;
}

