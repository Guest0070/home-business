import { Router } from 'express';
import { z } from 'zod';
import { createDeliveryOrder, getDeliveryOrder, listDeliveryOrders } from '../controllers/deliveryOrderController.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

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
router.get('/:id', validate(idSchema), getDeliveryOrder);
router.post('/', authorize('admin', 'company'), validate(createSchema), createDeliveryOrder);

export default router;
