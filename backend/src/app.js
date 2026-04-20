import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/authRoutes.js';
import driverRoutes from './routes/driverRoutes.js';
import deliveryOrderRoutes from './routes/deliveryOrderRoutes.js';
import gpsRoutes from './routes/gpsRoutes.js';
import { factoryRoutes, mineRoutes, vehicleRoutes } from './routes/masterRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import reportRoutes, { dashboard, dashboardCharts } from './routes/reportRoutes.js';
import routeRoutes from './routes/routeRoutes.js';
import tripRoutes from './routes/tripRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : path.resolve(__dirname, '../../frontend/dist');
const serveFrontend = process.env.SERVE_FRONTEND === 'true';
const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

function isPrivateNetworkOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/i.test(origin);
}

app.use(helmet());
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (configuredOrigins.includes(origin) || isPrivateNetworkOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin ${origin}`));
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);

app.use('/api', authenticate);
app.get('/api/dashboard', dashboard);
app.get('/api/dashboard/charts', dashboardCharts);
app.use('/api/users', userRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/delivery-orders', deliveryOrderRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/mines', mineRoutes);
app.use('/api/factories', factoryRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);

if (serveFrontend) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
