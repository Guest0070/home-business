import { Router } from 'express';
import { z } from 'zod';
import { exportDataset } from '../controllers/exportController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const schema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    from: z.string().optional(),
    from_at: z.string().optional(),
    to: z.string().optional(),
    to_at: z.string().optional(),
    format: z.enum(['csv', 'json']).optional(),
    preset: z.enum(['standard', 'zoho', 'tally', 'sales-book', 'ledger-voucher']).optional()
  }),
  params: z.object({
    kind: z.enum([
      'trip-profit',
      'truck-profit',
      'driver-performance',
      'diesel-usage',
      'delivery-orders',
      'payments',
      'salary-payments',
      'bank-accounts',
      'bank-transactions',
      'bank-loans',
      'loan-installments',
      'compliance-reminders',
      'vehicles'
    ])
  })
});

router.get('/:kind', validate(schema), exportDataset);

export default router;
