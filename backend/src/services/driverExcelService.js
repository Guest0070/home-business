import ExcelJS from 'exceljs';
import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

const columns = [
  { header: 'name', key: 'name', width: 24 },
  { header: 'phone', key: 'phone', width: 16 },
  { header: 'license_no', key: 'license_no', width: 18 },
  { header: 'salary', key: 'salary', width: 14 },
  { header: 'per_trip_allowance', key: 'per_trip_allowance', width: 20 },
  { header: 'status', key: 'status', width: 14 },
  { header: 'current_vehicle_no', key: 'current_vehicle_no', width: 20 },
  { header: 'vacation_from', key: 'vacation_from', width: 16 },
  { header: 'vacation_to', key: 'vacation_to', width: 16 },
  { header: 'notes', key: 'notes', width: 28 },
  { header: 'is_active', key: 'is_active', width: 12 }
];

const statusValues = new Set(['available', 'on_duty', 'vacation', 'inactive']);

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

function parseMoney(value, fallback = 0) {
  const text = normaliseText(value);
  if (!text) return fallback;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) throw new Error('must be a non-negative number');
  return number;
}

function parseBoolean(value) {
  const text = normaliseText(value).toLowerCase();
  if (!text || ['yes', 'true', '1', 'active'].includes(text)) return true;
  if (['no', 'false', '0', 'inactive'].includes(text)) return false;
  throw new Error('is_active must be yes/no or true/false');
}

function parseDateText(value) {
  const text = normaliseText(value);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('date must use yyyy-mm-dd');
  return text;
}

function readRows(sheet) {
  const headerMap = new Map();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headerMap.set(normaliseText(cell.value).toLowerCase(), colNumber);
  });

  const missing = ['name'].filter((header) => !headerMap.has(header));
  if (missing.length) throw new ApiError(400, `Missing required column(s): ${missing.join(', ')}`);

  const get = (row, key) => headerMap.has(key) ? row.getCell(headerMap.get(key)).value : '';
  const rows = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = normaliseText(get(row, 'name'));
    const phone = normaliseText(get(row, 'phone'));
    const licenseNo = normaliseText(get(row, 'license_no'));
    const status = normaliseText(get(row, 'status')).toLowerCase() || 'available';
    const currentVehicleNo = normaliseText(get(row, 'current_vehicle_no')).toUpperCase();
    const notes = normaliseText(get(row, 'notes'));

    if (!name && !phone && !licenseNo && !currentVehicleNo) return;

    const errors = [];
    if (!name) errors.push('name is required');
    if (!statusValues.has(status)) errors.push('status must be available, on_duty, vacation, or inactive');

    let salary = 0;
    let perTripAllowance = 0;
    let vacationFrom = null;
    let vacationTo = null;
    let isActive = true;

    try { salary = parseMoney(get(row, 'salary')); } catch (error) { errors.push(`salary ${error.message}`); }
    try { perTripAllowance = parseMoney(get(row, 'per_trip_allowance')); } catch (error) { errors.push(`per_trip_allowance ${error.message}`); }
    try { vacationFrom = parseDateText(get(row, 'vacation_from')); } catch (error) { errors.push(`vacation_from ${error.message}`); }
    try { vacationTo = parseDateText(get(row, 'vacation_to')); } catch (error) { errors.push(`vacation_to ${error.message}`); }
    try { isActive = parseBoolean(get(row, 'is_active')); } catch (error) { errors.push(error.message); }

    if (status === 'vacation' && (!vacationFrom || !vacationTo)) {
      errors.push('vacation status requires vacation_from and vacation_to');
    }
    if (vacationFrom && vacationTo && vacationTo < vacationFrom) {
      errors.push('vacation_to must be after vacation_from');
    }

    rows.push({
      rowNumber,
      name,
      phone: phone || null,
      license_no: licenseNo || null,
      salary,
      per_trip_allowance: perTripAllowance,
      status,
      current_vehicle_no: currentVehicleNo || null,
      vacation_from: status === 'vacation' ? vacationFrom : null,
      vacation_to: status === 'vacation' ? vacationTo : null,
      notes: notes || null,
      is_active: isActive,
      errors
    });
  });

  return rows;
}

async function vehicleMap(client) {
  const result = await client.query('SELECT id, vehicle_no FROM vehicles');
  return new Map(result.rows.map((row) => [row.vehicle_no.toUpperCase(), row.id]));
}

