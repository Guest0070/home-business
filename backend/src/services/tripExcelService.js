import ExcelJS from 'exceljs';
import { query, withTransaction } from '../config/db.js';
import { saveTripFromPayload } from './tripService.js';
import { ApiError } from '../utils/apiError.js';

const columns = [
  { header: 'trip_date', key: 'trip_date', width: 14 },
  { header: 'lr_number', key: 'lr_number', width: 20 },
  { header: 'do_number', key: 'do_number', width: 18 },
  { header: 'vehicle_no', key: 'vehicle_no', width: 18 },
  { header: 'driver_name', key: 'driver_name', width: 24 },
  { header: 'mine_name', key: 'mine_name', width: 22 },
  { header: 'factory_name', key: 'factory_name', width: 24 },
  { header: 'weight_tons', key: 'weight_tons', width: 14 },
  { header: 'rate_per_ton', key: 'rate_per_ton', width: 14 },
  { header: 'return_party_name', key: 'return_party_name', width: 22 },
  { header: 'return_from_name', key: 'return_from_name', width: 22 },
  { header: 'return_to_name', key: 'return_to_name', width: 22 },
  { header: 'return_weight_tons', key: 'return_weight_tons', width: 18 },
  { header: 'return_rate_per_ton', key: 'return_rate_per_ton', width: 18 },
  { header: 'diesel_litres', key: 'diesel_litres', width: 14 },
  { header: 'diesel_cost', key: 'diesel_cost', width: 14 },
  { header: 'driver_allowance', key: 'driver_allowance', width: 16 },
  { header: 'toll', key: 'toll', width: 12 },
  { header: 'other_expenses', key: 'other_expenses', width: 18 },
  { header: 'return_notes', key: 'return_notes', width: 26 },
  { header: 'notes', key: 'notes', width: 30 }
];

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

function lower(value) {
  return normaliseText(value).toLowerCase();
}

function findHeader(headerMap, keys) {
  return keys.find((key) => headerMap.has(key)) || null;
}

function getCellValue(row, headerMap, keys) {
  const key = findHeader(headerMap, keys);
  if (!key) return '';
  return row.getCell(headerMap.get(key)).value;
}

