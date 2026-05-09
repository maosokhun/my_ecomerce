import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import cartRoutes from './routes/cart.routes';
import orderRoutes from './routes/order.routes';
import reviewRoutes from './routes/review.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import uploadRoutes from './routes/upload.routes';
import paymentRoutes from './routes/payment.routes';
import locationRoutes from './routes/location.routes';
import settingRoutes from './routes/setting.routes';
import supportRoutes from './routes/support.routes';
import leadRoutes from './routes/lead.routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import { checkDatabaseHealth } from './lib/prisma';

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Security & middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients and server-to-server requests.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Dev: allow same machine on LAN (e.g. http://192.168.x.x:3000) when testing from phone / network IP.
      if (process.env.NODE_ENV !== 'production' && origin) {
        try {
          const u = new URL(origin);
          const port = u.port || (u.protocol === 'https:' ? '443' : '80');
          const isLan =
            u.hostname === 'localhost' ||
            u.hostname === '127.0.0.1' ||
            /^192\.168\.\d{1,3}\.\d{1,3}$/.test(u.hostname);
          if (isLan && port === '3000') return callback(null, true);
        } catch {
          /* ignore */
        }
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(compression());
app.use(cookieParser());

/** Product images uploaded when Cloudinary is off — URL path is /uploads/{folder}/{file} */
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Rate limiting
const isProduction = process.env.NODE_ENV === 'production';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // In local dev, Next.js + admin polling can fire many requests quickly.
  // Keep production strict while avoiding noisy 429 during development smoke tests.
  max: isProduction ? 200 : 1500,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 10 : 50,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});

app.use('/api', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);

// Health check
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'SH-Shop backend is running',
    docs: '/api',
    health: '/health',
  });
});

app.get('/health', async (_req, res) => {
  const dbHealthy = await checkDatabaseHealth();
  const statusCode = dbHealthy ? 200 : 503;
  res.status(statusCode).json({
    status: dbHealthy ? 'ok' : 'degraded',
    services: { database: dbHealthy ? 'up' : 'down' },
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

app.get('/api/health', async (_req, res) => {
  const dbHealthy = await checkDatabaseHealth();
  const statusCode = dbHealthy ? 200 : 503;
  res.status(statusCode).json({
    status: dbHealthy ? 'ok' : 'degraded',
    services: { database: dbHealthy ? 'up' : 'down' },
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/leads', leadRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
