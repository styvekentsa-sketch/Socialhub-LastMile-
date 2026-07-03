import pool from '../config/db.js';

const createDomainError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const PublicShopModel = {
  async findShopBySlug(slug) {
    const [shops] = await pool.query(
      `SELECT id, name, phone, avatar, shop_slug
      FROM users
      WHERE role = 'merchant' AND shop_slug = ?
      LIMIT 1`,
      [slug]
    );

    const shop = shops[0] || null;

    if (!shop) {
      return null;
    }

    const [products] = await pool.query(
      `SELECT id, name, price, image_url, stock
      FROM products
      WHERE merchant_id = ?
      ORDER BY created_at DESC, id DESC`,
      [shop.id]
    );

    return { shop, products };
  },

  async checkout({ cart, customer, delivery, paymentMethod, paymentReference, paymentStatus, shopSlug }) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [shops] = await connection.query(
        `SELECT id, name, phone, avatar, shop_slug
        FROM users
        WHERE role = 'merchant' AND shop_slug = ?
        LIMIT 1
        FOR UPDATE`,
        [shopSlug]
      );
      const shop = shops[0];

      if (!shop) {
        throw createDomainError('Boutique introuvable.', 404);
      }

      const productIds = cart.map((item) => item.productId);
      const placeholders = productIds.map(() => '?').join(', ');
      const [products] = await connection.query(
        `SELECT id, name, price, image_url, stock
        FROM products
        WHERE merchant_id = ? AND id IN (${placeholders})
        FOR UPDATE`,
        [shop.id, ...productIds]
      );

      if (products.length !== productIds.length) {
        throw createDomainError('Un ou plusieurs produits sont indisponibles.', 400);
      }

      const productsById = new Map(products.map((product) => [Number(product.id), product]));
      let totalCents = 0;
      const items = cart.map((cartItem) => {
        const product = productsById.get(cartItem.productId);

        if (!product || Number(product.stock) < cartItem.quantity) {
          throw createDomainError(`Stock insuffisant pour ${product?.name || 'ce produit'}.`, 409);
        }

        const unitPriceCents = Math.round(Number(product.price) * 100);

        if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0) {
          throw createDomainError('Prix de produit invalide.', 500);
        }

        totalCents += unitPriceCents * cartItem.quantity;
        return {
          product_id: product.id,
          name: product.name,
          image_url: product.image_url,
          quantity: cartItem.quantity,
          unit_price: unitPriceCents / 100
        };
      });

      const description = items
        .map((item) => `${item.quantity}x ${item.name}`)
        .join('; ');
      const total = totalCents / 100;
      const [orderResult] = await connection.query(
        `INSERT INTO orders (
          merchant_id,
          client_name,
          client_phone,
          client_email,
          delivery_address,
          latitude,
          longitude,
          description,
          status,
          payment_status,
          payment_method,
          payment_reference,
          payment_provider,
          checkout_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 'flutterwave', ?)`,
        [
          shop.id,
          customer.name,
          customer.phone,
          customer.email,
          delivery.district,
          delivery.latitude,
          delivery.longitude,
          description,
          paymentStatus,
          paymentMethod,
          paymentReference,
          total
        ]
      );

      await connection.query(
        'INSERT INTO delivery_logs (order_id, status, changed_by) VALUES (?, ?, ?)',
        [orderResult.insertId, 'pending', shop.id]
      );

      for (const item of items) {
        await connection.query(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
          VALUES (?, ?, ?, ?, ?)`,
          [orderResult.insertId, item.product_id, item.name, item.unit_price, item.quantity]
        );
        const [stockResult] = await connection.query(
          'UPDATE products SET stock = stock - ? WHERE id = ? AND merchant_id = ? AND stock >= ?',
          [item.quantity, item.product_id, shop.id, item.quantity]
        );

        if (stockResult.affectedRows !== 1) {
          throw createDomainError(`Stock insuffisant pour ${item.name}.`, 409);
        }
      }

      await connection.commit();

      return {
        items,
        orderId: orderResult.insertId,
        paymentMethod,
        paymentReference,
        paymentStatus,
        shop,
        total
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async saveProviderDetails(paymentReference, providerTransactionId, redirectUrl) {
    const [result] = await pool.query(
      `UPDATE orders
      SET provider_transaction_id = ?, payment_redirect_url = ?, payment_updated_at = CURRENT_TIMESTAMP
      WHERE payment_reference = ? AND payment_status = 'pending'`,
      [providerTransactionId, redirectUrl, paymentReference]
    );
    return result.affectedRows;
  },

  async findPaymentByReference(paymentReference) {
    const [rows] = await pool.query(
      `SELECT
        o.id AS order_id,
        o.merchant_id,
        o.client_name,
        o.client_phone,
        o.client_email,
        o.delivery_address,
        o.payment_status,
        o.payment_method,
        o.payment_reference,
        o.provider_transaction_id,
        o.payment_redirect_url,
        o.checkout_total,
        u.name AS shop_name,
        u.phone AS shop_phone,
        u.shop_slug
      FROM orders o
      JOIN users u ON u.id = o.merchant_id
      WHERE o.payment_reference = ?
      LIMIT 1`,
      [paymentReference]
    );
    return rows[0] || null;
  },

  async getPaymentItems(orderId) {
    const [rows] = await pool.query(
      `SELECT product_id, product_name AS name, unit_price, quantity
      FROM order_items
      WHERE order_id = ?
      ORDER BY id`,
      [orderId]
    );
    return rows;
  },

  async confirmPayment(paymentReference, providerTransactionId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [updateResult] = await connection.query(
        `UPDATE orders
        SET payment_status = 'paid',
            provider_transaction_id = COALESCE(?, provider_transaction_id),
            payment_failure_reason = NULL,
            payment_updated_at = CURRENT_TIMESTAMP
        WHERE payment_reference = ? AND payment_status = 'pending'`,
        [providerTransactionId, paymentReference]
      );

      if (updateResult.affectedRows !== 1) {
        await connection.rollback();
        return null;
      }

      const [orders] = await connection.query(
        `SELECT id, merchant_id, payment_method, checkout_total
        FROM orders
        WHERE payment_reference = ?
        LIMIT 1`,
        [paymentReference]
      );
      const order = orders[0];

      await connection.commit();

      return order ? {
        merchantId: order.merchant_id,
        orderId: order.id,
        paymentMethod: order.payment_method,
        total: Number(order.checkout_total)
      } : null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async failPayment(paymentReference, reason) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [orders] = await connection.query(
        `SELECT id, payment_status
        FROM orders
        WHERE payment_reference = ?
        LIMIT 1
        FOR UPDATE`,
        [paymentReference]
      );
      const order = orders[0];

      if (!order || order.payment_status !== 'pending') {
        await connection.rollback();
        return null;
      }

      await connection.query(
        `UPDATE orders
        SET payment_status = 'failed',
            payment_failure_reason = ?,
            payment_updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [String(reason || 'Paiement refuse.').slice(0, 255), order.id]
      );
      await connection.query(
        `UPDATE products p
        JOIN order_items oi ON oi.product_id = p.id
        SET p.stock = p.stock + oi.quantity
        WHERE oi.order_id = ?`,
        [order.id]
      );
      await connection.commit();
      return order;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
};
