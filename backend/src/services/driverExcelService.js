import ExcelJS from 'exceljs';
import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

const columns = [
  { header: 'name', key: 'name', width: 24 },
  { header: 'phone', key: 'phone', width: 16 },
  { header: 'license_no', key: 'license_no', width: 18 },
  { header: 'salary', key: 'salary', width: 14 },
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

function parseMoney(value) {
  const text = normaliseText(value);
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) throw new Error('must be a non-negative number');
  return number;
}

function parseBoolean(value) {
  const text = normaliseText(value).toLowerCase();
  if (!text) return null;
  if (['yes', 'true', '1', 'active'].includes(text)) return true;
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
    const status = normaliseText(get(row, 'status')).toLowerCase() || null;
    const currentVehicleNo = normaliseText(get(row, 'current_vehicle_no')).toUpperCase() || null;
    const notes = normaliseText(get(row, 'notes')) || null;

    if (!name && !phone && !licenseNo && !currentVehicleNo && !notes) return;

    const errors = [];
    if (!name) errors.push('name is required');
    if (status && !statusValues.has(status)) errors.push('status must be available, on_duty, vacation, or inactive');

    let salary = null;
    let vacationFrom = null;
    let vacationTo = null;
    let isActive = null;

    try { salary = parseMoney(get(row, 'salary')); } catch (error) { errors.push(`salary ${error.message}`); }
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
      status,
      current_vehicle_no: currentVehicleNo,
      vacation_from: vacationFrom,
      vacation_to: vacationTo,
      notes,
      is_active: isActive,
      errors
    });
  });

  return rows;
}

async function enrichRows(rows) {
  const [drivers, vehicles] = await Promise.all([
    query(`SELECT id, name, phone, license_no, salary, status, current_vehicle_id, vacation_from, vacation_to, notes, is_active FROM drivers`),
    query(`SELECT id, vehicle_no FROM vehicles`)
  ]);

  const vehicleMap = new Map(vehicles.rows.map((row) => [row.vehicle_no.toUpperCase(), row.id]));
  const driverByLicense = new Map(drivers.rows.filter((row) => row.license_no).map((row) => [row.license_no, row]));
  const driverByNamePhone = new Map(drivers.rows.map((row) => [`${row.name.toLowerCase()}|${row.phone || ''}`, row]));

  return rows.map((row) => {
    const existing = row.license_no
      ? driverByLicense.get(row.license_no)
      : driverByNamePhone.get(`${row.name.toLowerCase()}|${row.phone || ''}`);

    let vehicleId = null;
    if (row.current_vehicle_no) {
      vehicleId = vehicleMap.get(row.current_vehicle_no);
      if (!vehicleId) row.errors.push(`vehicle ${row.current_vehicle_no} was not found`);
    }

    const finalStatus = row.status || existing?.status || 'available';
    const finalVacationFrom = finalStatus === 'vacation' ? (row.vacation_from || existing?.vacation_from || null) : null;
    const finalVacationTo = finalStatus === 'vacation' ? (row.vacation_to || existing?.vacation_to || null) : null;
    if (finalStatus === 'vacation' && (!finalVacationFrom || !finalVacationTo)) {
      row.errors.push('vacation status requires vacation dates');
    }

    return {
      ...row,
      action: existing ? 'update' : 'create',
      existing: existing ? {
        name: existing.name,
        phone: existing.phone,
        license_no: existing.license_no,
        salary: existing.salary,
        status: existing.status,
        current_vehicle_id: existing.current_vehicle_id,
        vacation_from: existing.vacation_from,
        vacation_to: existing.vacation_to,
        notes: existing.notes,
        is_active: existing.is_active
      } : null,
      final: {
        name: row.name || existing?.name,
        phone: row.phone ?? existing?.phone ?? null,
        license_no: row.license_no ?? existing?.license_no ?? null,
        salary: row.salary ?? existing?.salary ?? 0,
        status: finalStatus,
        current_vehicle_id: vehicleId ?? existing?.current_vehicle_id ?? null,
        vacation_from: finalVacationFrom,
        vacation_to: finalVacationTo,
        notes: row.notes ?? existing?.notes ?? null,
        is_active: row.is_active ?? existing?.is_active ?? true
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
  const sheet = workbook.getWorksheet('Drivers') || workbook.worksheets[0];
  if (!sheet) throw new ApiError(400, 'Workbook has no sheets');
  return readRows(sheet);
}

export async function previewDriverWorkbook(buffer) {
  const rows = await enrichRows(await loadWorkbookRows(buffer));
  if (rows.length === 0) throw new ApiError(400, 'No driver rows found');
  return buildSummary(rows);
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
      salary: '',
      status: '',
      current_vehicle_no: '',
      vacation_from: '',
      vacation_to: '',
      notes: '',
      is_active: ''
    }
  ]);

  const help = workbook.addWorksheet('Instructions');
  help.columns = [{ width: 28 }, { width: 86 }];
  help.addRows([
    ['Column', 'How to fill'],
    ['name', 'Required. Existing drivers can be matched by license_no, otherwise by name + phone.'],
    ['phone', 'Optional. Blank means keep current value on updates.'],
    ['license_no', 'Optional but recommended. Blank means keep current value on updates.'],
    ['salary', 'Optional. Blank means keep current value on updates.'],
    ['status', 'Optional. Use available, on_duty, vacation, or inactive. Blank means keep current value on updates.'],
    ['current_vehicle_no', 'Optional. Must match an existing vehicle_no. Blank means keep current assignment on updates.'],
    ['vacation_from / vacation_to', 'Only needed for vacation rows. Blank means keep current values on updates. Use yyyy-mm-dd.'],
    ['notes', 'Optional. Blank means keep current value on updates.'],
    ['is_active', 'Optional. Use yes/no or true/false. Blank means keep current value on updates.']
  ]);
  help.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  help.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };

  return workbook;
}

