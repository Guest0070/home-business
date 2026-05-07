import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  createDriver,
  createDriverSalaryPayment,
  deleteDriver,
  deleteDriverSalaryPayment,
  listDriverHistory,
  listDrivers,
  listDriverSalaryPayments,
  updateDriver,
  updateDriverStatus
} from '../controllers/driverController.js';
import { downloadDriverTemplate, exportDrivers, importDrivers, previewDrivers } from '../controllers/driverExcelController.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      cb(new Error('Only .xlsx files are supported'));
      return;
    }
    cb(null, true);
  }
});

const driverBody = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().max(40).optional(),
  license_no: z.string().max(80).optional(),
  salary: z.coerce.number().nonnegative().optional(),
  status: z.enum(['available', 'on_duty', 'vacation', 'inactive']).optional(),
  current_vehicle_id: z.string().uuid().optional().or(z.literal('')),
  vacation_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  vacation_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
  is_active: z.boolean().optional()
});

const createSchema = z.object({
  body: driverBody,
  query: z.object({}).passthrough(),
  params: z.object({})
});

const updateSchema = z.object({
  body: driverBody,
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() })
});

const idSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() })
});

const statusSchema = z.object({
  body: z.object({
    status: z.enum(['available', 'on_duty', 'vacation', 'inactive']),
    current_vehicle_id: z.string().uuid().optional().or(z.literal('')),
    vacation_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    vacation_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() })
});

const listSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    status: z.enum(['available', 'on_duty', 'vacation', 'inactive']).optional(),
    activeOnly: z.enum(['true', 'false']).optional(),
    includeArchived: z.enum(['true', 'false']).optional()
  }),
  params: z.object({})
});

const salaryPaymentBody = z.object({
  driver_id: z.string().uuid(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().positive(),
  reference_no: z.string().max(120).optional(),
  narration: z.string().min(2).max(500),
  notes: z.string().optional()
});

const salaryPaymentCreateSchema = z.object({
  body: salaryPaymentBody,
  query: z.object({}).passthrough(),
  params: z.object({})
});

const salaryPaymentListSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    driverId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional()
  }),
  params: z.object({})
});

const salaryPaymentIdSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ salaryPaymentId: z.string().uuid() })
});

router.get('/', validate(listSchema), listDrivers);
router.get('/history', listDriverHistory);
router.get('/salary-payments', validate(salaryPaymentListSchema), listDriverSalaryPayments);
router.get('/template', authorize('admin', 'company'), downloadDriverTemplate);
router.get('/export', authorize('admin', 'company'), exportDrivers);
router.post('/import/preview', authorize('admin', 'company'), upload.single('file'), previewDrivers);
router.post('/import', authorize('admin', 'company'), upload.single('file'), importDrivers);
router.post('/', authorize('admin', 'company'), validate(createSchema), createDriver);
router.post('/salary-payments', authorize('admin', 'company'), validate(salaryPaymentCreateSchema), createDriverSalaryPayment);
router.put('/:id', authorize('admin', 'company'), validate(updateSchema), updateDriver);
router.patch('/:id/status', authorize('admin', 'company'), validate(statusSchema), updateDriverStatus);
router.delete('/salary-payments/:salaryPaymentId', authorize('admin', 'company'), validate(salaryPaymentIdSchema), deleteDriverSalaryPayment);
router.delete('/:id', authorize('admin', 'company'), validate(idSchema), deleteDriver);

export default router;
