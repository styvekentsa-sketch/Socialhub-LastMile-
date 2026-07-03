import pool from '../config/db.js';

const ProductModel = {
  async findByMerchantId(merchantId) {
    const [rows] = await pool.query(
      `SELECT id, merchant_id, name, price, image_url, stock, created_at, updated_at
      FROM products
      WHERE merchant_id = ?
      ORDER BY created_at DESC, id DESC`,
      [merchantId]
    );
    return rows;
  },

  async findByIdAndMerchantId(productId, merchantId) {
    const [rows] = await pool.query(
      `SELECT id, merchant_id, name, price, image_url, stock, created_at, updated_at
      FROM products
      WHERE id = ? AND merchant_id = ?
      LIMIT 1`,
      [productId, merchantId]
    );
    return rows[0] || null;
  },

  async create(merchantId, name, price, imageUrl, stock) {
    const [result] = await pool.query(
      'INSERT INTO products (merchant_id, name, price, image_url, stock) VALUES (?, ?, ?, ?, ?)',
      [merchantId, name, price, imageUrl, stock]
    );
    return this.findByIdAndMerchantId(result.insertId, merchantId);
  },

  async updateStock(productId, merchantId, stock) {
    const [result] = await pool.query(
      'UPDATE products SET stock = ? WHERE id = ? AND merchant_id = ?',
      [stock, productId, merchantId]
    );

    return result.affectedRows === 1
      ? this.findByIdAndMerchantId(productId, merchantId)
      : null;
  },

  async remove(productId, merchantId) {
    const product = await this.findByIdAndMerchantId(productId, merchantId);

    if (!product) {
      return null;
    }

    await pool.query('DELETE FROM products WHERE id = ? AND merchant_id = ?', [productId, merchantId]);
    return product;
  }
};

export default ProductModel;
