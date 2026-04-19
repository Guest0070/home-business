import { Router } from 'express';
import { z } from 'zod';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createRoute, getDistance, listRoutes } from '../controllers/routeController.js';

const router = Router();

const createSchema = z.object({
  body: z.object({
    mine_id: z.string().uuid(),
    factory_id: z.string().uuid(),
    distance_km: z.coerce.number().positive(),
    expected_diesel_litres: z.coerce.number().positive().optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({})
});

const distanceSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    mineId: z.string().uuid(),
    factoryId: z.string().uuid()
  }),
  params: z.object({})
});

router.get('/', listRoutes);
router.post('/', authorize('admin'), validate(createSchema), createRoute);
router.get('/distance', validate(distanceSchema), getDistance);

export default router;

