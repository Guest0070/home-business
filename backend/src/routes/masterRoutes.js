import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { downloadVehicleTemplate, exportVehicles, importVehicles, previewVehicles } from '../controllers/vehicleExcelController.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createMaster, listMaster, updateVehicleStatus } from '../controllers/masterController.js';

const base = { query: z.object({}).passthrough(), params: z.object({}) };
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

const vehicleSchema = z.object({
  ...base,
  body: z.object({
    vehicle_no: z.string().min(3).max(40),
    ownership: z.enum(['own', 'market']),
    owner_name: z.string().max(140).optional(),
    status: z.enum(['available', 'standby', 'on_trip', 'repair']).optional().default('available'),
    is_active: z.boolean().optional().default(true)
  })
});

const vehicleStatusSchema = z.object({
  body: z.object({
    status: z.enum(['available', 'standby', 'on_trip', 'repair'])
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() })
});

const mineSchema = z.object({
  ...base,
  body: z.object({
    name: z.string().min(2).max(160),
    location: z.string().max(200).optional(),
    is_active: z.boolean().optional().default(true)
  })
});

const factorySchema = z.object({
  ...base,
  body: z.object({
    name: z.string().min(2).max(160),
    contact_name: z.string().max(120).optional(),
    phone: z.string().max(40).optional(),
    address: z.string().optional(),
    is_active: z.boolean().optional().default(true)
  })
});

export const vehicleRoutes = Router()
  .get('/', listMaster('vehicles'))
  .get('/template', authorize('admin', 'company'), downloadVehicleTemplate)
  .get('/export', authorize('admin', 'company'), exportVehicles)
  .post('/import/preview', authorize('admin', 'company'), upload.single('file'), previewVehicles)
  .post('/import', authorize('admin', 'company'), upload.single('file'), importVehicles)
  .post('/', authorize('admin', 'company'), validate(vehicleSchema), createMaster('vehicles'))
  .patch('/:id/status', authorize('admin', 'company'), validate(vehicleStatusSchema), updateVehicleStatus);

export const mineRoutes = Router()
  .get('/', listMaster('mines'))
  .post('/', authorize('admin'), validate(mineSchema), createMaster('mines'));

export const factoryRoutes = Router()
  .get('/', listMaster('factories'))
  .post('/', authorize('admin', 'company'), validate(factorySchema), createMaster('factories'));
