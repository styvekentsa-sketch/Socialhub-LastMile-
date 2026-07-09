import { getConnectedDriverIds } from '../config/socket.js';
import { getIO } from '../config/socket.js';
import { OrderModel } from '../models/orderModel.js';
import { TrackingModel } from '../models/trackingModel.js';
import UserModel from '../models/userModel.js';

const MAX_GPS_ACCURACY_METERS = Number(process.env.GPS_MAX_ACCURACY_METERS) || 100;
const MAX_GPS_AGE_MS = 2 * 60 * 1000;

const normalizeCoordinate = (value, min, max) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max
    ? numberValue
    : null;
};

const normalizeOptionalNumber = (value, min, max) => {
  if (value === undefined || value === null) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max
    ? numberValue
    : null;
};

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const updateCurrentLocation = async (req, res, next) => {
  try {
    const latitude = normalizeCoordinate(req.body.latitude, -90, 90);
    const longitude = normalizeCoordinate(req.body.longitude, -180, 180);
    const accuracy = normalizeOptionalNumber(req.body.accuracy, 0, MAX_GPS_ACCURACY_METERS);
    const heading = normalizeOptionalNumber(req.body.heading, 0, 360);
    const speed = normalizeOptionalNumber(req.body.speed, 0, 100);
    const capturedAt = new Date(req.body.captured_at);

    if (latitude === null || longitude === null) {
      throw createHttpError('Coordonnees GPS invalides.', 400);
    }

    if (accuracy === null) {
      throw createHttpError(`Precision GPS insuffisante. Maximum accepte : ${MAX_GPS_ACCURACY_METERS} metres.`, 422);
    }

    if (Number.isNaN(capturedAt.getTime())) {
      throw createHttpError('Horodatage GPS invalide.', 400);
    }

    const positionAge = Date.now() - capturedAt.getTime();

    if (positionAge > MAX_GPS_AGE_MS || positionAge < -30000) {
      throw createHttpError('La position GPS est expiree ou datee dans le futur.', 422);
    }

    await TrackingModel.updatePosition(req.user.id, {
      accuracy,
      capturedAt,
      heading,
      latitude,
      longitude,
      speed
    });

    const activeOrders = await OrderModel.getActiveOrdersByDriver(req.user.id);
    const updatedAt = new Date().toISOString();

    for (const order of activeOrders) {
      const payload = {
        order_id: order.id,
        driver_id: req.user.id,
        accuracy,
        captured_at: capturedAt.toISOString(),
        heading,
        latitude,
        longitude,
        speed,
        updated_at: updatedAt
      };

      getIO()
        .to('admins')
        .to(`merchant_${order.merchant_id}`)
        .to(`driver_${req.user.id}`)
        .emit('driver_location_updated', payload);
    }

    return res.status(200).json({
      success: true,
      position: {
        accuracy,
        captured_at: capturedAt.toISOString(),
        heading,
        latitude,
        longitude,
        speed,
        updated_at: updatedAt
      }
    });
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