function buildPreviewText(row) {
  const parts = [
    row.final.lr_number || 'Auto LR',
    row.final.do_number ? `D.O. ${row.final.do_number}` : null,
    row.final.vehicle_no || null,
    row.final.driver_name || null,
    row.final.factory_name || row.final.mine_name || null
  ].filter(Boolean);
  return parts.join(' | ');
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

  const missing = ['trip_date', 'lr_number', 'vehicle_no', 'driver_name'].filter((header) => !headerMap.has(header));
  if (missing.length) throw new ApiError(400, `Missing required column(s): ${missing.join(', ')}`);

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const tripDateRaw = getCellValue(row, headerMap, ['trip_date']);
    const lrNumber = normaliseText(getCellValue(row, headerMap, ['lr_number'])) || null;
    const doNumber = normaliseText(getCellValue(row, headerMap, ['do_number', 'delivery_order_no'])) || null;
    const vehicleNo = normaliseText(getCellValue(row, headerMap, ['vehicle_no'])).toUpperCase() || null;
    const driverName = normaliseText(getCellValue(row, headerMap, ['driver_name'])) || null;
    const mineName = normaliseText(getCellValue(row, headerMap, ['mine_name'])) || null;
    const factoryName = normaliseText(getCellValue(row, headerMap, ['factory_name', 'party_name'])) || null;
    const returnPartyName = normaliseText(getCellValue(row, headerMap, ['return_party_name'])) || null;
    const returnFromName = normaliseText(getCellValue(row, headerMap, ['return_from_name'])) || null;
    const returnToName = normaliseText(getCellValue(row, headerMap, ['return_to_name'])) || null;
    const returnNotes = normaliseText(getCellValue(row, headerMap, ['return_notes'])) || null;
    const notes = normaliseText(getCellValue(row, headerMap, ['notes'])) || null;

    const hasAnyData = [
      tripDateRaw,
      lrNumber,
      doNumber,
      vehicleNo,
      driverName,
      mineName,
      factoryName,
      getCellValue(row, headerMap, ['weight_tons']),
      getCellValue(row, headerMap, ['rate_per_ton']),
      returnPartyName,
      returnFromName,
      returnToName,
      getCellValue(row, headerMap, ['return_weight_tons']),
      getCellValue(row, headerMap, ['return_rate_per_ton']),
      getCellValue(row, headerMap, ['diesel_litres']),
      getCellValue(row, headerMap, ['diesel_cost']),
      getCellValue(row, headerMap, ['driver_allowance']),
      getCellValue(row, headerMap, ['toll']),
      getCellValue(row, headerMap, ['other_expenses']),
      returnNotes,
      notes
    ].some((value) => normaliseText(value));

    if (!hasAnyData) return;

    const errors = [];
    let tripDate = null;
    let weightTons = null;
    let ratePerTon = null;
    let returnWeightTons = null;
    let returnRatePerTon = null;
    let dieselLitres = null;
    let dieselCost = null;
    let driverAllowance = null;
    let toll = null;
    let otherExpenses = null;

    try { tripDate = parseDateText(tripDateRaw); } catch (error) { errors.push(`trip_date ${error.message}`); }
    try { weightTons = parseNumber(getCellValue(row, headerMap, ['weight_tons']), 'weight_tons', { positive: true }); } catch (error) { errors.push(error.message); }
    try { ratePerTon = parseNumber(getCellValue(row, headerMap, ['rate_per_ton']), 'rate_per_ton', { nonNegative: true }); } catch (error) { errors.push(error.message); }
    try { returnWeightTons = parseNumber(getCellValue(row, headerMap, ['return_weight_tons']), 'return_weight_tons', { positive: true }); } catch (error) { errors.push(error.message); }
    try { returnRatePerTon = parseNumber(getCellValue(row, headerMap, ['return_rate_per_ton']), 'return_rate_per_ton', { nonNegative: true }); } catch (error) { errors.push(error.message); }
    try { dieselLitres = parseNumber(getCellValue(row, headerMap, ['diesel_litres']), 'diesel_litres', { nonNegative: true }); } catch (error) { errors.push(error.message); }
    try { dieselCost = parseNumber(getCellValue(row, headerMap, ['diesel_cost']), 'diesel_cost', { nonNegative: true }); } catch (error) { errors.push(error.message); }
    try { driverAllowance = parseNumber(getCellValue(row, headerMap, ['driver_allowance']), 'driver_allowance', { nonNegative: true }); } catch (error) { errors.push(error.message); }
    try { toll = parseNumber(getCellValue(row, headerMap, ['toll']), 'toll', { nonNegative: true }); } catch (error) { errors.push(error.message); }
    try { otherExpenses = parseNumber(getCellValue(row, headerMap, ['other_expenses']), 'other_expenses', { nonNegative: true }); } catch (error) { errors.push(error.message); }

    rows.push({
      rowNumber,
      trip_date: tripDate,
      lr_number: lrNumber,
      do_number: doNumber,
      vehicle_no: vehicleNo,
      driver_name: driverName,
      mine_name: mineName,
      factory_name: factoryName,
      weight_tons: weightTons,
      rate_per_ton: ratePerTon,
      return_party_name: returnPartyName,
      return_from_name: returnFromName,
      return_to_name: returnToName,
      return_weight_tons: returnWeightTons,
      return_rate_per_ton: returnRatePerTon,
      diesel_litres: dieselLitres,
      diesel_cost: dieselCost,
      driver_allowance: driverAllowance,
      toll,
      other_expenses: otherExpenses,
      return_notes: returnNotes,
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
  const sheet = workbook.getWorksheet('Trips') || workbook.worksheets[0];
  if (!sheet) throw new ApiError(400, 'Workbook has no sheets');
  return readRows(sheet);
}

async function enrichRows(rows) {
  const lrNumbers = rows.map((row) => row.lr_number).filter(Boolean);
  const [vehicles, deliveryOrders, mines, factories, drivers, existingTrips, routes] = await Promise.all([
    query(`SELECT id, vehicle_no, status, is_active FROM vehicles`),
    query(`SELECT id, do_number, mine_id, mine_name, factory_id, factory_name, rate_per_ton, pending_tons, status FROM delivery_order_progress`),
    query(`SELECT id, name FROM mines`),
    query(`SELECT id, name FROM factories`),
    query(`SELECT id, name, status, is_active FROM drivers WHERE is_active = TRUE`),
    lrNumbers.length
      ? query(
        `SELECT
          t.id,
          t.trip_date,
          t.lr_number,
          t.vehicle_id,
          v.vehicle_no,
          t.driver_id,
          t.driver_name,
          t.mine_id,
          m.name AS mine_name,
          t.factory_id,
          f.name AS factory_name,
          t.delivery_order_id,
          dord.do_number,
          t.weight_tons,
          t.rate_per_ton,
          t.return_party_name,
          t.return_from_name,
          t.return_to_name,
          t.return_weight_tons,
          t.return_rate_per_ton,
          t.return_notes,
          t.notes,
          COALESCE(e.diesel_litres, 0) AS diesel_litres,
          COALESCE(e.diesel_cost, 0) AS diesel_cost,
          COALESCE(e.driver_allowance, 0) AS driver_allowance,
          COALESCE(e.toll, 0) AS toll,
          COALESCE(e.other_expenses, 0) AS other_expenses
         FROM trips t
         JOIN vehicles v ON v.id = t.vehicle_id
         LEFT JOIN mines m ON m.id = t.mine_id
         LEFT JOIN factories f ON f.id = t.factory_id
         LEFT JOIN delivery_orders dord ON dord.id = t.delivery_order_id
         LEFT JOIN expenses e ON e.trip_id = t.id
         WHERE t.lr_number = ANY($1::text[])`,
        [lrNumbers]
      )
      : Promise.resolve({ rows: [] }),
    query(`SELECT mine_id, factory_id, distance_km FROM routes`)
  ]);

  const vehicleMap = new Map(vehicles.rows.map((row) => [row.vehicle_no.toUpperCase(), row]));
  const deliveryOrderMap = new Map(deliveryOrders.rows.map((row) => [row.do_number.toLowerCase(), row]));
  const mineMap = new Map(mines.rows.map((row) => [row.name.toLowerCase(), row]));
  const factoryMap = new Map(factories.rows.map((row) => [row.name.toLowerCase(), row]));
  const activeDriverMap = new Map(drivers.rows.map((row) => [row.name.toLowerCase(), row]));
  const existingTripMap = new Map(existingTrips.rows.map((row) => [row.lr_number, row]));
  const routeMap = new Map(routes.rows.map((row) => [`${row.mine_id}|${row.factory_id}`, row]));

  return rows.map((row) => {
    const existing = row.lr_number ? existingTripMap.get(row.lr_number) || null : null;
    const action = existing ? 'update' : 'create';
    const deliveryOrder = row.do_number ? deliveryOrderMap.get(lower(row.do_number)) || null : null;
    const vehicle = row.vehicle_no ? vehicleMap.get(row.vehicle_no) || null : null;
    const mine = !deliveryOrder && row.mine_name ? mineMap.get(lower(row.mine_name)) || null : null;
    const factory = !deliveryOrder && row.factory_name ? factoryMap.get(lower(row.factory_name)) || null : null;
    const driver = row.driver_name ? activeDriverMap.get(lower(row.driver_name)) || null : null;

    if (action === 'create' && !row.trip_date) row.errors.push('trip_date is required for new trips');
    if (action === 'create' && !row.vehicle_no) row.errors.push('vehicle_no is required for new trips');
    if (action === 'create' && !row.driver_name) row.errors.push('driver_name is required for new trips');

    if (row.lr_number && !existing) {
      row.warnings.push('No existing trip matched this LR number, so a new trip will be created');
    }
    if (!row.lr_number) {
      row.warnings.push('LR number will be auto-generated during import');
    }

    if (row.do_number && !deliveryOrder) {
      row.errors.push(`delivery order ${row.do_number} was not found`);
    }
    if (deliveryOrder?.status === 'cancelled') {
      row.errors.push('selected delivery order is cancelled');
    }

    if (row.vehicle_no && !vehicle) {
      row.errors.push(`vehicle ${row.vehicle_no} was not found`);
    }
    if (vehicle && !vehicle.is_active) {
      row.errors.push(`vehicle ${row.vehicle_no} is inactive`);
    }
    if (vehicle?.status === 'repair') {
      row.errors.push(`vehicle ${row.vehicle_no} is under repair`);
    }

    if (!deliveryOrder && row.mine_name && !mine) {
      row.errors.push(`mine ${row.mine_name} was not found`);
    }
    if (!deliveryOrder && row.factory_name && !factory) {
      row.errors.push(`factory ${row.factory_name} was not found`);
    }
    if (deliveryOrder && (row.mine_name || row.factory_name)) {
      row.warnings.push('D.O. controls mine and factory, so typed route values will be ignored');
    }

    if (row.driver_name && !driver) {
      row.warnings.push(`driver ${row.driver_name} will be created automatically`);
    }

    const finalMineId = deliveryOrder?.mine_id || mine?.id || existing?.mine_id || null;
    const finalFactoryId = deliveryOrder?.factory_id || factory?.id || existing?.factory_id || null;
    const finalMineName = deliveryOrder?.mine_name || mine?.name || existing?.mine_name || null;
    const finalFactoryName = deliveryOrder?.factory_name || factory?.name || existing?.factory_name || null;
    const finalRatePerTon = row.rate_per_ton ?? deliveryOrder?.rate_per_ton ?? existing?.rate_per_ton ?? null;
    const finalWeightTons = row.weight_tons ?? existing?.weight_tons ?? null;
    const finalReturnFromName = row.return_from_name || existing?.return_from_name || finalFactoryName || null;
    const finalReturnPartyName = row.return_party_name || existing?.return_party_name || null;
    const finalReturnToName = row.return_to_name || existing?.return_to_name || null;
    const finalReturnWeightTons = row.return_weight_tons ?? existing?.return_weight_tons ?? null;
    const finalReturnRatePerTon = row.return_rate_per_ton ?? existing?.return_rate_per_ton ?? null;
    const finalReturnNotes = row.return_notes ?? existing?.return_notes ?? null;
    const finalTripDate = row.trip_date || existing?.trip_date || null;
    const route = finalMineId && finalFactoryId ? routeMap.get(`${finalMineId}|${finalFactoryId}`) || null : null;

    if (finalMineId && finalFactoryId && !route) {
      row.warnings.push('No route matched this mine and factory, so distance will stay blank');
    }
    if (deliveryOrder && row.weight_tons !== null && row.weight_tons > Number(deliveryOrder.pending_tons || 0)) {
      row.warnings.push('Weight is higher than pending D.O. tons');
    }

    row.action = action;
    row.preview_text = buildPreviewText({
      final: {
        lr_number: row.lr_number || null,
        do_number: deliveryOrder?.do_number || existing?.do_number || null,
        vehicle_no: row.vehicle_no || existing?.vehicle_no || null,
        driver_name: row.driver_name || existing?.driver_name || null,
        mine_name: finalMineName,
        factory_name: finalFactoryName,
        return_party_name: finalReturnPartyName,
        return_to_name: finalReturnToName
      }
    });
    row.final = {
      trip_date: finalTripDate,
      lr_number: row.lr_number || 'AUTO',
      do_number: deliveryOrder?.do_number || existing?.do_number || null,
      vehicle_no: row.vehicle_no || existing?.vehicle_no || null,
      driver_name: row.driver_name || existing?.driver_name || null,
      mine_name: finalMineName,
      factory_name: finalFactoryName,
      weight_tons: finalWeightTons,
      rate_per_ton: finalRatePerTon,
      return_party_name: finalReturnPartyName,
      return_from_name: finalReturnFromName,
      return_to_name: finalReturnToName,
      return_weight_tons: finalReturnWeightTons,
      return_rate_per_ton: finalReturnRatePerTon
    };
    row.importPayload = {
      trip_date: row.trip_date || undefined,
      lr_number: row.lr_number || undefined,
      do_number: row.do_number || undefined,
      vehicle_no: row.vehicle_no || undefined,
      driver_name: row.driver_name || undefined,
      mine_name: row.mine_name || undefined,
      factory_name: row.factory_name || undefined,
      weight_tons: row.weight_tons ?? undefined,
      rate_per_ton: row.rate_per_ton ?? undefined,
      return_party_name: row.return_party_name || undefined,
      return_from_name: row.return_from_name || undefined,
      return_to_name: row.return_to_name || undefined,
      return_weight_tons: row.return_weight_tons ?? undefined,
      return_rate_per_ton: row.return_rate_per_ton ?? undefined,
      return_notes: row.return_notes ?? undefined,
      notes: row.notes ?? undefined,
      expense: {
        diesel_litres: row.diesel_litres ?? undefined,
        diesel_cost: row.diesel_cost ?? undefined,
        driver_allowance: row.driver_allowance ?? undefined,
        toll: row.toll ?? undefined,
        other_expenses: row.other_expenses ?? undefined
      }
    };

    return row;
  });
}

export async function previewTripWorkbook(buffer) {
  const rows = await enrichRows(await loadWorkbookRows(buffer));
  if (rows.length === 0) throw new ApiError(400, 'No trip rows found');
  return buildSummary(rows);
}

export async function importTripsFromWorkbook(buffer, userId) {
  const summary = await previewTripWorkbook(buffer);
  await withTransaction(async (client) => {
    for (const row of summary.rows) {
      if (row.errors.length) continue;
      await saveTripFromPayload(client, row.importPayload, userId);
    }
  });

  return {
    totalRows: summary.totalRows,
    created: summary.creates,
    updated: summary.updates,
    failed: summary.failed,
    errors: summary.rows.filter((row) => row.errors.length).map((row) => ({
      row: row.rowNumber,
      lr_number: row.lr_number,
      vehicle_no: row.vehicle_no,
      errors: row.errors
    }))
  };
}

export async function buildTripTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Coal TMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Trips');
  styleSheet(sheet);
  sheet.addRows([
    {
      trip_date: '2026-04-20',
      lr_number: '',
      do_number: 'DO-2026-001',
      vehicle_no: 'CG04AB1234',
      driver_name: 'Raju Kumar',
      mine_name: '',
      factory_name: '',
      weight_tons: 28.5,
      rate_per_ton: '',
      return_party_name: 'Fresh return consignee',
      return_from_name: 'Shree Cement',
      return_to_name: 'Raipur Yard',
      return_weight_tons: 21,
      return_rate_per_ton: 930,
      diesel_litres: 42,
      diesel_cost: 3800,
      driver_allowance: 700,
      toll: 450,
      other_expenses: '',
      return_notes: 'Optional return load on the same trip record',
      notes: 'Fresh trip, LR auto-assign'
    },
    {
      trip_date: '',
      lr_number: 'LR-20260418-0001',
      do_number: '',
      vehicle_no: '',
      driver_name: '',
      mine_name: '',
      factory_name: '',
      weight_tons: '',
      rate_per_ton: '',
      return_party_name: '',
      return_from_name: '',
      return_to_name: '',
      return_weight_tons: '',
      return_rate_per_ton: '',
      diesel_litres: '',
      diesel_cost: '',
      driver_allowance: 900,
      toll: 525,
      other_expenses: '',
      return_notes: '',
      notes: 'Update existing trip later using the LR number'
    },
    {
      trip_date: '2026-04-20',
      lr_number: '',
      do_number: '',
      vehicle_no: 'JH10MK4567',
      driver_name: 'New Driver Name',
      mine_name: 'Dipka Mine',
      factory_name: 'Shree Cement',
      weight_tons: '',
      rate_per_ton: '',
      return_party_name: '',
      return_from_name: 'Shree Cement',
      return_to_name: '',
      return_weight_tons: '',
      return_rate_per_ton: '',
      diesel_litres: '',
      diesel_cost: '',
      driver_allowance: '',
      toll: '',
      other_expenses: '',
      return_notes: '',
      notes: 'New driver name will be created automatically'
    }
  ]);

  const help = workbook.addWorksheet('Instructions');
  help.columns = [{ width: 30 }, { width: 90 }];
  help.addRows([
    ['Column', 'How to fill'],
    ['trip_date', 'Required for new trips. Use yyyy-mm-dd. For updates, leave blank to keep the current date.'],
    ['lr_number', 'Optional for new trips. Leave blank to auto-assign. For later updates, keep the exported LR number and fill only the new values.'],
    ['do_number', 'Optional. If provided, mine and factory are pulled from the D.O. automatically.'],
    ['vehicle_no', 'Required for new trips. Must match an existing truck number. Blank on updates means keep the current truck.'],
    ['driver_name', 'Required for new trips. If the name does not exist yet, the driver will be created automatically. Blank on updates means keep the current driver.'],
    ['mine_name / factory_name', 'Optional when there is no D.O. number. If D.O. is present, these are ignored.'],
    ['weight_tons / rate_per_ton', 'Optional. Blank on updates keeps the current value.'],
    ['return_* columns', 'Optional. Use these for the return load from factory back toward the next destination. Blank values keep current return-load details on update.'],
    ['Expense columns', 'Optional. Blank on updates keeps current expense values.'],
    ['notes', 'Optional. Blank on updates keeps the current note.']
  ]);
  help.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  help.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };

  return workbook;
}

