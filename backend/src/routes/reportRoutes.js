import { Router } from 'express';
import { dashboard, dashboardCharts, dieselUsage, driverPerformance, tripProfit, truckProfit } from '../controllers/reportController.js';

const router = Router();

router.get('/trip-profit', tripProfit);
router.get('/truck-profit', truckProfit);
router.get('/driver-performance', driverPerformance);
router.get('/diesel-usage', dieselUsage);

export { dashboard, dashboardCharts };
export default router;
