import { createDriverFromName } from '../controllers/driverController.js';
import { appendDriverStatusHistory, todayDate } from './driverStatusService.js';
import { ApiError } from '../utils/apiError.js';

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

function cleanText(value) {
  if (!hasValue(value)) return null;
  return String(value).trim();
}

function cleanNumber(value, label, { positive = false, nonNegative = false } = {}) {
  if (!hasValue(value)) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new ApiError(400, `${label} must be a valid number`);
  }
  if (positive && number <= 0) {
    throw new ApiError(400, `${label} must be greater than zero`);
  }
  if (nonNegative && number < 0) {
    throw new ApiError(400, `${label} cannot be negative`);
  }
  return number;
}

async function generateUniqueLrNumber(client, tripDate) {
  const compactDate = String(tripDate).replaceAll('-', '');
  const countResult = await client.query(
    `SELECT COUNT(*)::INT AS trip_count
     FROM trips
     WHERE trip_date = $1`,
    [tripDate]
  );
  let nextCount = Number(countResult.rows[0]?.trip_count || 0) + 1;
  let candidate = `LR-${compactDate}-${String(nextCount).padStart(4, '0')}`;

  while (true) {
    const existing = await client.query('SELECT 1 FROM trips WHERE lr_number = $1', [candidate]);
    if (!existing.rows[0]) return candidate;
    nextCount += 1;
    candidate = `LR-${compactDate}-${String(nextCount).padStart(4, '0')}`;
  }
}

async function findVehicleById(client, vehicleId) {
  if (!hasValue(vehicleId)) return null;
  const result = await client.query(
    `SELECT id, vehicle_no, status, is_active
     FROM vehicles
     WHERE id = $1`,
    [cleanText(vehicleId)]
  );
  return result.rows[0] || null;
}

async function findVehicleByNumber(client, vehicleNo) {
  if (!hasValue(vehicleNo)) return null;
  const result = await client.query(
    `SELECT id, vehicle_no, status, is_active
     FROM vehicles
     WHERE UPPER(vehicle_no) = UPPER($1)`,
    [cleanText(vehicleNo)]
  );
  return result.rows[0] || null;
}

async function findDeliveryOrderById(client, deliveryOrderId) {
  if (!hasValue(deliveryOrderId)) return null;
  const result = await client.query(
    `SELECT id, do_number, mine_id, factory_id, rate_per_ton, status, pending_tons
     FROM delivery_order_progress
     WHERE id = $1`,
    [cleanText(deliveryOrderId)]
  );
  return result.rows[0] || null;
}

async function findDeliveryOrderByNumber(client, doNumber) {
  if (!hasValue(doNumber)) return null;
  const result = await client.query(
    `SELECT id, do_number, mine_id, factory_id, rate_per_ton, status, pending_tons
     FROM delivery_order_progress
     WHERE LOWER(do_number) = LOWER($1)`,
    [cleanText(doNumber)]
  );
  return result.rows[0] || null;
}

async function findMasterById(client, table, entityId) {
  if (!hasValue(entityId)) return null;
  const result = await client.query(`SELECT id, name FROM ${table} WHERE id = $1`, [cleanText(entityId)]);
  return result.rows[0] || null;
}

async function findMasterByName(client, table, name) {
  if (!hasValue(name)) return null;
  const result = await client.query(
    `SELECT id, name
     FROM ${table}
     WHERE LOWER(name) = LOWER($1)`,
    [cleanText(name)]
  );
  return result.rows[0] || null;
}

async function findRoute(client, mineId, factoryId) {
  if (!mineId || !factoryId) return null;
  const result = await client.query(
    `SELECT id, distance_km
     FROM routes
     WHERE mine_id = $1 AND factory_id = $2`,
    [mineId, factoryId]
  );
  return result.rows[0] || null;
}

async function findActiveDriverById(client, driverId) {
  if (!hasValue(driverId)) return null;
  const result = await client.query(
    `SELECT id, name, status, is_active
     FROM drivers
     WHERE id = $1 AND is_active = TRUE`,
    [cleanText(driverId)]
  );
  return result.rows[0] || null;
}