export async function buildTripExportWorkbook() {
  const result = await query(
    `SELECT
      t.trip_date,
      t.lr_number,
      dord.do_number,
      v.vehicle_no,
      t.driver_name,
      m.name AS mine_name,
      f.name AS factory_name,
      t.weight_tons,
      t.rate_per_ton,
      t.return_party_name,
      t.return_from_name,
      t.return_to_name,
      t.return_weight_tons,
      t.return_rate_per_ton,
      COALESCE(e.diesel_litres, 0) AS diesel_litres,
      COALESCE(e.diesel_cost, 0) AS diesel_cost,
      COALESCE(e.driver_allowance, 0) AS driver_allowance,
      COALESCE(e.toll, 0) AS toll,
      COALESCE(e.other_expenses, 0) AS other_expenses,
      t.return_notes,
      t.notes
     FROM trips t
     JOIN vehicles v ON v.id = t.vehicle_id
     LEFT JOIN delivery_orders dord ON dord.id = t.delivery_order_id
     LEFT JOIN mines m ON m.id = t.mine_id
     LEFT JOIN factories f ON f.id = t.factory_id
     LEFT JOIN expenses e ON e.trip_id = t.id
     ORDER BY t.trip_date DESC, t.created_at DESC`
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Coal TMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Trips');
  styleSheet(sheet);
  sheet.addRows(result.rows);
  return workbook;
}
