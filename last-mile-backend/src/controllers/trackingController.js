// FILE: src/controllers/trackingController.js
import { OrderModel } from '../models/orderModel.js';
import { TrackingModel } from '../models/trackingModel.js';
import { getIO } from '../config/socket.js';

const VALID_STATUSES = new Set([
  'pending',
  'assigned',
  'picking',
  'in_transit',
  'picked_up',
  'delivered',
  'failed',
  'cancelled'
]);

const MAX_UNAUTHORIZED_ATTEMPTS = 3;
const unauthorizedAttemptsByDriver = new Map();

const incrementUnauthorizedAttempts = (driverId) => {
  const attempts = unauthorizedAttemptsByDriver.get(driverId) || 0;
  unauthorizedAttemptsByDriver.set(driverId, attempts + 1);
};

const STATUS_LABELS = {
  pending: 'En attente',
  assigned: 'Assigne',
  picking: 'Collecte acceptee',
  in_transit: 'En livraison',
  picked_up: 'En cours',
  delivered: 'Livre',
  failed: 'Echec',
  cancelled: 'Annule'
};

const parsePositiveInteger = (value) => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeStatus = (status) => {
  if (typeof status !== 'string') {
    return null;
  }

  const normalizedStatus = status.trim().toLowerCase();
  return VALID_STATUSES.has(normalizedStatus) ? normalizedStatus : null;
};

const DRIVER_STATUS_TRANSITIONS = {
  assigned: new Set(['picking']),
  picking: new Set(['in_transit']),
  picked_up: new Set(['in_transit']),
  in_transit: new Set(['delivered', 'failed'])
};

const normalizeCoordinate = (value, min, max) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) {
    return undefined;
  }

  return numberValue;
};

const canReadOrderHistory = (user, order) => {
  if (user.role === 'admin') {
    return true;
  }

  if (user.role === 'merchant') {
    return Number(order.merchant_id) === Number(user.id);
  }

  if (user.role === 'driver') {
    return Number(order.driver_id) === Number(user.id);
  }

  return false;
};

export const updateLocation = async (req, res) => {
  try {
    const latitude = normalizeCoordinate(req.body.latitude, -90, 90);
    const longitude = normalizeCoordinate(req.body.longitude, -180, 180);

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'La latitude et la longitude sont requises.' });
    }

    await TrackingModel.updatePosition(req.user.id, latitude, longitude);
    return res.status(200).json({ message: 'Position mise a jour avec succes.' });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
};

export const getOrderHistory = async (req, res, next) => {
  try {
    const orderId = parsePositiveInteger(req.params.orderId);

    if (!orderId) {
      throw createHttpError('Identifiant de commande invalide.', 400);
    }

    const order = await OrderModel.findById(orderId);

    if (!order) {
      throw createHttpError('Commande introuvable.', 404);
    }

    if (!canReadOrderHistory(req.user, order)) {
      throw createHttpError('Acces interdit. Vous ne pouvez pas consulter cet historique.', 403);
    }

    const logs = await TrackingModel.getLogsByOrderId(orderId);
    return res.status(200).json(logs);
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }

    return next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const driverId = req.user.role === 'driver'
      ? parsePositiveInteger(req.user.id)
      : null;

    if (
      driverId
      && (unauthorizedAttemptsByDriver.get(driverId) || 0) >= MAX_UNAUTHORIZED_ATTEMPTS
    ) {
      throw createHttpError(
        'Votre compte est temporairement bloqué suite à plusieurs tentatives d\'accès non autorisées.',
        429
      );
    }

    const orderId = parsePositiveInteger(req.params.orderId);
    const status = normalizeStatus(req.body.status);

    if (!orderId) {
      throw createHttpError('Identifiant de commande invalide.', 400);
    }

    if (!status) {
      throw createHttpError('Statut invalide.', 400);
    }

    const order = await OrderModel.findById(orderId);

    if (!order) {
      if (driverId) {
        incrementUnauthorizedAttempts(driverId);
      }

      throw createHttpError('Commande introuvable.', 404);
    }

    if (driverId && order.driver_id !== driverId) {
      incrementUnauthorizedAttempts(driverId);

      throw createHttpError('Accès refusé : ce colis ne vous est pas assigné.', 403);
    }

    if (driverId && !DRIVER_STATUS_TRANSITIONS[order.status]?.has(status)) {
      throw createHttpError('Transition de statut non autorisee.', 409);
    }

    await TrackingModel.updateOrderStatus(orderId, status, req.user.id);

    const notificationMessage = `Le statut de la commande ${orderId} a ete mis a jour : ${status}.`;

    const payload = {
      order_id: orderId,
      driver_id: order.driver_id,
      merchant_id: order.merchant_id,
      status,
      message: notificationMessage
    };

    getIO()
      .to(`merchant_${order.merchant_id}`)
      .to(`driver_${order.driver_id}`)
      .to('admins')
      .emit('order_status_updated', payload);

    return res.status(200).json({
      message: 'Statut mis a jour avec succes.',
      status,
      label: STATUS_LABELS[status],
      order: payload
    });
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }

    return next(error);
  }
};

export const unblockDriver = async (req, res, next) => {
  try {
    const driverId = parsePositiveInteger(req.params.driverId);

    if (!driverId) {
      throw createHttpError('Identifiant du livreur invalide.', 400);
    }

    unauthorizedAttemptsByDriver.delete(driverId);

    return res.status(200).json({
      message: 'Le livreur a été débloqué avec succès.'
    });
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }

    return next(error);
  }
};
