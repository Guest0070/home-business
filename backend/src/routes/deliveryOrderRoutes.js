import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { createDeliveryOrder, deleteDeliveryOrder, getDeliveryOrder, listDeliveryOrders, updateDeliveryOrder } from '../controllers/deliveryOrderController.js';
import {
  downloadDeliveryOrderTemplate,
  exportDeliveryOrdersWorkbook,
  importDeliveryOrders,
  previewDeliveryOrders
} from '../controllers/deliveryOrderExcelController.js';
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

const base = {
  query: z.object({}).passthrough(),
  params: z.object({})
};

const createSchema = z.object({
  ...base,
  body: z.object({
    do_number: z.string().min(1).max(80),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mine_id: z.string().uuid().optional().or(z.literal('')),
    factory_id: z.string().uuid().optional().or(z.literal('')),
    total_tons: z.coerce.number().positive(),
    rate_per_ton: z.coerce.number().nonnegative().optional(),
    dispatch_target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    broker_name: z.string().max(140).optional(),
    priority: z.string().max(40).optional(),
    status: z.enum(['open', 'completed', 'cancelled']).optional(),
    notes: z.string().optional()
  })
});

const idSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() })
});

router.get('/', listDeliveryOrders);
router.get('/template', authorize('admin', 'company'), downloadDeliveryOrderTemplate);
router.get('/export', authorize('admin', 'company'), exportDeliveryOrdersWorkbook);
router.post('/import/preview', authorize('admin', 'company'), upload.single('file'), previewDeliveryOrders);
router.post('/import', authorize('admin', 'company'), upload.single('file'), importDeliveryOrders);
router.get('/:id', validate(idSchema), getDeliveryOrder);
router.post('/', authorize('admin', 'company'), validate(createSchema), createDeliveryOrder);
router.patch('/:id', authorize('admin', 'company'), validate(createSchema.extend({ params: z.object({ id: z.string().uuid() }) })), updateDeliveryOrder);
router.delete('/:id', authorize('admin', 'company'), validate(idSchema), deleteDeliveryOrder);

export default router;
