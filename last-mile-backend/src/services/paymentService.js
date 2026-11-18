import { getIO } from '../config/socket.js';
import { emitOrderEvent, ORDER_EVENTS } from '../events/orderEvents.js';

const createOrderPayload = (payment) => ({
  order_id: payment.orderId,
  merchant_id: payment.merchantId,
  status: 'pending',
  payment_status: 'paid',
  payment_method: payment.paymentMethod,
  total: payment.total,
  message: `Nouvelle commande SocialHub #${payment.orderId}.`
});

export const emitPaidOrder = (payment) => {
  const payload = createOrderPayload(payment);

  getIO()
    .to('admins')
    .to(`merchant_${payment.merchantId}`)
    .emit('order_created', payload);

  return payload;
};

export const emitPaymentConfirmed = (payment, paymentReference) => {
  const payload = emitPaidOrder(payment);
  getIO().to(`payment_${paymentReference}`).emit('payment_confirmed', {
    ...payload,
    payment_reference: paymentReference
  });

  // Appele une seule fois par paiement : confirmPayment ne renvoie une commande
  // que pour la transition atomique pending -> paid (webhook et confirmation directe exclusifs).
  emitOrderEvent(ORDER_EVENTS.PAYMENT_CONFIRMED, { orderId: payment.orderId });
  return payload;
};

export const emitPaymentFailed = (paymentReference) => {
  getIO().to(`payment_${paymentReference}`).emit('payment_failed', {
    payment_reference: paymentReference,
    payment_status: 'failed'
  });
};
