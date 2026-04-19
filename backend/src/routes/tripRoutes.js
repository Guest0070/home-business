import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { createTrip, getTrip, listTrips } from '../controllers/tripController.js';

const router = Router();

const tripSchema = z.object({
  body: z.object({
    trip_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    lr_number: z.string().min(1).max(80),
    vehicle_id: z.string().uuid(),
    driver_id: z.string().uuid().optional().or(z.literal('')),
    driver_name: z.string().min(2).max(120).optional(),
    mine_id: z.string().uuid(),
    factory_id: z.string().uuid(),
    weight_tons: z.coerce.number().positive(),
    rate_per_ton: z.coerce.number().nonnegative(),
    notes: z.string().optional(),
    expense: z.object({
      diesel_litres: z.coerce.number().nonnegative().optional(),
      diesel_cost: z.coerce.number().nonnegative().optional(),
      driver_allowance: z.coerce.number().nonnegative().optional(),
      toll: z.coerce.number().nonnegative().optional(),
      other_expenses: z.coerce.number().nonnegative().optional()
    }).optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({})
});

const listSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    driver: z.string().optional(),
    factoryId: z.string().uuid().optional(),
    vehicleId: z.string().uuid().optional()
  }),
  params: z.object({})
});

const idSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() })
});

router.get('/', validate(listSchema), listTrips);
router.post('/', validate(tripSchema), createTrip);
router.get('/:id', validate(idSchema), getTrip);

export default router;
