import { getConnectedDriverIds } from '../config/socket.js';
import { getIO } from '../config/socket.js';
import { OrderModel } from '../models/orderModel.js';
import { TrackingModel } from '../models/trackingModel.js';
import UserModel from '../models/userModel.js';

const normalizeCoordinate = (value, min, max) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max
    ? numberValue
    : null;
};

export const updateCurrentLocation = async (req, res, next) => {
  try {
    const latitude = normalizeCoordinate(req.body.latitude, -90, 90);
    const longitude = normalizeCoordinate(req.body.longitude, -180, 180);

    if (latitude === null || longitude === null) {
      const error = new Error('Coordonnees invalides.');
      error.statusCode = 400;
      throw error;
    }

    await TrackingModel.updatePosition(req.user.id, latitude, longitude);

    const activeOrders = await OrderModel.getActiveOrdersByDriver(req.user.id);
    const updatedAt = new Date().toISOString();

    for (const order of activeOrders) {
      const payload = {
        order_id: order.id,
        driver_id: req.user.id,
        latitude,
        longitude,
        updated_at: updatedAt
      };

      getIO()
        .to('admins')
        .to(`merchant_${order.merchant_id}`)
        .to(`driver_${req.user.id}`)
        .emit('driver_location_updated', payload);
    }

    return res.status(200).json({ success: true, latitude, longitude });
  } catch (error) {
    return next(error);
  }
};

export const getAvailableDrivers = async (req, res, next) => {
  try {
    const drivers = await UserModel.findDriversByIds(getConnectedDriverIds());
    return res.status(200).json(drivers);
  } catch (error) {
    return next(error);
  }
};
