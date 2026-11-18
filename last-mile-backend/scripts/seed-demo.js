// Peuple la base avec un jeu de donnees de demonstration coherent (soutenance, captures d'ecran).
// Usage (depuis last-mile-backend/) : node scripts/seed-demo.js   (ou npm run seed:demo)
//
// - Comptes dedies en @demo.lastmile.test : vos comptes existants ne sont jamais modifies.
// - Relancable : comptes et produits sont mis a jour, les commandes de demo sont recreees a chaque execution.
// - Toutes les personnes, adresses et numeros sont fictifs.
// - Ecrit directement en base : aucun evenement WhatsApp n'est emis.
// - Refuse de s'executer si NODE_ENV=production (sauf --force).
// Mot de passe des comptes : variable DEMO_PASSWORD, sinon "Demo2026!".
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import pool from '../src/config/db.js';
import { insertWithTrackingCode } from '../src/utils/trackingCode.js';

dotenv.config();

if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('Refus : NODE_ENV=production. Ce script est reserve aux bases de developpement (ajoutez --force pour passer outre).');
  process.exit(1);
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo2026!';
const SHOP_SLUG = 'boutique-demo';

const ACCOUNTS = {
  admin: { name: 'Admin Démo', email: 'admin@demo.lastmile.test', phone: '+237 699 000 001', role: 'admin' },
  merchant: { name: 'Akwa Style (démo)', email: 'marchand@demo.lastmile.test', phone: '+237 699 000 002', role: 'merchant' },
  driver: { name: 'Eric Démo (livreur)', email: 'livreur@demo.lastmile.test', phone: '+237 699 000 003', role: 'driver' }
};

