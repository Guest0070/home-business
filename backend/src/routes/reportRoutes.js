import { Router } from 'express';
import {
  bankAccountsReport,
  bankLoansReport,
  bankTransactionsReport,
  complianceReport,
  dashboard,
  dashboardCharts,
  deliveryOrdersReport,
  dieselUsage,
  driverPerformance,
  loanInstallmentsReport,
  paymentsReport,
  salaryPaymentsReport,
  tripProfit,
  truckProfit
} from '../controllers/reportController.js';

const router = Router();

router.get('/trip-profit', tripProfit);
router.get('/truck-profit', truckProfit);
router.get('/driver-performance', driverPerformance);
router.get('/diesel-usage', dieselUsage);
router.get('/delivery-orders', deliveryOrdersReport);
router.get('/payments', paymentsReport);
router.get('/salary-payments', salaryPaymentsReport);
router.get('/bank-accounts', bankAccountsReport);
router.get('/bank-transactions', bankTransactionsReport);
router.get('/bank-loans', bankLoansReport);
router.get('/loan-installments', loanInstallmentsReport);
router.get('/compliance-reminders', complianceReport);

export { dashboard, dashboardCharts };
export default router;
