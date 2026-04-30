import { Router } from 'express';
import { z } from 'zod';
import {
  createComplianceItem,
  deleteComplianceItem,
  getComplianceSummary,
  listComplianceItems,
  updateComplianceItem
} from '../controllers/complianceController.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const itemSchema = z.object({
  body: z.object({
    vehicle_id: z.string().uuid(),
    document_type: z.enum([
      'insurance',
      'road_tax',
      'fitness',
      'all_india_permit',
      'pollution_certificate',
      'mining_certificate'
    ]),
    reference_no: z.string().max(120).optional(),
    provider_name: z.string().max(140).optional(),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reminder_days: z.coerce.number().int().nonnegative().optional().default(15),
    status: z.enum(['active', 'completed', 'expired']).optional(),
    notes: z.string().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({})
});

const updateSchema = z.object({
  body: z.object({
    document_type: z.enum([
      'insurance',
      'road_tax',
      'fitness',
      'all_india_permit',
      'pollution_certificate',
      'mining_certificate'
    ]),
    reference_no: z.string().max(120).optional(),
    provider_name: z.string().max(140).optional(),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reminder_days: z.coerce.number().int().nonnegative().optional().default(15),
    status: z.enum(['active', 'completed', 'expired']).optional(),
    notes: z.string().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() })
});

const listSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    vehicleId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional()
  }),
  params: z.object({})
});

router.get('/summary', getComplianceSummary);
router.get('/', validate(listSchema), listComplianceItems);
router.post('/', authorize('admin', 'company'), validate(itemSchema), createComplianceItem);
router.patch('/:id', authorize('admin', 'company'), validate(updateSchema), updateComplianceItem);
router.delete('/:id', authorize('admin', 'company'), validate(z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() })
})), deleteComplianceItem);

export default router;
