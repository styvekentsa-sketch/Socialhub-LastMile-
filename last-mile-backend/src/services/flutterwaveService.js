import { createHmac, timingSafeEqual } from 'node:crypto';

const getConfig = () => {
  const secretKey = process.env.FLW_SECRET_KEY?.trim();
  const secretHash = process.env.FLW_SECRET_HASH?.trim();
  const apiUrl = process.env.FLW_API_URL?.trim();
  const frontendUrl = process.env.FRONTEND_URL?.trim()?.replace(/\/$/, '');
  const backendUrl = process.env.BACKEND_URL?.trim()?.replace(/\/$/, '');

  if (!secretKey || !secretHash || !apiUrl || !frontendUrl || !backendUrl) {
    const error = new Error('Passerelle de paiement non configuree.');
    error.statusCode = 503;
    throw error;
  }

  return { apiUrl: apiUrl.replace(/\/$/, ''), backendUrl, frontendUrl, secretHash, secretKey };
};

const normalizePhone = (phone) => {
  let digits = String(phone || '').replace(/\D/g, '');

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length === 9 && digits.startsWith('6')) {
    digits = `237${digits}`;
  }

  if (!/^2376\d{8}$/.test(digits)) {
    const error = new Error('Numero Mobile Money camerounais invalide.');
    error.statusCode = 400;
    throw error;
  }

  return digits;
};

const requestFlutterwave = async (path, options = {}) => {
  const { apiUrl, secretKey } = getConfig();
  let response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    const error = new Error('Passerelle de paiement indisponible.');
    error.statusCode = 502;
    throw error;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.status !== 'success') {
    const error = new Error(payload?.message || 'La passerelle de paiement a refuse la transaction.');
    error.statusCode = 502;
    throw error;
  }

  return payload.data;
};

export const initiateMobileMoneyPayment = async ({ amount, customer, paymentMethod, paymentReference, shopSlug }) => {
  const config = getConfig();
  const data = await requestFlutterwave('/charges?type=mobile_money_franco', {
    method: 'POST',
    body: JSON.stringify({
      amount: Math.ceil(Number(amount)),
      country: 'CM',
      currency: 'XAF',
      email: customer.email,
      fullname: customer.name,
      network: paymentMethod === 'orange_money' ? 'ORANGEMONEY' : 'MTN',
      phone_number: normalizePhone(customer.phone),
      tx_ref: paymentReference,
      meta: {
        shop_slug: shopSlug,
        webhook_url: `${config.backendUrl}/api/payments/webhook`
      }
    })
  });

  return {
    providerTransactionId: data?.id ? String(data.id) : null,
    redirectUrl: data?.meta?.authorization?.redirect_url || data?.redirect_url || null
  };
};

export const initiateCardPayment = async ({ amount, customer, paymentReference, shopSlug }) => {
  const { frontendUrl } = getConfig();
  const data = await requestFlutterwave('/payments', {
    method: 'POST',
    body: JSON.stringify({
      amount: Math.ceil(Number(amount)),
      currency: 'XAF',
      customer: {
        email: customer.email,
        name: customer.name,
        phonenumber: normalizePhone(customer.phone)
      },
      customizations: {
        description: 'Paiement SocialHub Checkout',
        title: 'SocialHub Checkout'
      },
      meta: { shop_slug: shopSlug },
      payment_options: 'card',
      redirect_url: `${frontendUrl}/shop/${encodeURIComponent(shopSlug)}?payment_reference=${encodeURIComponent(paymentReference)}`,
      tx_ref: paymentReference
    })
  });

  if (!data?.link) {
    const error = new Error('Lien de paiement carte indisponible.');
    error.statusCode = 502;
    throw error;
  }

  return { providerTransactionId: null, redirectUrl: data.link };
};

export const verifyFlutterwaveTransaction = async (transactionId) => {
  if (!transactionId) {
    const error = new Error('Identifiant de transaction fournisseur manquant.');
    error.statusCode = 400;
    throw error;
  }

  return requestFlutterwave(`/transactions/${encodeURIComponent(transactionId)}/verify`, { method: 'GET' });
};

export const isValidFlutterwaveWebhook = (rawBody, signature) => {
  const { secretHash } = getConfig();

  if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !signature) {
    return false;
  }

  const expectedSignature = createHmac('sha256', secretHash)
    .update(rawBody)
    .digest('base64');
  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(signature);

  return expectedBuffer.length === receivedBuffer.length
    && timingSafeEqual(expectedBuffer, receivedBuffer);
};
