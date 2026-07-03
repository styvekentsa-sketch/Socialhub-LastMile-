// FILE: src/controllers/orderController.js
import { OrderModel } from '../models/orderModel.js';
import { TrackingModel } from '../models/trackingModel.js';
import { getIO } from '../config/socket.js';

const VALID_STATUSES = new Set(['pending', 'assigned', 'picked_up', 'delivered', 'cancelled']);
const FINAL_STATUSES = new Set(['delivered', 'cancelled']);

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const parsePositiveInteger = (value) => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};

const normalizeCoordinate = (value, min, max) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) {
    return undefined;
  }

  return numberValue;
};

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const canAccessOrder = (user, order) => user.role === 'admin'
  || (user.role === 'merchant' && Number(order.merchant_id) === Number(user.id))
  || (user.role === 'driver' && Number(order.driver_id) === Number(user.id));

export const createOrder = async (req, res, next) => {
  try {
    const { client_name, client_phone, delivery_address, latitude, longitude, description } = req.body;

    if (
      !isNonEmptyString(client_name)
      || !isNonEmptyString(client_phone)
      || !isNonEmptyString(delivery_address)
    ) {
      throw createHttpError('Les informations du client sont obligatoires.', 400);
    }

    const normalizedLatitude = normalizeCoordinate(latitude, -90, 90);
    const normalizedLongitude = normalizeCoordinate(longitude, -180, 180);

    if (normalizedLatitude === undefined || normalizedLongitude === undefined) {
      throw createHttpError('Coordonnees invalides.', 400);
    }

    const orderId = await OrderModel.create(
      req.user.id,
      client_name.trim(),
      client_phone.trim(),
      delivery_address.trim(),
      normalizedLatitude,
      normalizedLongitude,
      isNonEmptyString(description) ? description.trim() : null
    );

    return res.status(201).json({ message: 'Commande creee avec succes.', orderId });
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }

    return next(error);
  }
};

export const assignDriver = async (req, res, next) => {
  try {
    const orderId = parsePositiveInteger(req.params.id);
    const driverId = parsePositiveInteger(req.body.driver_id);

    if (!orderId || !driverId) {
      throw createHttpError('Les identifiants de la commande et du chauffeur sont invalides.', 400);
    }

    const order = await OrderModel.findById(orderId);

    if (!order) {
      throw createHttpError('Commande introuvable.', 404);
    }

    if (FINAL_STATUSES.has(order.status)) {
      throw createHttpError('Cette commande ne peut plus etre assignee.', 409);
    }

    const driver = await OrderModel.findDriverById(driverId);

    if (!driver) {
      throw createHttpError('Chauffeur invalide.', 400);
    }

    await OrderModel.assignDriver(orderId, driverId, req.user.id);

    const payload = {
      order_id: orderId,
      driver_id: driverId,
      merchant_id: order.merchant_id,
      status: 'assigned',
      message: `La commande ${orderId} a ete assignee.`
    };

    getIO()
      .to(`driver_${driverId}`)
      .to(`merchant_${order.merchant_id}`)
      .to('admins')
      .emit('order_status_updated', payload);

    getIO().to(`driver_${driverId}`).emit('order_assigned', payload);

    return res.status(200).json({
      message: 'Chauffeur assigne avec succes.',
      order: payload
    });
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }

    return next(error);
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const orderId = parsePositiveInteger(req.params.orderId);
    const { status } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Identifiant de commande invalide.' });
    }

    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }

    const order = await OrderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

    if (req.user.role === 'driver' && order.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Acces interdit. Autorisation insuffisante.' });
    }

    await OrderModel.updateStatus(orderId, status);
    await TrackingModel.createLog(orderId, status, req.user.id);

    return res.status(200).json({ message: `Statut de la commande mis a jour : ${status}` });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
};

export const getUserOrders = async (req, res, next) => {
  try {
    const orders = await OrderModel.getOrdersByRole(req.user.role, req.user.id);
    return res.status(200).json(orders);
  } catch (error) {
    return next(error);
  }
};

export const getOrderDetails = async (req, res, next) => {
  try {
    const orderId = parsePositiveInteger(req.params.id);

    if (!orderId) {
      throw createHttpError('Identifiant de commande invalide.', 400);
    }

    const order = await OrderModel.findById(orderId);

    if (!order) {
      throw createHttpError('Commande introuvable.', 404);
    }

    if (!canAccessOrder(req.user, order)) {
      throw createHttpError('Acces interdit. Autorisation insuffisante.', 403);
    }

    return res.status(200).json(order);
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }

    return next(error);
  }
};

export const getOrderTrackingState = async (req, res, next) => {
  try {
    const orderId = parsePositiveInteger(req.params.id);

    if (!orderId) {
      throw createHttpError('Identifiant de commande invalide.', 400);
    }

    const order = await OrderModel.findTrackingStateById(orderId);

    if (!order) {
      throw createHttpError('Commande introuvable.', 404);
    }

    if (!canAccessOrder(req.user, order)) {
      throw createHttpError('Acces interdit. Autorisation insuffisante.', 403);
    }

    return res.status(200).json(order);
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }

    return next(error);
  }
};
