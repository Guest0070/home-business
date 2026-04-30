import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { createPayment, deletePayment, getLedger, listPayments } from '../controllers/paymentController.js';

const router = Router();

const listSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    factoryId: z.string().uuid().optional(),
    bankAccountId: z.string().uuid().optional()
  }),
  params: z.object({})
});

const createSchema = z.object({
  body: z.object({
    factory_id: z.string().uuid().optional().or(z.literal('')),
    delivery_order_id: z.string().uuid().optional().or(z.literal('')),
    bank_account_id: z.string().uuid().optional().or(z.literal('')),
    payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amount: z.coerce.number().positive(),
    mode: z.string().min(2).max(40).default('bank'),
    reference_no: z.string().max(120).optional(),
    narration: z.string().max(240).optional(),
    notes: z.string().optional(),
    allocations: z.array(z.object({
      trip_id: z.string().uuid(),
      amount: z.coerce.number().positive()
    })).optional().default([])
  }),
  query: z.object({}).passthrough(),
  params: z.object({})
});

const idSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() })
});

router.get('/', validate(listSchema), listPayments);
router.post('/', validate(createSchema), createPayment);
router.get('/ledger', getLedger);
router.delete('/:id', validate(idSchema), deletePayment);

export default router;
