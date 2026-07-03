// FILE: src/config/socket.js
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import pool from './db.js';
import { socketCorsOptions } from './cors.js';

let io;
const connectedDriverSockets = new Map();
const DRIVER_STATUSES = new Set(['assigned', 'picking', 'in_transit', 'delivered', 'failed']);
const PAYMENT_REFERENCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const extractToken = (socket) => {
  const authToken = socket.handshake.auth?.token;

  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.startsWith('Bearer ')
      ? authToken.slice(7).trim()
      : authToken.trim();
  }

  const authHeader = socket.handshake.headers.authorization;

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
};

export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: socketCorsOptions
  });

  io.use(async (socket, next) => {
    try {
      const paymentReference = socket.handshake.auth?.paymentReference;

      if (typeof paymentReference === 'string' && PAYMENT_REFERENCE_PATTERN.test(paymentReference)) {
        const [payments] = await pool.query(
          `SELECT id, merchant_id, payment_status, payment_method, checkout_total
          FROM orders
          WHERE payment_reference = ?
          LIMIT 1`,
          [paymentReference]
        );

        if (!payments[0]) {
          return next(new Error('Reference de paiement invalide.'));
        }

        socket.payment = {
          orderId: payments[0].id,
          merchantId: payments[0].merchant_id,
          paymentMethod: payments[0].payment_method,
          paymentReference,
          paymentStatus: payments[0].payment_status,
          total: Number(payments[0].checkout_total)
        };
        return next();
      }

      const token = extractToken(socket);

      if (!token) {
        return next(new Error('Authentification requise.'));
      }

      if (!process.env.JWT_SECRET) {
        return next(new Error('Configuration JWT manquante.'));
      }

      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch (error) {
      return next(new Error('Token invalide ou expire.'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.payment) {
      socket.join(`payment_${socket.payment.paymentReference}`);

      if (socket.payment.paymentStatus === 'paid') {
        socket.emit('payment_confirmed', {
          order_id: socket.payment.orderId,
          merchant_id: socket.payment.merchantId,
          payment_status: 'paid',
          payment_method: socket.payment.paymentMethod,
          payment_reference: socket.payment.paymentReference,
          total: socket.payment.total
        });
      } else if (socket.payment.paymentStatus === 'failed') {
        socket.emit('payment_failed', {
          payment_reference: socket.payment.paymentReference,
          payment_status: 'failed'
        });
      }

      return;
    }

    const userId = Number(socket.user.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      socket.disconnect(true);
      return;
    }

    socket.join(`user_${userId}`);

    if (socket.user.role === 'merchant') {
      socket.join(`merchant_${userId}`);
    }

    if (socket.user.role === 'admin') {
      socket.join('admins');
    }

    if (socket.user.role === 'driver') {
      socket.join(`driver_${userId}`);
      connectedDriverSockets.set(userId, (connectedDriverSockets.get(userId) || 0) + 1);

      socket.on('driver_status_changed', (payload = {}) => {
        const orderId = Number(payload.order_id ?? payload.orderId);
        const status = typeof payload.status === 'string' ? payload.status.trim() : '';

        if (Number.isInteger(orderId) && orderId > 0 && DRIVER_STATUSES.has(status)) {
          io.to('admins').emit('driver_status_activity', {
            driver_id: userId,
            order_id: orderId,
            status
          });
        }
      });

      socket.on('disconnect', () => {
        const remainingSockets = (connectedDriverSockets.get(userId) || 1) - 1;

        if (remainingSockets > 0) {
          connectedDriverSockets.set(userId, remainingSockets);
        } else {
          connectedDriverSockets.delete(userId);
        }
      });
    }
  });

  return io;
};

export const getConnectedDriverIds = () => [...connectedDriverSockets.keys()];

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io n\'est pas initialise.');
  }

  return io;
};
