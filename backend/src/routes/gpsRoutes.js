import { Router } from 'express';
import { z } from 'zod';
import { listGpsVehicles, updateGpsConfig } from '../controllers/gpsController.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const base = {
  query: z.object({}).passthrough(),
  params: z.object({})
};

const updateSchema = z.object({
  body: z.object({
    gps_provider: z.string().max(40).optional().or(z.literal('')),
    gps_vehicle_ref: z.string().max(120).optional().or(z.literal(''))
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() })
});

router.get('/vehicles', listGpsVehicles);
router.patch('/vehicles/:id', authorize('admin', 'company'), validate(updateSchema), updateGpsConfig);

export default router;
