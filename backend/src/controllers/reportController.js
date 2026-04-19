import { query } from '../config/db.js';

function dateWhere(req) {
  const values = [];
  const clauses = [];
  if (req.query.from) {
    values.push(req.query.from);
    clauses.push(`trip_date >= $${values.length}`);
  }
  if (req.query.to) {
    values.push(req.query.to);
    clauses.push(`trip_date <= $${values.length}`);
  }
  return { values, where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '' };
}

export async function dashboard(_req, res, next) {
  try {
    const result = await query(
      `SELECT
        (SELECT COUNT(*) FROM trips WHERE trip_date = CURRENT_DATE)::INT AS todays_trips,
        (SELECT COALESCE(SUM(profit), 0) FROM trip_financials WHERE trip_date = CURRENT_DATE) AS daily_profit,
        (SELECT COALESCE(SUM(profit), 0) FROM trip_financials WHERE date_trunc('month', trip_date) = date_trunc('month', CURRENT_DATE)) AS monthly_profit,
        (SELECT COALESCE(SUM(pending_balance), 0) FROM party_ledger) AS pending_payments,
        (SELECT COUNT(*) FROM vehicles WHERE is_active = TRUE AND status <> 'repair')::INT AS active_vehicles`
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function dashboardCharts(_req, res, next) {
  try {
    const [dailyTrend, truckProfitRows, driverRows, ledgerRows] = await Promise.all([
      query(
        `WITH days AS (
          SELECT generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
        )
        SELECT
          d.day,
          TO_CHAR(d.day, 'DD Mon') AS label,
          COALESCE(COUNT(tf.id), 0)::INT AS trips,
          COALESCE(ROUND(SUM(tf.freight), 2), 0) AS freight,
          COALESCE(ROUND(SUM(tf.total_expense), 2), 0) AS expenses,
          COALESCE(ROUND(SUM(tf.profit), 2), 0) AS profit
        FROM days d
        LEFT JOIN trip_financials tf ON tf.trip_date = d.day
        GROUP BY d.day
        ORDER BY d.day`
      ),
      query(
        `SELECT vehicle_no, ownership, COUNT(*)::INT AS trips, ROUND(SUM(profit), 2) AS profit
         FROM trip_financials
         WHERE trip_date >= CURRENT_DATE - INTERVAL '29 days'
         GROUP BY vehicle_no, ownership
         ORDER BY profit DESC
         LIMIT 8`
      ),
      query(
        `SELECT driver_name, total_trips, total_profit, average_profit, mileage, abnormal_diesel_trips
         FROM driver_performance
         ORDER BY total_profit DESC, mileage DESC NULLS LAST
         LIMIT 8`
      ),
      query(
        `SELECT factory_name, total_billing, payments_received, pending_balance
         FROM party_ledger
         WHERE pending_balance <> 0 OR total_billing <> 0 OR payments_received <> 0
         ORDER BY pending_balance DESC
         LIMIT 8`
      )
    ]);

    res.json({
      dailyTrend: dailyTrend.rows,
      truckProfit: truckProfitRows.rows,
      driverRanking: driverRows.rows,
      partyLedger: ledgerRows.rows
    });
  } catch (error) {
    next(error);
  }
}

export async function tripProfit(req, res, next) {
  try {
    const { where, values } = dateWhere(req);
    const result = await query(`SELECT * FROM trip_financials ${where} ORDER BY trip_date DESC`, values);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function truckProfit(req, res, next) {
  try {
    const { where, values } = dateWhere(req);
    const result = await query(
      `SELECT vehicle_id, vehicle_no, ownership, COUNT(*)::INT AS trips,
        ROUND(SUM(freight), 2) AS freight,
        ROUND(SUM(total_expense), 2) AS expenses,
        ROUND(SUM(profit), 2) AS profit,
        ROUND(SUM(distance_km), 2) AS distance_km
       FROM trip_financials
       ${where}
       GROUP BY vehicle_id, vehicle_no, ownership
       ORDER BY profit DESC`,
      values
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function driverPerformance(_req, res, next) {
  try {
    const result = await query('SELECT * FROM driver_performance ORDER BY total_profit DESC, mileage DESC NULLS LAST');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function dieselUsage(req, res, next) {
  try {
    const { where, values } = dateWhere(req);
    const result = await query(
      `SELECT lr_number, trip_date, vehicle_no, driver_name, mine_name, factory_name,
        distance_km, diesel_litres, mileage, abnormal_diesel
       FROM trip_financials
       ${where}
       ORDER BY abnormal_diesel DESC, trip_date DESC`,
      values
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}
