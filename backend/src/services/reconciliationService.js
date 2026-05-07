import ExcelJS from 'exceljs';
import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

function normaliseText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && value.text) return String(value.text).trim();
  return String(value).trim();
}

function parseNumber(value) {
  const text = normaliseText(value);
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return number;
}

function getCell(row, headerMap, names) {
  const key = names.find((name) => headerMap.has(name));
  if (!key) return '';
  return row.getCell(headerMap.get(key)).value;
}

async function readReconciliationRows(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet('Reconciliation') || workbook.worksheets[0];
  if (!sheet) throw new ApiError(400, 'Workbook has no sheets');

  const headerMap = new Map();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headerMap.set(normaliseText(cell.value).toLowerCase(), colNumber);
  });

  if (!headerMap.has('factory_weight_tons') && !headerMap.has('received_weight_tons')) {
    throw new ApiError(400, 'Missing factory_weight_tons or received_weight_tons column');
  }

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const lrNumber = normaliseText(getCell(row, headerMap, ['lr_number', 'lr']));
    const vehicleNo = normaliseText(getCell(row, headerMap, ['vehicle_no', 'vehicle_reg', 'truck_no'])).toUpperCase();
    const tripDate = normaliseText(getCell(row, headerMap, ['trip_date', 'date']));
    const factoryWeightTons = parseNumber(getCell(row, headerMap, ['factory_weight_tons', 'received_weight_tons']));
    const factoryReference = normaliseText(getCell(row, headerMap, ['factory_reference', 'reference_no', 'weighment_no']));
    const notes = normaliseText(getCell(row, headerMap, ['notes', 'narration']));

    if (![lrNumber, vehicleNo, tripDate, factoryWeightTons, factoryReference, notes].some(Boolean)) return;

    rows.push({
      rowNumber,
      lr_number: lrNumber || null,
      vehicle_no: vehicleNo || null,
      trip_date: tripDate || null,
      factory_weight_tons: factoryWeightTons,
      factory_reference: factoryReference || null,
      notes: notes || null,
      errors: [],
      warnings: []
    });
  });

  return rows;
}

function buildReference(trip, row) {
  return `SHORTAGE:${trip.lr_number || row.trip_date}:${trip.vehicle_no}`;
}

