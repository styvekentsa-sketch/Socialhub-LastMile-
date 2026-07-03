import { randomUUID } from 'node:crypto';
import { PublicShopModel } from '../models/publicShopModel.js';
import { initiateCardPayment, initiateMobileMoneyPayment } from '../services/flutterwaveService.js';

const PAYMENT_METHODS = new Set(['orange_money', 'mtn_momo', 'card']);
const MOBILE_MONEY_METHODS = new Set(['orange_money', 'mtn_momo']);
const SHOP_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PHONE_PATTERN = /^\+?[0-9\s-]{8,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAYMENT_REFERENCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DISTRICTS = new Map([
  ['Akwa', { latitude: 4.0483, longitude: 9.7043 }],
  ['Bonamoussadi', { latitude: 4.0908, longitude: 9.7468 }],
  ['Ndogbong', { latitude: 4.0644, longitude: 9.7418 }],
  ['Bonapriso', { latitude: 4.0285, longitude: 9.6931 }],
  ['Deido', { latitude: 4.0676, longitude: 9.7067 }]
]);

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeSlug = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';

const normalizeCart = (cart) => {
  if (!Array.isArray(cart) || cart.length === 0 || cart.length > 20) {
    throw createHttpError('Le panier doit contenir entre 1 et 20 produits.', 400);
  }

  const quantitiesByProduct = new Map();

  for (const item of cart) {
    const productId = Number(item?.product_id ?? item?.id);
    const quantity = Number(item?.quantity);

    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
      throw createHttpError('Le panier contient une ligne invalide.', 400);
    }

    const combinedQuantity = (quantitiesByProduct.get(productId) || 0) + quantity;

    if (combinedQuantity > 99) {
      throw createHttpError('La quantite maximale par produit est de 99.', 400);
    }

    quantitiesByProduct.set(productId, combinedQuantity);
  }

  return [...quantitiesByProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
};

export const getPublicShop = async (req, res, next) => {
  try {
    const slug = normalizeSlug(req.params.slug);

    if (!SHOP_SLUG_PATTERN.test(slug) || slug.length > 120) {
      throw createHttpError('Identifiant de boutique invalide.', 400);
    }

    const catalog = await PublicShopModel.findShopBySlug(slug);

    if (!catalog) {
      throw createHttpError('Boutique introuvable.', 404);
    }

    return res.status(200).json({
      shop: {
        id: catalog.shop.id,
        name: catalog.shop.name,
        phone: catalog.shop.phone,
        avatar: catalog.shop.avatar,
        slug: catalog.shop.shop_slug
      },
      products: catalog.products
    });
  } catch (error) {
    return next(error);
  }
};

export const checkout = async (req, res, next) => {
  let paymentReference = null;
  let providerInitiated = false;

  try {
    const shopSlug = normalizeSlug(req.body.shop_slug);
    const paymentMethod = typeof req.body.payment_method === 'string'
      ? req.body.payment_method.trim().toLowerCase()
      : '';
    const customer = req.body.customer;
    const district = typeof customer?.district === 'string' ? customer.district.trim() : '';
    const delivery = DISTRICTS.get(district);

    if (!SHOP_SLUG_PATTERN.test(shopSlug) || shopSlug.length > 120) {
      throw createHttpError('Identifiant de boutique invalide.', 400);
    }

    if (
      !customer
      || typeof customer.name !== 'string'
      || !customer.name.trim()
      || customer.name.trim().length > 255
      || typeof customer.phone !== 'string'
      || !PHONE_PATTERN.test(customer.phone.trim())
      || typeof customer.email !== 'string'
      || !EMAIL_PATTERN.test(customer.email.trim())
      || customer.email.trim().length > 255
    ) {
      throw createHttpError('Informations de livraison invalides.', 400);
    }

    if (!delivery) {
      throw createHttpError('Quartier de livraison invalide.', 400);
    }

    if (!PAYMENT_METHODS.has(paymentMethod)) {
      throw createHttpError('Mode de paiement invalide.', 400);
    }

    const isMobileMoney = MOBILE_MONEY_METHODS.has(paymentMethod);
    paymentReference = randomUUID();
    const paymentStatus = 'pending';
    const normalizedCustomer = {
      email: customer.email.trim().toLowerCase(),
      name: customer.name.trim(),
      phone: customer.phone.trim()
    };
    const result = await PublicShopModel.checkout({
      cart: normalizeCart(req.body.cart),
      customer: normalizedCustomer,
      delivery: { district, ...delivery },
      paymentMethod,
      paymentReference,
      paymentStatus,
      shopSlug
    });
    let providerResult;

    if (isMobileMoney) {
      providerResult = await initiateMobileMoneyPayment({
        amount: result.total,
        customer: normalizedCustomer,
        paymentMethod,
        paymentReference,
        shopSlug
      });
    } else {
      providerResult = await initiateCardPayment({
        amount: result.total,
        customer: normalizedCustomer,
        paymentReference,
        shopSlug
      });
    }
    providerInitiated = true;

    await PublicShopModel.saveProviderDetails(
      paymentReference,
      providerResult.providerTransactionId,
      providerResult.redirectUrl
    );

    return res.status(201).json({
      success: true,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      requires_confirmation: true,
      requires_redirect: !isMobileMoney,
      payment_link: providerResult.redirectUrl,
      order: {
        id: result.orderId,
        status: 'pending',
        total: result.total
      },
      shop: {
        id: result.shop.id,
        name: result.shop.name,
        phone: result.shop.phone,
        slug: result.shop.shop_slug
      },
      items: result.items
    });
  } catch (error) {
    if (paymentReference && !providerInitiated) {
      await PublicShopModel.failPayment(paymentReference, error.message).catch(() => undefined);
    }

    return next(error);
  }
};

export const getPublicPayment = async (req, res, next) => {
  try {
    const paymentReference = String(req.params.reference || '').trim();

    if (!PAYMENT_REFERENCE_PATTERN.test(paymentReference)) {
      throw createHttpError('Reference de paiement invalide.', 400);
    }

    const payment = await PublicShopModel.findPaymentByReference(paymentReference);

    if (!payment) {
      throw createHttpError('Paiement introuvable.', 404);
    }

    const items = await PublicShopModel.getPaymentItems(payment.order_id);
    return res.status(200).json({
      success: true,
      payment_status: payment.payment_status,
      payment_method: payment.payment_method,
      payment_reference: payment.payment_reference,
      requires_confirmation: payment.payment_status === 'pending',
      requires_redirect: false,
      payment_link: payment.payment_redirect_url,
      order: {
        id: payment.order_id,
        status: 'pending',
        total: Number(payment.checkout_total)
      },
      customer: {
        district: payment.delivery_address
      },
      shop: {
        id: payment.merchant_id,
        name: payment.shop_name,
        phone: payment.shop_phone,
        slug: payment.shop_slug
      },
      items
    });
  } catch (error) {
    return next(error);
  }
};
