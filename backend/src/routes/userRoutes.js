import { Router } from 'express';
import { z } from 'zod';
import { createUser, listUsers } from '../controllers/userController.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const createSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['admin', 'user', 'company']),
    companyName: z.string().max(160).optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({})
});

router.use(authorize('admin'));
router.get('/', listUsers);
router.post('/', validate(createSchema), createUser);

export default router;

