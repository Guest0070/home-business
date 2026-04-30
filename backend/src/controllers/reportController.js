import { query } from '../config/db.js';
import { loadDataset } from '../services/exportService.js';

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

function datasetResponder(kind) {
  return async (req, res, next) => {
    try {
      res.json(await loadDataset(kind, req.query));
    } catch (error) {
      next(error);
    }
  };
}

export const tripProfit = datasetResponder('trip-profit');
export const truckProfit = datasetResponder('truck-profit');
export const driverPerformance = datasetResponder('driver-performance');
export const dieselUsage = datasetResponder('diesel-usage');
export const deliveryOrdersReport = datasetResponder('delivery-orders');
export const paymentsReport = datasetResponder('payments');
export const salaryPaymentsReport = datasetResponder('salary-payments');
export const bankAccountsReport = datasetResponder('bank-accounts');
export const bankTransactionsReport = datasetResponder('bank-transactions');
export const bankLoansReport = datasetResponder('bank-loans');
export const loanInstallmentsReport = datasetResponder('loan-installments');
export const complianceReport = datasetResponder('compliance-reminders');
