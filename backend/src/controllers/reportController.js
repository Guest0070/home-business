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
        (SELECT COUNT(*) FROM vehicles WHERE is_active = TRUE AND status <> 'repair')::INT AS active_vehicles,
        (SELECT ROUND(COALESCE(SUM(total_expense) / NULLIF(SUM(weight_tons), 0), 0), 2)
         FROM trip_financials
         WHERE trip_date >= CURRENT_DATE - INTERVAL '29 days') AS cost_per_ton,
        (SELECT ROUND(COALESCE(SUM(freight) / NULLIF(SUM(distance_km), 0), 0), 2)
         FROM trip_financials
         WHERE trip_date >= CURRENT_DATE - INTERVAL '29 days') AS earnings_per_km`
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function dashboardCharts(_req, res, next) {
  try {
    const [dailyTrend, truckProfitRows, driverRows, ledgerRows, routeMetricsRows] = await Promise.all([
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
      ),
      query(
        `SELECT
          COALESCE(mine_name, 'No mine') AS mine_name,
          COALESCE(factory_name, 'No party') AS factory_name,
          COUNT(*)::INT AS trips,
          ROUND(SUM(weight_tons), 3) AS tons,
          ROUND(SUM(distance_km), 2) AS distance_km,
          ROUND(SUM(freight), 2) AS freight,
          ROUND(SUM(total_expense), 2) AS expense,
          ROUND(SUM(profit), 2) AS profit,
          ROUND(COALESCE(SUM(total_expense) / NULLIF(SUM(weight_tons), 0), 0), 2) AS cost_per_ton,
          ROUND(COALESCE(SUM(freight) / NULLIF(SUM(distance_km), 0), 0), 2) AS earnings_per_km
         FROM trip_financials
         WHERE trip_date >= CURRENT_DATE - INTERVAL '29 days'
         GROUP BY mine_name, factory_name
         HAVING COUNT(*) > 0
         ORDER BY cost_per_ton DESC, profit ASC
         LIMIT 8`
      )
    ]);

    res.json({
      dailyTrend: dailyTrend.rows,
      truckProfit: truckProfitRows.rows,
      driverRanking: driverRows.rows,
      partyLedger: ledgerRows.rows,
      routeMetrics: routeMetricsRows.rows
    });
  } catch (error) {
    next(error);
  }
}

export async function dashboardExceptions(_req, res, next) {
  try {
    const [dispatchBlocks, deliveryPressure, activeHalts, loanDues, complianceDue] = await Promise.all([
      query(
        `WITH dispatch_docs AS (
          SELECT
            vehicle_id,
            MIN(due_date) FILTER (WHERE document_type IN ('pollution_certificate', 'all_india_permit') AND status <> 'completed') AS next_due,
            COUNT(*) FILTER (
              WHERE document_type IN ('pollution_certificate', 'all_india_permit')
                AND status <> 'completed'
                AND due_date <= CURRENT_DATE + INTERVAL '2 days'
            )::INT AS blocked_count,
            COUNT(*) FILTER (
              WHERE document_type IN ('pollution_certificate', 'all_india_permit')
                AND status <> 'completed'
                AND due_date > CURRENT_DATE + INTERVAL '2 days'
                AND due_date <= CURRENT_DATE + INTERVAL '7 days'
            )::INT AS warning_count
          FROM vehicle_compliance_items
          GROUP BY vehicle_id
        )
        SELECT
          v.id,
          v.vehicle_no,
          v.status,
          d.next_due,
          CASE WHEN d.blocked_count > 0 THEN 'blocked' ELSE 'warning' END AS severity
        FROM vehicles v
        JOIN dispatch_docs d ON d.vehicle_id = v.id
        WHERE v.is_active = TRUE
          AND (d.blocked_count > 0 OR d.warning_count > 0)
        ORDER BY CASE WHEN d.blocked_count > 0 THEN 0 ELSE 1 END, d.next_due ASC
        LIMIT 12`
      ),
      query(
        `SELECT id, do_number, mine_name, factory_name, pending_tons, priority, tracking_status, days_left
         FROM delivery_order_progress
         WHERE status = 'open'
          AND (
            tracking_status IN ('behind', 'expired')
            OR priority IN ('high', 'urgent')
            OR days_left BETWEEN 0 AND 2
          )
         ORDER BY
          CASE tracking_status WHEN 'expired' THEN 0 WHEN 'behind' THEN 1 ELSE 2 END,
          CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
          days_left ASC NULLS LAST
         LIMIT 12`
      ),
      query(
        `SELECT h.id, h.trip_id, h.halt_type, h.started_at, h.location, h.notes, t.lr_number, t.driver_name, v.vehicle_no
         FROM trip_halt_logs h
         JOIN trips t ON t.id = h.trip_id
         JOIN vehicles v ON v.id = t.vehicle_id
         WHERE h.ended_at IS NULL
         ORDER BY h.started_at ASC
         LIMIT 12`
      ),
      query(
        `SELECT i.id, i.due_date, i.amount, i.status, l.loan_name, l.lender_name, a.account_name
         FROM bank_loan_installments i
         JOIN bank_loans l ON l.id = i.loan_id
         LEFT JOIN bank_accounts a ON a.id = l.bank_account_id
         WHERE l.is_active = TRUE
          AND i.status IN ('due', 'overdue')
          AND i.due_date <= CURRENT_DATE + INTERVAL '7 days'
         ORDER BY i.due_date ASC
         LIMIT 12`
      ),
      query(
        `SELECT id, vehicle_no, document_type, due_date, days_left, reminder_state
         FROM compliance_reminders
         WHERE status <> 'completed'
          AND reminder_state IN ('overdue', 'due_soon')
         ORDER BY due_date ASC, vehicle_no
         LIMIT 12`
      )
    ]);

    res.json({
      dispatchBlocks: dispatchBlocks.rows,
      deliveryPressure: deliveryPressure.rows,
      activeHalts: activeHalts.rows,
      loanDues: loanDues.rows,
      complianceDue: complianceDue.rows,
      counts: {
        dispatchBlocks: dispatchBlocks.rows.length,
        deliveryPressure: deliveryPressure.rows.length,
        activeHalts: activeHalts.rows.length,
        loanDues: loanDues.rows.length,
        complianceDue: complianceDue.rows.length
      }
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