async function findExistingTripByLr(client, lrNumber) {
  if (!hasValue(lrNumber)) return null;
  const result = await client.query(
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
      t.route_id,
      t.delivery_order_id,
      dord.do_number,
      t.distance_km,
      t.weight_tons,
      t.rate_per_ton,
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
     WHERE t.lr_number = $1`,
    [cleanText(lrNumber)]
  );
  return result.rows[0] || null;
}

function ensureAllowedDriver(driver) {
  if (!driver) return;
  if (driver.status === 'vacation' || driver.status === 'inactive') {
    throw new ApiError(400, `Selected driver is ${driver.status}`);
  }
}

async function resolveVehicleForTrip(client, payload, existingTrip) {
  let vehicle = null;
  if (hasValue(payload.vehicle_id)) {
    vehicle = await findVehicleById(client, payload.vehicle_id);
    if (!vehicle) throw new ApiError(400, 'Selected vehicle was not found');
  } else if (hasValue(payload.vehicle_no)) {
    vehicle = await findVehicleByNumber(client, payload.vehicle_no);
    if (!vehicle) throw new ApiError(400, `Vehicle ${cleanText(payload.vehicle_no)} was not found`);
  } else if (existingTrip?.vehicle_id) {
    vehicle = await findVehicleById(client, existingTrip.vehicle_id);
  }

  if (!vehicle) throw new ApiError(400, 'Vehicle is required');
  if (!vehicle.is_active) throw new ApiError(400, 'Selected vehicle is inactive');
  if (vehicle.status === 'repair') throw new ApiError(400, 'Selected vehicle is under repair');
  return vehicle;
}

async function resolveDeliveryOrderForTrip(client, payload, existingTrip) {
  let deliveryOrder = null;
  if (hasValue(payload.delivery_order_id)) {
    deliveryOrder = await findDeliveryOrderById(client, payload.delivery_order_id);
    if (!deliveryOrder) throw new ApiError(400, 'Selected delivery order was not found');
  } else if (hasValue(payload.do_number)) {
    deliveryOrder = await findDeliveryOrderByNumber(client, payload.do_number);
    if (!deliveryOrder) throw new ApiError(400, `Delivery order ${cleanText(payload.do_number)} was not found`);
  } else if (existingTrip?.delivery_order_id) {
    deliveryOrder = await findDeliveryOrderById(client, existingTrip.delivery_order_id);
  }

  if (deliveryOrder?.status === 'cancelled') {
    throw new ApiError(400, 'Selected delivery order is cancelled');
  }
  return deliveryOrder;
}

async function resolveMasterId(client, table, idValue, nameValue, label) {
  if (hasValue(idValue)) {
    const row = await findMasterById(client, table, idValue);
    if (!row) throw new ApiError(400, `${label} was not found`);
    return row.id;
  }

  if (hasValue(nameValue)) {
    const row = await findMasterByName(client, table, nameValue);
    if (!row) throw new ApiError(400, `${label} ${cleanText(nameValue)} was not found`);
    return row.id;
  }

  return null;
}

async function resolveDriverForTrip(client, payload, existingTrip) {
  if (hasValue(payload.driver_id)) {
    const driver = await findActiveDriverById(client, payload.driver_id);
    if (!driver) throw new ApiError(400, 'Selected driver was not found');
    ensureAllowedDriver(driver);
    return {
      driverId: driver.id,
      driverName: driver.name,
      statusRefreshRequired: !existingTrip || existingTrip.driver_id !== driver.id
    };
  }

  if (hasValue(payload.driver_name)) {
    const driver = await createDriverFromName(client, cleanText(payload.driver_name));
    ensureAllowedDriver(driver);
    const existingDriverName = existingTrip?.driver_name?.trim().toLowerCase();
    return {
      driverId: driver.id,
      driverName: driver.name,
      statusRefreshRequired: !existingTrip || existingTrip.driver_id !== driver.id || existingDriverName !== driver.name.trim().toLowerCase()
    };
  }

  if (existingTrip) {
    return {
      driverId: existingTrip.driver_id || null,
      driverName: existingTrip.driver_name,
      statusRefreshRequired: false
    };
  }

  throw new ApiError(400, 'Driver name is required');
}

function buildExpensePayload(payloadExpense = {}, existingTrip = null) {
  return {
    diesel_litres: hasValue(payloadExpense.diesel_litres)
      ? cleanNumber(payloadExpense.diesel_litres, 'Diesel litres', { nonNegative: true })
      : Number(existingTrip?.diesel_litres || 0),
    diesel_cost: hasValue(payloadExpense.diesel_cost)
      ? cleanNumber(payloadExpense.diesel_cost, 'Diesel cost', { nonNegative: true })
      : Number(existingTrip?.diesel_cost || 0),
    driver_allowance: hasValue(payloadExpense.driver_allowance)
      ? cleanNumber(payloadExpense.driver_allowance, 'Driver allowance', { nonNegative: true })
      : Number(existingTrip?.driver_allowance || 0),
    toll: hasValue(payloadExpense.toll)
      ? cleanNumber(payloadExpense.toll, 'Toll', { nonNegative: true })
      : Number(existingTrip?.toll || 0),
    other_expenses: hasValue(payloadExpense.other_expenses)
      ? cleanNumber(payloadExpense.other_expenses, 'Other expenses', { nonNegative: true })
      : Number(existingTrip?.other_expenses || 0)
  };
}

async function refreshDriverStatus(client, driverId, vehicleId) {
  if (!driverId) return;
  await client.query(
    `UPDATE drivers
     SET status = 'on_duty',
      current_vehicle_id = $1,
      vacation_from = NULL,
      vacation_to = NULL,
      updated_at = NOW()
     WHERE id = $2`,
    [vehicleId, driverId]
  );
  await appendDriverStatusHistory(client, {
    driverId,
    status: 'on_duty',
    startDate: todayDate(),
    notes: 'Auto-updated from trip entry'
  });
}

export async function generateLrNumber(client, tripDate) {
  return generateUniqueLrNumber(client, tripDate);
}

export async function saveTripFromPayload(client, payload, userId) {
  const requestedLr = cleanText(payload.lr_number);
  const existingTrip = requestedLr ? await findExistingTripByLr(client, requestedLr) : null;

  const vehicle = await resolveVehicleForTrip(client, payload, existingTrip);
  const deliveryOrder = await resolveDeliveryOrderForTrip(client, payload, existingTrip);

  const mineIdFromInput = await resolveMasterId(client, 'mines', payload.mine_id, payload.mine_name, 'Mine');
  const factoryIdFromInput = await resolveMasterId(client, 'factories', payload.factory_id, payload.factory_name, 'Factory');

  const mineId = deliveryOrder?.mine_id || mineIdFromInput || existingTrip?.mine_id || null;
  const factoryId = deliveryOrder?.factory_id || factoryIdFromInput || existingTrip?.factory_id || null;
  const route = await findRoute(client, mineId, factoryId);
  const keepExistingRoute = existingTrip && mineId === existingTrip.mine_id && factoryId === existingTrip.factory_id;

  const tripDate = cleanText(payload.trip_date) || existingTrip?.trip_date || null;
  if (!tripDate) throw new ApiError(400, 'Trip date is required');

  const weightTons = hasValue(payload.weight_tons)
    ? cleanNumber(payload.weight_tons, 'Weight tons', { positive: true })
    : existingTrip?.weight_tons ?? null;
  const ratePerTon = hasValue(payload.rate_per_ton)
    ? cleanNumber(payload.rate_per_ton, 'Rate per ton', { nonNegative: true })
    : deliveryOrder?.rate_per_ton ?? existingTrip?.rate_per_ton ?? null;
  const notes = existingTrip
    ? (hasValue(payload.notes) ? cleanText(payload.notes) : existingTrip.notes)
    : cleanText(payload.notes);
  const expense = buildExpensePayload(payload.expense || {}, existingTrip);

  const driver = await resolveDriverForTrip(client, payload, existingTrip);

  const finalTrip = existingTrip
    ? await client.query(
      `UPDATE trips
       SET trip_date = $1,
        vehicle_id = $2,
        driver_id = $3,
        driver_name = $4,
        mine_id = $5,
        factory_id = $6,
        route_id = $7,
        delivery_order_id = $8,
        distance_km = $9,
        weight_tons = $10,
        rate_per_ton = $11,
        notes = $12,
        updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        tripDate,
        vehicle.id,
        driver.driverId,
        driver.driverName,
        mineId,
        factoryId,
        route?.id || (keepExistingRoute ? existingTrip.route_id : null),
        deliveryOrder?.id || existingTrip.delivery_order_id || null,
        route?.distance_km || (keepExistingRoute ? existingTrip.distance_km : null),
        weightTons,
        ratePerTon,
        notes,
        existingTrip.id
      ]
    )
    : await client.query(
      `INSERT INTO trips (
        trip_date, lr_number, vehicle_id, driver_id, driver_name, mine_id, factory_id,
        route_id, delivery_order_id, distance_km, weight_tons, rate_per_ton, notes, created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        tripDate,
        requestedLr || await generateUniqueLrNumber(client, tripDate),
        vehicle.id,
        driver.driverId,
        driver.driverName,
        mineId,
        factoryId,
        route?.id || null,
        deliveryOrder?.id || null,
        route?.distance_km || null,
        weightTons,
        ratePerTon,
        notes,
        userId
      ]
    );

  const trip = finalTrip.rows[0];

  if (existingTrip) {
    await client.query(
      `INSERT INTO expenses (trip_id, diesel_litres, diesel_cost, driver_allowance, toll, other_expenses)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (trip_id) DO UPDATE
       SET diesel_litres = EXCLUDED.diesel_litres,
        diesel_cost = EXCLUDED.diesel_cost,
        driver_allowance = EXCLUDED.driver_allowance,
        toll = EXCLUDED.toll,
        other_expenses = EXCLUDED.other_expenses,
        updated_at = NOW()
      `,
      [
        trip.id,
        expense.diesel_litres,
        expense.diesel_cost,
        expense.driver_allowance,
        expense.toll,
        expense.other_expenses
      ]
    );
  } else {
    await client.query(
      `INSERT INTO expenses (trip_id, diesel_litres, diesel_cost, driver_allowance, toll, other_expenses)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        trip.id,
        expense.diesel_litres,
        expense.diesel_cost,
        expense.driver_allowance,
        expense.toll,
        expense.other_expenses
      ]
    );
  }

  if (driver.driverId && (!existingTrip || driver.statusRefreshRequired || existingTrip.vehicle_id !== vehicle.id)) {
    await refreshDriverStatus(client, driver.driverId, vehicle.id);
  }

  await client.query(
    `UPDATE vehicles
     SET status = 'on_trip'
     WHERE id = $1 AND status <> 'repair'`,
    [vehicle.id]
  );

  const financialResult = await client.query('SELECT * FROM trip_financials WHERE id = $1', [trip.id]);
  return {
    action: existingTrip ? 'update' : 'create',
    trip: financialResult.rows[0]
  };
}
