import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  createBankAccount,
  deleteBankAccount,
  deleteBankTransaction,
  deleteLoan,
  createBankTransaction,
  createLoan,
  importStatement,
  listBankAccounts,
  listBankTransactions,
  listLoans,
  previewStatement,
  updateInstallmentStatus
} from '../controllers/bankingController.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.csv')) {
      cb(new Error('Only .xlsx and .csv files are supported'));
      return;
    }
    cb(null, true);
  }
});

const base = {
  query: z.object({}).passthrough(),
  params: z.object({})
};

const accountSchema = z.object({
  ...base,
  body: z.object({
    account_name: z.string().min(2).max(140),
    bank_name: z.string().min(2).max(140),
    account_holder_name: z.string().max(160).optional(),
    account_number_last4: z.string().max(8).optional(),
    ifsc_code: z.string().max(30).optional(),
    opening_balance: z.coerce.number().optional().default(0),
    zoho_account_name: z.string().max(160).optional(),
    tally_ledger_name: z.string().max(160).optional(),
    is_active: z.boolean().optional().default(true)
  })
});

const transactionSchema = z.object({
  ...base,
  body: z.object({
    bank_account_id: z.string().uuid(),
    entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    value_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    direction: z.enum(['credit', 'debit']),
    amount: z.coerce.number().positive(),
    narration: z.string().min(2),
    reference_no: z.string().max(120).optional(),
    balance_after: z.coerce.number().optional()
  })
});

const loanSchema = z.object({
  ...base,
  body: z.object({
    bank_account_id: z.string().uuid().optional().or(z.literal('')),
    loan_name: z.string().min(2).max(160),
    lender_name: z.string().min(2).max(160),
    sanction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    disbursement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    principal_amount: z.coerce.number().positive(),
    outstanding_amount: z.coerce.number().nonnegative().optional(),
    emi_amount: z.coerce.number().positive().optional(),
    interest_rate: z.coerce.number().nonnegative().optional(),
    repayment_day: z.coerce.number().int().min(1).max(31).optional(),
    next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    reminder_days: z.coerce.number().int().nonnegative().optional().default(7),
    narration: z.string().optional(),
    zoho_loan_name: z.string().max(160).optional(),
    tally_ledger_name: z.string().max(160).optional(),
    is_active: z.boolean().optional().default(true)
  })
});

const installmentSchema = z.object({
  body: z.object({
    status: z.enum(['due', 'paid', 'overdue', 'skipped']),
    paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    notes: z.string().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() })
});

const idSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() })
});

router.get('/accounts', listBankAccounts);
router.post('/accounts', authorize('admin', 'company'), validate(accountSchema), createBankAccount);
router.delete('/accounts/:id', authorize('admin', 'company'), validate(idSchema), deleteBankAccount);
router.get('/transactions', listBankTransactions);
router.post('/transactions', authorize('admin', 'company'), validate(transactionSchema), createBankTransaction);
router.delete('/transactions/:id', authorize('admin', 'company'), validate(idSchema), deleteBankTransaction);
router.post('/statement/preview', authorize('admin', 'company'), upload.single('file'), previewStatement);
router.post('/statement/import', authorize('admin', 'company'), upload.single('file'), importStatement);
router.get('/loans', listLoans);
router.post('/loans', authorize('admin', 'company'), validate(loanSchema), createLoan);
router.delete('/loans/:id', authorize('admin', 'company'), validate(idSchema), deleteLoan);
router.patch('/installments/:id', authorize('admin', 'company'), validate(installmentSchema), updateInstallmentStatus);

export default router;
