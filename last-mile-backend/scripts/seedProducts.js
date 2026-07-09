import dotenv from 'dotenv';
import pool from '../src/config/db.js';

dotenv.config();

const PRODUCTS = [
  { merchantId: 3, name: 'Air Force 1 Ultra', price: 45000, imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=85', stock: 15 },
  { merchantId: 3, name: 'iPhone 13 Pro Max', price: 450000, imageUrl: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1000&q=85', stock: 5 },
  { merchantId: 3, name: 'Casque Bluetooth Studio', price: 35000, imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=85', stock: 9 },
  { merchantId: 3, name: 'Montre Connectee Active', price: 65000, imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85', stock: 12 },
  { merchantId: 4, name: 'Sac a Main Cuir Urbain', price: 55000, imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85', stock: 8 },
  { merchantId: 4, name: 'Lunettes Polarisees Nova', price: 28000, imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1000&q=85', stock: 18 },
  { merchantId: 4, name: 'Parfum Signature 100 ml', price: 75000, imageUrl: 'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=1000&q=85', stock: 6 },
  { merchantId: 4, name: 'Veste Streetwear Premium', price: 42000, imageUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1000&q=85', stock: 11 }
];

const connection = await pool.getConnection();

try {
  await connection.beginTransaction();
  const merchantIds = [...new Set(PRODUCTS.map((product) => product.merchantId))];
  const placeholders = merchantIds.map(() => '?').join(', ');
  const [merchants] = await connection.query(
    `SELECT id FROM users WHERE role = 'merchant' AND id IN (${placeholders})`,
    merchantIds
  );
  const existingMerchantIds = new Set(merchants.map((merchant) => Number(merchant.id)));

  for (const merchantId of merchantIds) {
    if (!existingMerchantIds.has(merchantId)) {
      throw new Error(`Le marchand ${merchantId} est introuvable.`);
    }
  }

  let inserted = 0;
  let updated = 0;

  for (const product of PRODUCTS) {
    const [existingProducts] = await connection.query(
      'SELECT id FROM products WHERE merchant_id = ? AND name = ? LIMIT 1',
      [product.merchantId, product.name]
    );

    if (existingProducts[0]) {
      await connection.query(
        'UPDATE products SET price = ?, image_url = ?, stock = ? WHERE id = ?',
        [product.price, product.imageUrl, product.stock, existingProducts[0].id]
      );
      updated += 1;
    } else {
      await connection.query(
        'INSERT INTO products (merchant_id, name, price, image_url, stock) VALUES (?, ?, ?, ?, ?)',
        [product.merchantId, product.name, product.price, product.imageUrl, product.stock]
      );
      inserted += 1;
    }
  }

  await connection.commit();
  console.log(`Seed produits termine : ${inserted} ajoutes, ${updated} actualises.`);
} catch (error) {
  await connection.rollback();
  console.error('Echec du seed produits :', error.message);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
