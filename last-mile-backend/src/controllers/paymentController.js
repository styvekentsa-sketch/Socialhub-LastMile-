import { PublicShopModel } from '../models/publicShopModel.js';
import {
  isValidFlutterwaveWebhook,
  verifyFlutterwaveTransaction
} from '../services/flutterwaveService.js';
import { emitPaymentConfirmed, emitPaymentFailed } from '../services/paymentService.js';

const SUCCESS_STATUSES = new Set(['successful', 'succeeded']);
const COMPLETED_EVENTS = new Set(['charge.completed']);

export const handleFlutterwaveWebhook = async (req, res, next) => {
  try {
    const signature = req.get('flutterwave-signature');

    if (!isValidFlutterwaveWebhook(req.rawBody, signature)) {
      return res.status(401).json({ error: 'Signature webhook invalide.' });
    }

    const eventType = req.body.type || req.body.event;

    if (!COMPLETED_EVENTS.has(eventType)) {
      return res.sendStatus(200);
    }

    const webhookData = req.body.data || {};
    const paymentReference = webhookData.reference || webhookData.tx_ref;
    const providerTransactionId = webhookData.id;
    const payment = await PublicShopModel.findPaymentByReference(paymentReference);

    if (!payment || payment.payment_status !== 'pending') {
      return res.sendStatus(200);
    }

    const verified = await verifyFlutterwaveTransaction(providerTransactionId);
    const verifiedReference = verified.reference || verified.tx_ref;
    const verifiedStatus = String(verified.status || '').toLowerCase();
    const verifiedCurrency = String(verified.currency || '').toUpperCase();
    const verifiedAmount = Number(verified.amount ?? verified.charged_amount);
    const expectedAmount = Number(payment.checkout_total);
    const isValidPayment = SUCCESS_STATUSES.has(verifiedStatus)
      && verifiedReference === paymentReference
      && verifiedCurrency === 'XAF'
      && Number.isFinite(verifiedAmount)
      && verifiedAmount >= expectedAmount;

    if (!isValidPayment) {
      await PublicShopModel.failPayment(paymentReference, 'Verification fournisseur echouee.');
      emitPaymentFailed(paymentReference);
      return res.sendStatus(200);
    }

    const confirmedPayment = await PublicShopModel.confirmPayment(
      paymentReference,
      String(providerTransactionId)
    );

    if (confirmedPayment) {
      emitPaymentConfirmed(confirmedPayment, paymentReference);
    }

    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
};
