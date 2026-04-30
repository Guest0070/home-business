import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  downloadTripTemplate,
  exportTripsWorkbook,
  importTrips,
  previewTrips
} from '../controllers/tripExcelController.js';
import { validate } from '../middleware/validate.js';
import { createTrip, getTrip, listTrips } from '../controllers/tripController.js';

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

const tripSchema = z.object({
  body: z.object({
    trip_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    lr_number: z.string().max(80).optional(),
    vehicle_id: z.string().uuid(),
    delivery_order_id: z.string().uuid().optional().or(z.literal('')),
    driver_id: z.string().uuid().optional().or(z.literal('')),
    driver_name: z.string().min(2).max(120),
    mine_id: z.string().uuid().optional().or(z.literal('')),
    factory_id: z.string().uuid().optional().or(z.literal('')),
    weight_tons: z.coerce.number().positive().optional(),
    rate_per_ton: z.coerce.number().nonnegative().optional(),
    return_party_name: z.string().max(160).optional(),
    return_from_name: z.string().max(160).optional(),
    return_to_name: z.string().max(160).optional(),
    return_weight_tons: z.coerce.number().positive().optional(),
    return_rate_per_ton: z.coerce.number().nonnegative().optional(),
    return_notes: z.string().optional(),
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
router.get('/template', downloadTripTemplate);
router.get('/export', exportTripsWorkbook);
router.post('/import/preview', upload.single('file'), previewTrips);
router.post('/import', upload.single('file'), importTrips);
router.post('/', validate(tripSchema), createTrip);
router.get('/:id', validate(idSchema), getTrip);

export default router;