async function enrichRows(rows) {
  const lrNumbers = rows.map((row) => row.lr_number).filter(Boolean);
  const vehicleDates = rows.filter((row) => !row.lr_number && row.vehicle_no && row.trip_date);

  const [lrTrips, vehicleTrips, existingDeductions] = await Promise.all([
    lrNumbers.length
      ? query(
        `SELECT id, lr_number, trip_date, vehicle_no, vehicle_id, factory_id, factory_name, weight_tons, rate_per_ton
         FROM trip_financials
         WHERE lr_number = ANY($1::text[])`,
        [lrNumbers]
      )
      : Promise.resolve({ rows: [] }),
    vehicleDates.length
      ? query(
        `SELECT id, lr_number, trip_date, vehicle_no, vehicle_id, factory_id, factory_name, weight_tons, rate_per_ton
         FROM trip_financials
         WHERE (vehicle_no, trip_date) IN (${vehicleDates.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2}::date)`).join(', ')})`,
        vehicleDates.flatMap((row) => [row.vehicle_no, row.trip_date])
      )
      : Promise.resolve({ rows: [] }),
    query(`SELECT reference_no FROM payments WHERE payment_type = 'shortage_deduction' AND reference_no IS NOT NULL`)
  ]);

  const byLr = new Map(lrTrips.rows.map((trip) => [trip.lr_number, trip]));
  const byVehicleDate = new Map(vehicleTrips.rows.map((trip) => [`${trip.vehicle_no}|${trip.trip_date}`, trip]));
  const existingReferences = new Set(existingDeductions.rows.map((row) => row.reference_no));
  const seenComposite = new Set();

  return rows.map((row) => {
    const trip = row.lr_number
      ? byLr.get(row.lr_number)
      : byVehicleDate.get(`${row.vehicle_no}|${row.trip_date}`);

    if (!row.lr_number && (!row.vehicle_no || !row.trip_date)) {
      row.errors.push('Provide lr_number or vehicle_no + trip_date');
    }
    if (row.factory_weight_tons === null || row.factory_weight_tons < 0) {
      row.errors.push('factory_weight_tons must be a valid non-negative number');
    }
    if (!trip) {
      row.errors.push('No trip matched this reconciliation row');
    }

    const composite = `${row.lr_number || trip?.lr_number || row.trip_date}|${row.vehicle_no || trip?.vehicle_no || ''}`;
    if (seenComposite.has(composite)) {
      row.errors.push('Duplicate reconciliation row in this file for the same LR/vehicle');
    }
    seenComposite.add(composite);

    const tripWeight = Number(trip?.weight_tons || 0);
    const shortageTons = trip && row.factory_weight_tons !== null
      ? Math.max(tripWeight - row.factory_weight_tons, 0)
      : 0;
    const deductionAmount = shortageTons * Number(trip?.rate_per_ton || 0);
    const referenceNo = trip ? buildReference(trip, row) : null;

    if (trip && row.factory_weight_tons > tripWeight) {
      row.warnings.push('Factory weight is higher than trip weight, so no shortage deduction will be created');
    }
    if (trip && shortageTons === 0) {
      row.warnings.push('No shortage detected');
    }
    if (trip && !trip.factory_id) {
      row.errors.push('Matched trip has no party/factory');
    }
    if (referenceNo && existingReferences.has(referenceNo)) {
      row.action = 'duplicate';
      row.warnings.push('Shortage deduction already exists for this LR and vehicle');
    } else {
      row.action = shortageTons > 0 ? 'create' : 'skip';
    }

    row.trip = trip || null;
    row.reference_no = referenceNo;
    row.shortage_tons = shortageTons;
    row.deduction_amount = deductionAmount;
    row.preview_text = trip
      ? `${trip.lr_number || '-'} | ${trip.vehicle_no} | ${trip.factory_name || '-'} | shortage ${shortageTons.toFixed(3)} t`
      : 'No matched trip';
    row.final = {
      lr_number: trip?.lr_number || row.lr_number || '-',
      vehicle_no: trip?.vehicle_no || row.vehicle_no || '-',
      trip_date: trip?.trip_date || row.trip_date || '-',
      trip_weight_tons: tripWeight,
      factory_weight_tons: row.factory_weight_tons,
      shortage_tons: shortageTons,
      deduction_amount: deductionAmount
    };

    return row;
  });
}

function buildSummary(rows) {
  return {
    totalRows: rows.length,
    creates: rows.filter((row) => row.action === 'create' && row.errors.length === 0).length,
    duplicates: rows.filter((row) => row.action === 'duplicate').length,
    skipped: rows.filter((row) => row.action === 'skip' && row.errors.length === 0).length,
    failed: rows.filter((row) => row.errors.length > 0).length,
    rows
  };
}

export async function previewReconciliationWorkbook(buffer) {
  const rows = await enrichRows(await readReconciliationRows(buffer));
  if (!rows.length) throw new ApiError(400, 'No reconciliation rows found');
  return buildSummary(rows);
}

export async function importReconciliationWorkbook(buffer, userId) {
  const summary = await previewReconciliationWorkbook(buffer);
  await withTransaction(async (client) => {
    for (const row of summary.rows) {
      if (row.errors.length || row.action !== 'create') continue;
      await client.query(
        `INSERT INTO payments (
          factory_id, delivery_order_id, trip_id, payment_type, payment_date, amount,
          mode, reference_no, narration, notes, created_by
        )
        VALUES ($1,NULL,$2,'shortage_deduction',$3,$4,'shortage_deduction',$5,$6,$7,$8)
        ON CONFLICT (reference_no) WHERE payment_type = 'shortage_deduction' DO NOTHING`,
        [
          row.trip.factory_id,
          row.trip.id,
          row.trip.trip_date,
          row.deduction_amount,
          row.reference_no,
          `Shortage deduction for ${row.trip.lr_number || row.trip.vehicle_no}: ${row.shortage_tons.toFixed(3)} t`,
          row.notes || row.factory_reference || null,
          userId
        ]
      );
    }
  });

  return {
    totalRows: summary.totalRows,
    created: summary.creates,
    duplicates: summary.duplicates,
    skipped: summary.skipped,
    failed: summary.failed,
    errors: summary.rows.filter((row) => row.errors.length).map((row) => ({
      row: row.rowNumber,
      lr_number: row.lr_number,
      vehicle_no: row.vehicle_no,
      errors: row.errors
    }))
  };
}

export async function buildReconciliationTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Coal TMS';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Reconciliation');
  sheet.columns = [
    { header: 'lr_number', key: 'lr_number', width: 20 },
    { header: 'vehicle_no', key: 'vehicle_no', width: 18 },
    { header: 'trip_date', key: 'trip_date', width: 14 },
    { header: 'factory_weight_tons', key: 'factory_weight_tons', width: 20 },
    { header: 'factory_reference', key: 'factory_reference', width: 24 },
    { header: 'notes', key: 'notes', width: 34 }
  ];
  sheet.addRow({
    lr_number: 'LR-20260418-0001',
    vehicle_no: 'CG04AB1234',
    trip_date: '2026-04-18',
    factory_weight_tons: 27.82,
    factory_reference: 'WEIGH-001',
    notes: 'Factory shortage report'
  });
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return workbook;
}