export async function buildDriverExportWorkbook() {
  const result = await query(
    `SELECT d.name, d.phone, d.license_no, d.salary,
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
  const summary = await previewDriverWorkbook(buffer);
  await withTransaction(async (client) => {
    for (const row of summary.rows) {
      if (row.errors.length) continue;
      if (row.action === 'update') {
        const existing = row.existing;
        const existingResult = row.license_no
          ? await client.query('SELECT id FROM drivers WHERE license_no = $1', [row.final.license_no || row.license_no || existing.license_no])
          : await client.query('SELECT id FROM drivers WHERE LOWER(name) = LOWER($1) AND COALESCE(phone, \'\') = COALESCE($2, \'\')', [existing.name, existing.phone]);
        await client.query(
          `UPDATE drivers
           SET name = $1, phone = $2, license_no = $3, salary = $4,
            status = $5, current_vehicle_id = $6, vacation_from = $7, vacation_to = $8,
            notes = $9, is_active = $10, updated_at = NOW()
           WHERE id = $11`,
          [
            row.final.name,
            row.final.phone,
            row.final.license_no,
            row.final.salary,
            row.final.status,
            row.final.current_vehicle_id,
            row.final.vacation_from,
            row.final.vacation_to,
            row.final.notes,
            row.final.is_active,
            existingResult.rows[0].id
          ]
        );
      } else {
        await client.query(
          `INSERT INTO drivers (
            name, phone, license_no, salary, per_trip_allowance, status,
            current_vehicle_id, vacation_from, vacation_to, notes, is_active
          )
          VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8,$9,$10)`,
          [
            row.final.name,
            row.final.phone,
            row.final.license_no,
            row.final.salary,
            row.final.status,
            row.final.current_vehicle_id,
            row.final.vacation_from,
            row.final.vacation_to,
            row.final.notes,
            row.final.is_active
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
      name: row.name,
      errors: row.errors
    }))
  };
}