const unsplash = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=85`;
const PRODUCTS = [
  {
    name: 'Sneakers Urban Run', category: 'Mode', price: 38000, stock: 14, imageUrl: unsplash('photo-1542291026-7eec264c27ff'),
    description: 'Baskets légères en maille respirante, semelle amortissante pour la ville. Pointures 38 à 45.'
  },
  {
    name: 'Casque Bluetooth Studio', category: 'Électronique', price: 35000, stock: 9, imageUrl: unsplash('photo-1505740420928-5e560c06d30e'),
    description: 'Casque sans fil à réduction de bruit, 30 heures d’autonomie, coussinets à mémoire de forme.'
  },
  {
    name: 'Montre Connectée Active', category: 'Électronique', price: 65000, stock: 12, imageUrl: unsplash('photo-1523275335684-37898b6baf30'),
    description: 'Suivi de l’activité et du sommeil, notifications du téléphone, étanche, 7 jours d’autonomie.'
  },
  {
    name: 'Sac à Main Cuir Urbain', category: 'Mode', price: 55000, stock: 7, imageUrl: unsplash('photo-1584917865442-de89df76afd3'),
    description: 'Sac en cuir véritable, poche intérieure zippée et bandoulière amovible.'
  },
  {
    name: 'Lunettes Polarisées Nova', category: 'Accessoires', price: 28000, stock: 18, imageUrl: unsplash('photo-1511499767150-a48a237f0083'),
    description: 'Verres polarisés anti-reflets, protection UV400, monture métal légère.'
  },
  {
    name: 'Parfum Signature 100 ml', category: 'Beauté', price: 75000, stock: 5, imageUrl: unsplash('photo-1541643600914-78b084683601'),
    description: 'Eau de parfum aux notes florales et boisées, flacon de 100 ml.'
  }
];

// Commandes de demo : quartiers de Douala, clients fictifs.
// history = statuts successifs (le dernier est le statut courant) ; by = qui a fait chaque changement.
const ORDERS = [
  {
    client: 'Client Démo A', phone: '+237 690 000 101', address: 'Rue de la Joie, Akwa, Douala',
    lat: 4.0483, lng: 9.7043, description: '2 paires de sneakers, à remettre en main propre',
    history: [['pending', 'merchant']]
  },
  {
    client: 'Client Démo B', phone: '+237 690 000 102', address: 'Carrefour Ndokoti, Douala',
    lat: 4.0469, lng: 9.7356, description: 'Colis fragile : casque audio',
    history: [['pending', 'merchant'], ['assigned', 'admin']]
  },
  {
    client: 'Client Démo C', phone: '+237 690 000 103', address: 'Avenue Douala Manga Bell, Bonapriso, Douala',
    lat: 4.0285, lng: 9.6931, description: 'Montre connectée, paiement déjà reçu',
    history: [['pending', 'merchant'], ['assigned', 'admin'], ['picking', 'driver'], ['in_transit', 'driver']],
    tracked: true
  },
  {
    client: 'Client Démo D', phone: '+237 690 000 104', address: 'Rond-point Bonamoussadi, Douala',
    lat: 4.0908, lng: 9.7468, description: 'Sac à main, livré au gardien',
    history: [['pending', 'merchant'], ['assigned', 'admin'], ['picking', 'driver'], ['in_transit', 'driver'], ['delivered', 'driver']]
  },
  {
    client: 'Client Démo E', phone: '+237 690 000 105', address: 'Marché Ndogbong, Douala',
    lat: 4.0644, lng: 9.7418, description: 'Lunettes de soleil',
    history: [['pending', 'merchant'], ['assigned', 'admin'], ['picking', 'driver'], ['in_transit', 'driver'], ['delivered', 'driver']]
  },
  {
    // Commande passee depuis la boutique publique et payee par Orange Money.
    client: 'Client Démo F', phone: '+237 690 000 106', email: 'client.f@demo.lastmile.test',
    address: 'Akwa, Douala', lat: 4.0483, lng: 9.7043, description: 'Commande boutique en ligne',
    history: [['pending', 'merchant']],
    shop: { method: 'orange_money', items: [['Parfum Signature 100 ml', 1], ['Lunettes Polarisées Nova', 1]] }
  }
];

const upsertUser = async (connection, account, passwordHash, shopSlug = null) => {
  const [rows] = await connection.query('SELECT id FROM users WHERE email = ? LIMIT 1', [account.email]);

  if (rows[0]) {
    await connection.query(
      'UPDATE users SET name = ?, password = ?, phone = ?, role = ?, shop_slug = ? WHERE id = ?',
      [account.name, passwordHash, account.phone, account.role, shopSlug, rows[0].id]
    );
    return rows[0].id;
  }

  const [result] = await connection.query(
    'INSERT INTO users (name, email, password, phone, role, shop_slug) VALUES (?, ?, ?, ?, ?, ?)',
    [account.name, account.email, passwordHash, account.phone, account.role, shopSlug]
  );
  return result.insertId;
};

const connection = await pool.getConnection();

try {
  const [slugOwners] = await connection.query('SELECT email FROM users WHERE shop_slug = ? AND email <> ?', [SHOP_SLUG, ACCOUNTS.merchant.email]);
  if (slugOwners[0]) {
    throw new Error(`Le slug "${SHOP_SLUG}" appartient deja a ${slugOwners[0].email}.`);
  }

  await connection.beginTransaction();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const ids = {
    admin: await upsertUser(connection, ACCOUNTS.admin, passwordHash),
    merchant: await upsertUser(connection, ACCOUNTS.merchant, passwordHash, SHOP_SLUG),
    driver: await upsertUser(connection, ACCOUNTS.driver, passwordHash)
  };

  // Produits (mis a jour par nom)
  const productsByName = new Map();
  for (const product of PRODUCTS) {
    const [rows] = await connection.query('SELECT id FROM products WHERE merchant_id = ? AND name = ? LIMIT 1', [ids.merchant, product.name]);
    let productId = rows[0]?.id;

    if (productId) {
      await connection.query(
        'UPDATE products SET description = ?, category = ?, price = ?, image_url = ?, stock = ? WHERE id = ?',
        [product.description, product.category, product.price, product.imageUrl, product.stock, productId]
      );
    } else {
      const [result] = await connection.query(
        'INSERT INTO products (merchant_id, name, description, category, price, image_url, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [ids.merchant, product.name, product.description, product.category, product.price, product.imageUrl, product.stock]
      );
      productId = result.insertId;
    }
    productsByName.set(product.name, { id: productId, price: product.price });
  }

  // Commandes : on repart d'une ardoise propre pour le marchand de demo
  const [oldOrders] = await connection.query('SELECT id FROM orders WHERE merchant_id = ?', [ids.merchant]);
  const oldIds = oldOrders.map((order) => order.id);
  if (oldIds.length) {
    await connection.query('DELETE FROM delivery_logs WHERE order_id IN (?)', [oldIds]);
    await connection.query('DELETE FROM order_items WHERE order_id IN (?)', [oldIds]);
    await connection.query('DELETE FROM orders WHERE id IN (?)', [oldIds]);
  }

  const created = [];
  const now = Date.now();
  for (const [index, order] of ORDERS.entries()) {
    const status = order.history.at(-1)[0];
    const hasDriver = order.history.some(([step]) => step === 'assigned');
    const items = (order.shop?.items || []).map(([name, quantity]) => ({ name, quantity, ...productsByName.get(name) }));
    const total = order.shop ? items.reduce((sum, item) => sum + item.price * item.quantity, 0) : null;
    // Dates echelonnees sur les dernieres heures pour un tableau de bord realiste
    const createdAt = new Date(now - (ORDERS.length - index) * 47 * 60 * 1000);

    // Code de suivi genere comme en production (meme generateur que OrderModel.create et le checkout)
    const { result: [result], trackingCode } = await insertWithTrackingCode((code) => connection.query(
      `INSERT INTO orders (tracking_code, merchant_id, driver_id, client_name, client_phone, client_email, delivery_address, description,
        latitude, longitude, status, payment_status, payment_method, payment_reference, payment_provider,
        provider_transaction_id, payment_updated_at, checkout_total, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code, ids.merchant, hasDriver ? ids.driver : null, order.client, order.phone, order.email || null, order.address,
        order.description, order.lat, order.lng, status,
        order.shop ? 'paid' : 'pending', order.shop?.method || null,
        order.shop ? `demo-${now}-${index}` : null, order.shop ? 'local' : null,
        order.shop ? `local_demo_${index}` : null, order.shop ? createdAt : null, total, createdAt
      ]
    ));
    const orderId = result.insertId;

    for (const [step, [stepStatus, actor]] of order.history.entries()) {
      await connection.query(
        'INSERT INTO delivery_logs (order_id, status, changed_by, timestamp) VALUES (?, ?, ?, ?)',
        [orderId, stepStatus, ids[actor], new Date(createdAt.getTime() + step * 9 * 60 * 1000)]
      );
    }

    for (const item of items) {
      await connection.query(
        'INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.id, item.name, item.price, item.quantity]
      );
    }

    created.push({ id: orderId, status, client: order.client, suivi: trackingCode, boutique: Boolean(order.shop) });
  }

  // Position du livreur, proche de la commande en transit (fraiche pendant ~2 min cote carte)
  const tracked = ORDERS.find((order) => order.tracked);
  await connection.query(
    `INSERT INTO driver_positions (driver_id, latitude, longitude, accuracy, heading, speed, captured_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW(3))
    ON DUPLICATE KEY UPDATE latitude = VALUES(latitude), longitude = VALUES(longitude), accuracy = VALUES(accuracy),
      heading = VALUES(heading), speed = VALUES(speed), captured_at = VALUES(captured_at)`,
    [ids.driver, tracked.lat + 0.012, tracked.lng + 0.009, 12, 210, 6.5]
  );

  await connection.commit();

  console.log('Seed de demonstration termine.\n');
  console.table([
    { role: 'admin', email: ACCOUNTS.admin.email, id: ids.admin },
    { role: 'marchand', email: ACCOUNTS.merchant.email, id: ids.merchant, boutique: `/shop/${SHOP_SLUG}` },
    { role: 'livreur', email: ACCOUNTS.driver.email, id: ids.driver }
  ]);
  console.log(`Mot de passe des trois comptes : ${process.env.DEMO_PASSWORD ? '(valeur de DEMO_PASSWORD)' : DEMO_PASSWORD}`);
  console.log(`${PRODUCTS.length} produits, ${created.length} commandes :`);
  console.table(created);
} catch (error) {
  await connection.rollback().catch(() => undefined);
  console.error('Echec du seed de demonstration :', error.message);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