export async function buildDriverTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Coal TMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Drivers');
  styleSheet(sheet);
  sheet.addRows([
    {
      name: 'Raju Kumar',
      phone: '9000000101',
      license_no: 'DL-RJ-1001',
      salary: 22000,
      per_trip_allowance: 700,
      status: 'available',
      current_vehicle_no: 'CG04AB1234',
      vacation_from: '',
      vacation_to: '',
      notes: '',
      is_active: 'yes'
    },
    {
      name: 'Sanjay Yadav',
      phone: '9000000102',
      license_no: 'DL-SY-1002',
      salary: 21000,
      per_trip_allowance: 650,
      status: 'vacation',
      current_vehicle_no: '',
      vacation_from: '2026-04-20',
      vacation_to: '2026-04-22',
      notes: 'Family leave',
      is_active: 'yes'
    }
  ]);

  const help = workbook.addWorksheet('Instructions');
  help.columns = [{ width: 28 }, { width: 80 }];
  help.addRows([
    ['Column', 'How to fill'],
    ['name', 'Required. Driver full name.'],
    ['phone', 'Optional. Mobile number.'],
    ['license_no', 'Optional but recommended. Existing license numbers will be updated.'],
    ['salary', 'Monthly salary. Number only. Blank means 0.'],
    ['per_trip_allowance', 'Allowance per trip. Number only. Blank means 0.'],
    ['status', 'Use available, on_duty, vacation, or inactive.'],
    ['current_vehicle_no', 'Optional. Must match an existing vehicle_no in the system.'],
    ['vacation_from / vacation_to', 'Required when status is vacation. Use yyyy-mm-dd.'],
    ['is_active', 'Use yes/no or true/false. Blank means yes.']
  ]);
  help.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  help.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };

  return workbook;
}

export async function buildDriverExportWorkbook() {
  const result = await query(
    `SELECT d.name, d.phone, d.license_no, d.salary, d.per_trip_allowance,
      d.status, v.vehicle_no AS current_vehicle_no, d.vacation_from, d.vacation_to,
      d.notes, d.is_active
     FROM drivers d
     LEFT JOIN vehicles v ON v.id = d.current_vehicle_id
     ORDER BY d.name`
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Coal TMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Drivers');
  styleSheet(sheet);
  sheet.addRows(result.rows);
  return workbook;
}

export async function importDriversFromWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet('Drivers') || workbook.worksheets[0];
  if (!sheet) throw new ApiError(400, 'Workbook has no sheets');

  const rows = readRows(sheet);
  if (rows.length === 0) throw new ApiError(400, 'No driver rows found');

  const summary = {
    totalRows: rows.length,
    created: 0,
    updated: 0,
    failed: 0,
    errors: []
  };

  await withTransaction(async (client) => {
    const vehicles = await vehicleMap(client);

    for (const row of rows) {
      let vehicleId = null;
      if (row.current_vehicle_no) {
        vehicleId = vehicles.get(row.current_vehicle_no);
        if (!vehicleId) row.errors.push(`vehicle ${row.current_vehicle_no} was not found`);
      }

      if (row.errors.length) {
        summary.failed += 1;
        summary.errors.push({ row: row.rowNumber, name: row.name, errors: row.errors });
        continue;
      }

      const existing = row.license_no
        ? await client.query('SELECT id FROM drivers WHERE license_no = $1', [row.license_no])
        : await client.query('SELECT id FROM drivers WHERE LOWER(name) = LOWER($1) AND COALESCE(phone, \'\') = COALESCE($2, \'\')', [row.name, row.phone]);

      if (existing.rows[0]) {
        await client.query(
          `UPDATE drivers
           SET name = $1, phone = $2, license_no = $3, salary = $4, per_trip_allowance = $5,
            status = $6, current_vehicle_id = $7, vacation_from = $8, vacation_to = $9,
            notes = $10, is_active = $11, updated_at = NOW()
           WHERE id = $12`,
          [
            row.name,
            row.phone,
            row.license_no,
            row.salary,
            row.per_trip_allowance,
            row.status,
            vehicleId,
            row.vacation_from,
            row.vacation_to,
            row.notes,
            row.is_active,
            existing.rows[0].id
          ]
        );
        summary.updated += 1;
      } else {
        await client.query(
          `INSERT INTO drivers (
            name, phone, license_no, salary, per_trip_allowance, status,
            current_vehicle_id, vacation_from, vacation_to, notes, is_active
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            row.name,
            row.phone,
            row.license_no,
            row.salary,
            row.per_trip_allowance,
            row.status,
            vehicleId,
            row.vacation_from,
            row.vacation_to,
            row.notes,
            row.is_active
          ]
        );
        summary.created += 1;
      }
    }
  });

  return summary;
}

