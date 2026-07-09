import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pool from './config/db.js';
import { initializeSocket } from './config/socket.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import userRoutes from './routes/userRoutes.js';
import driverRoutes from './routes/driverRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import productRoutes from './routes/productRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { corsOptions } from './config/cors.js';
import { globalErrorHandler, notFoundHandler } from './middlewares/errorMiddleware.js';

dotenv.config();

const app = express();
const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));
const trustProxyValue = process.env.TRUST_PROXY?.trim();

if (trustProxyValue && trustProxyValue !== 'false') {
  const trustProxyHops = Number.parseInt(trustProxyValue, 10);
  app.set('trust proxy', Number.isInteger(trustProxyHops) ? trustProxyHops : trustProxyValue);
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.disable('x-powered-by');
app.use(cors(corsOptions));
app.use(express.json({
  limit: '8mb',
  verify: (req, res, buffer) => {
    if (req.originalUrl === '/api/payments/webhook') {
      req.rawBody = Buffer.from(buffer);
    }
  }
}));
app.use('/uploads', express.static(`${publicDirectory}uploads`, { maxAge: '1d' }));
app.use('/api/public', publicRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/drivers', driverRoutes);
app.use(notFoundHandler);
app.use(globalErrorHandler);

const httpServer = createServer(app);
initializeSocket(httpServer);

const startServer = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Connexion a la base de donnees MySQL reussie.');

    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
      console.log(`Serveur en ligne sur le port ${PORT}`);
    });
  } catch (error) {
    console.error('Erreur fatale lors du demarrage du serveur :', error.message);
    process.exit(1);
  }
};

startServer();
