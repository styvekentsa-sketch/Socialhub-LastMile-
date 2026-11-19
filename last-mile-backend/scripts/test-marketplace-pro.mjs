// Tests de l'API « marketplace pro » (/api/marketplace) : filtres combines, pagination, autocompletion,
// fiche produit enrichie, avis verifies et vitrine de boutique.
// Vrai serveur (port 3099) + base MySQL locale, donnees de test isolees puis supprimees.
// Usage (depuis last-mile-backend/) : npm run test:marketplace-pro
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backend = process.argv[2] || fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(backend, 'package.json'));
require('dotenv').config({ path: join(backend, '.env') });
const { default: pool } = await import(pathToFileURL(join(backend, 'src/config/db.js')).href);
const { generateTrackingCode } = await import(pathToFileURL(join(backend, 'src/utils/trackingCode.js')).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PORT = 3099;
const BASE = `http://127.0.0.1:${PORT}/api/marketplace`;
const logs = [];
const server = spawn(process.execPath, ['src/app.js'], {
  cwd: backend,
  env: { ...process.env, PORT: String(PORT), WHATSAPP_CHANNEL_ENABLED: 'false', TELEGRAM_ENABLED: 'false', SMS_ENABLED: 'false', MESSENGER_ENABLED: 'false', LINKEDIN_ENABLED: 'false' },
  stdio: ['ignore', 'pipe', 'pipe']
});
server.stdout.on('data', (d) => logs.push(d.toString()));
server.stderr.on('data', (d) => logs.push(d.toString()));
for (let i = 0; i < 60 && !logs.join('').includes(`port ${PORT}`); i++) await sleep(200);

const results = [];
const test = async (name, fn) => {
  try { await fn(); results.push(`PASS ${name}`); } catch (error) { results.push(`FAIL ${name} : ${error.message}`); }
};
const get = async (path) => {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, json: await res.json().catch(() => null) };
};
const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const findKey = (value, keys) => {
  if (Array.isArray(value)) return value.map((v) => findKey(v, keys)).find(Boolean) || null;
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (keys.includes(key)) return key;
      const nested = findKey(child, keys);
      if (nested) return nested;
    }
  }
  return null;
};
const PRIVATE_KEYS = ['phone', 'email', 'customer_phone', 'client_phone', 'client_name', 'client_email', 'order_id', 'password'];

// ---------- Donnees de test isolees ----------
const sfx = Date.now().toString(36);
const CAT_A = `TestCatA-${sfx}`;
const CAT_B = `TestCatB-${sfx}`;
const created = { users: [], products: [], orders: [] };
const ids = {};

const insertOrder = async ({ merchantId, status, paid, phone, items }) => {
  const trackingCode = generateTrackingCode();
  const [result] = await pool.query(
    `INSERT INTO orders (tracking_code, merchant_id, client_name, client_phone, delivery_address, latitude, longitude, status, payment_status, payment_method, checkout_total)
    VALUES (?, ?, 'Awa Ngono', ?, 'Akwa, Douala', 4.05, 9.70, ?, ?, 'orange_money', 1000)`,
    [trackingCode, merchantId, phone, status, paid ? 'paid' : 'pending']
  );
  created.orders.push(result.insertId);
  for (const productId of items) {
    await pool.query('INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES (?, ?, ?, 1000, 1)', [result.insertId, productId, `produit ${productId}`]);
  }
  return trackingCode;
};

try {
  for (const key of ['M1', 'M2']) {
    const [r] = await pool.query(
      "INSERT INTO users (name, email, password, phone, role, shop_slug, shop_description, is_verified) VALUES (?, ?, 'x', '+237677000000', 'merchant', ?, ?, ?)",
      [`Boutique Test ${key}`, `mpro-${key.toLowerCase()}-${sfx}@test.local`, `mpro-${key.toLowerCase()}-${sfx}`, key === 'M1' ? 'Description de la boutique de test.' : null, key === 'M1' ? 1 : 0]
    );
    created.users.push(r.insertId);
    ids[key] = r.insertId;
  }
  ids.slug1 = `mpro-m1-${sfx}`;
  const products = [
    ['P1', ids.M1, `Casque Pro Test ${sfx}`, CAT_A, 20000, 5],
    ['P2', ids.M1, `Casque Lite Test ${sfx}`, CAT_A, 10000, 0],
    ['P3', ids.M1, `Enceinte Test ${sfx}`, CAT_A, 30000, 3],
    ['P4', ids.M1, `Chargeur Test ${sfx}`, CAT_B, 5000, 10],
    ['P5', ids.M2, `Casque Autre Boutique ${sfx}`, CAT_A, 15000, 4]
  ];
  for (const [key, merchantId, name, category, price, stock] of products) {
    const [r] = await pool.query(
      'INSERT INTO products (merchant_id, name, description, category, price, image_url, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [merchantId, name, `Description ${name}`, category, price, 'https://images.example.com/p.jpg', stock]
    );
    created.products.push(r.insertId);
    ids[key] = r.insertId;
    await sleep(20); // dates de creation distinctes pour le tri « newest »
  }
  // Commande livree et payee (P1, P3) ; commande non livree (P4) ; commande livree mais non payee (P4)
  ids.T1 = await insertOrder({ merchantId: ids.M1, status: 'delivered', paid: true, phone: '+237 699 12 34 56', items: [ids.P1, ids.P3] });
  ids.T2 = await insertOrder({ merchantId: ids.M1, status: 'in_transit', paid: true, phone: '+237 699 00 00 01', items: [ids.P4] });
  ids.T3 = await insertOrder({ merchantId: ids.M1, status: 'delivered', paid: false, phone: '+237 699 00 00 02', items: [ids.P4] });

  // ===== GET /products : filtres combines =====
  await test('filtres combines : marchand + categorie (+ stock, + prix, + recherche)', async () => {
    const byMerchantCat = (await get(`/products?merchant_id=${ids.M1}&category=${CAT_A}`)).json;
    assert.deepEqual(byMerchantCat.items.map((p) => p.id).sort(), [ids.P1, ids.P2, ids.P3].sort());
    const inStock = (await get(`/products?merchant_id=${ids.M1}&category=${CAT_A}&in_stock=true`)).json;
    assert.deepEqual(inStock.items.map((p) => p.id).sort(), [ids.P1, ids.P3].sort());
    const priced = (await get(`/products?merchant_id=${ids.M1}&category=${CAT_A}&in_stock=true&min_price=15000&max_price=25000`)).json;
    assert.deepEqual(priced.items.map((p) => p.id), [ids.P1]);
    const searched = (await get(`/products?merchant_id=${ids.M1}&q=${encodeURIComponent('Casque')}`)).json;
    assert.deepEqual(searched.items.map((p) => p.id).sort(), [ids.P1, ids.P2].sort());
    assert.equal(byMerchantCat.filters.merchant_id, ids.M1);
  });
  await test('tris : price_asc, price_desc, newest', async () => {
    const asc = (await get(`/products?merchant_id=${ids.M1}&sort=price_asc`)).json.items.map((p) => p.price);
    assert.deepEqual(asc, [5000, 10000, 20000, 30000]);
    const desc = (await get(`/products?merchant_id=${ids.M1}&sort=price_desc`)).json.items.map((p) => p.price);
    assert.deepEqual(desc, [30000, 20000, 10000, 5000]);
    const newest = (await get(`/products?merchant_id=${ids.M1}&sort=newest`)).json.items.map((p) => p.id);
    assert.equal(newest[0], ids.P4);
  });
  await test('pagination : limit, total, total_pages, pages distinctes', async () => {
    const p1 = (await get(`/products?merchant_id=${ids.M1}&sort=price_asc&limit=2&page=1`)).json;
    const p2 = (await get(`/products?merchant_id=${ids.M1}&sort=price_asc&limit=2&page=2`)).json;
    const p3 = (await get(`/products?merchant_id=${ids.M1}&sort=price_asc&limit=2&page=3`)).json;
    assert.deepEqual(p1.pagination, { page: 1, limit: 2, total: 4, total_pages: 2 });
    assert.equal(p2.items.length, 2);
    assert.equal(new Set([...p1.items, ...p2.items].map((p) => p.id)).size, 4);
    assert.equal(p3.items.length, 0);
    assert.equal((await get('/products?limit=500')).json.pagination.limit, 48);
  });
  await test('parametres invalides -> 400', async () => {
    assert.equal((await get('/products?sort=recent')).status, 400);
    assert.equal((await get('/products?merchant_id=abc')).status, 400);
    assert.equal((await get('/products?min_price=9000&max_price=100')).status, 400);
  });

  // ===== GET /suggestions =====
  await test('autocompletion : 5 produits et 3 categories au plus', async () => {
    const r = await get(`/suggestions?q=${encodeURIComponent(`Test ${sfx}`)}`);
    assert.equal(r.status, 200);
    assert.ok(r.json.products.length >= 4 && r.json.products.length <= 5);
    assert.equal(r.json.products[0].name.endsWith(sfx), true);
    const cats = (await get(`/suggestions?q=${encodeURIComponent(`TestCat`)}`)).json.categories;
    assert.ok(cats.length <= 3 && cats.some((c) => c.name === CAT_A));
    assert.equal(findKey(r.json, PRIVATE_KEYS), null);
  });
  await test('autocompletion : saisie trop courte -> listes vides', async () => {
    const r = await get('/suggestions?q=a');
    assert.equal(r.status, 200);
    assert.deepEqual([r.json.products, r.json.categories], [[], []]);
  });

  // ===== GET /products/:id =====
  await test('fiche produit : note, boutique verifiee, produits similaires de la meme categorie', async () => {
    const r = await get(`/products/${ids.P1}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.avg_rating, null);
    assert.equal(r.json.review_count, 0);
    assert.deepEqual(r.json.reviews, []);
    assert.equal(r.json.product.shop.verified, true);
    assert.equal(r.json.product.shop.product_count, 4);
    assert.equal(r.json.product.shop.slug, ids.slug1);
    assert.ok(r.json.similar_products.length > 0 && r.json.similar_products.length <= 4);
    assert.ok(r.json.similar_products.every((p) => p.category === CAT_A && p.id !== ids.P1));
    assert.ok(r.json.similar_products.some((p) => p.id === ids.P5), 'produit similaire d\'une autre boutique attendu');
    assert.equal(findKey(r.json, PRIVATE_KEYS), null);
    assert.equal((await get('/products/99999999')).status, 404);
  });

  // ===== POST /products/:id/reviews =====
  let refusalMessage;
  await test('avis : validation (note, nom, preuve d\'achat)', async () => {
    assert.equal((await post(`/products/${ids.P1}/reviews`, { rating: 6, customer_name: 'Awa', tracking_code: ids.T1 })).status, 400);
    assert.equal((await post(`/products/${ids.P1}/reviews`, { rating: 5, customer_name: 'A', tracking_code: ids.T1 })).status, 400);
    assert.equal((await post(`/products/${ids.P1}/reviews`, { rating: 5, customer_name: 'Awa' })).status, 400);
    assert.equal((await post(`/products/${ids.P1}/reviews`, { rating: 5, customer_name: 'Awa', tracking_code: 'abc' })).status, 400);
  });
  await test('avis refuses : code inconnu, commande non livree, non payee, produit hors commande, telephone inconnu (403, meme message)', async () => {
    const attempts = [
      [ids.P1, { tracking_code: 'LM-2222-2222' }],
      [ids.P4, { tracking_code: ids.T2 }],
      [ids.P4, { tracking_code: ids.T3 }],
      [ids.P4, { tracking_code: ids.T1 }],
      [ids.P1, { phone: '+237 600 00 00 00' }]
    ];
    const messages = [];
    for (const [productId, proof] of attempts) {
      const r = await post(`/products/${productId}/reviews`, { rating: 4, customer_name: 'Awa Ngono', ...proof });
      assert.equal(r.status, 403, JSON.stringify(proof));
      messages.push(r.json.error);
    }
    assert.equal(new Set(messages).size, 1, 'les refus doivent etre indiscernables');
    refusalMessage = messages[0];
  });
  await test('avis accepte par code de suivi : 201, achat verifie, nom reduit, aucun telephone', async () => {
    const r = await post(`/products/${ids.P1}/reviews`, { rating: 5, customer_name: 'awa ngono', comment: 'Très bon casque.', tracking_code: ids.T1.toLowerCase() });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.review.author, 'Awa N.');
    assert.equal(r.json.review.is_verified_purchase, true);
    assert.equal(r.json.review.rating, 5);
    assert.equal(findKey(r.json, PRIVATE_KEYS), null);
  });
  await test('avis en double pour la meme commande -> 409', async () => {
    assert.equal((await post(`/products/${ids.P1}/reviews`, { rating: 1, customer_name: 'Awa Ngono', tracking_code: ids.T1 })).status, 409);
  });
  await test('avis accepte par telephone (format different) pour un autre produit de la commande', async () => {
    const r = await post(`/products/${ids.P3}/reviews`, { rating: 3, customer_name: 'Awa', comment: 'Correct.', phone: '699123456' });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const [[row]] = await pool.query('SELECT customer_phone FROM product_reviews WHERE id = ?', [r.json.review.id]);
    assert.equal(row.customer_phone, '699123456');
    const [[codeRow]] = await pool.query('SELECT customer_phone FROM product_reviews WHERE product_id = ?', [ids.P1]);
    assert.equal(codeRow.customer_phone, null, 'telephone conserve alors que la preuve etait le code');
  });
  await test('fiche produit apres avis : moyenne, nombre, repartition, avis anonymises', async () => {
    const r = await get(`/products/${ids.P1}`);
    assert.equal(r.json.avg_rating, 5);
    assert.equal(r.json.review_count, 1);
    assert.equal(r.json.rating_distribution['5'], 1);
    assert.equal(r.json.reviews[0].author, 'Awa N.');
    assert.equal(r.json.reviews[0].comment, 'Très bon casque.');
    // Dates ISO retirees pour eviter une fausse alerte sur des chiffres d'horodatage
    const raw = JSON.stringify(r.json).replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '');
    assert.ok(!/Ngono|699|\+237/.test(raw), 'donnee personnelle exposee');
  });
  await test('tri top_rated : le produit le mieux note en premier', async () => {
    const items = (await get(`/products?merchant_id=${ids.M1}&sort=top_rated`)).json.items;
    assert.deepEqual(items.slice(0, 2).map((p) => [p.id, p.avg_rating, p.review_count]), [[ids.P1, 5, 1], [ids.P3, 3, 1]]);
  });

  // ===== GET /shops/:slug =====
  await test('vitrine : infos, badge, description, note globale, catalogue pagine, sans contact', async () => {
    const r = await get(`/shops/${ids.slug1}?limit=2&sort=price_asc`);
    assert.equal(r.status, 200);
    assert.equal(r.json.shop.verified, true);
    assert.equal(r.json.shop.description, 'Description de la boutique de test.');
    assert.equal(r.json.shop.product_count, 4);
    assert.equal(r.json.shop.in_stock_count, 3);
    assert.equal(r.json.shop.avg_rating, 4); // (5 + 3) / 2
    assert.equal(r.json.shop.review_count, 2);
    assert.equal(r.json.shop.deliveries_completed, 2); // commandes livrees T1 et T3
    assert.deepEqual(r.json.products.items.map((p) => p.price), [5000, 10000]);
    assert.deepEqual(r.json.products.pagination, { page: 1, limit: 2, total: 4, total_pages: 2 });
    assert.ok(r.json.products.items.every((p) => p.shop.slug === ids.slug1));
    assert.equal(findKey(r.json, PRIVATE_KEYS), null);
  });
  await test('vitrine : boutique inconnue 404, identifiant invalide 400, boutique non verifiee', async () => {
    assert.equal((await get('/shops/boutique-qui-nexiste-pas')).status, 404);
    assert.equal((await get('/shops/Pas_Valide')).status, 400);
    assert.equal((await get(`/shops/mpro-m2-${sfx}`)).json.shop.verified, false);
  });

  // ===== Limitation et non-regression =====
  await test('limiteur : depot d\'avis limite (429) apres 20 essais', async () => {
    let limited = false;
    for (let i = 0; i < 25 && !limited; i++) {
      limited = (await post(`/products/${ids.P1}/reviews`, { rating: 4, customer_name: 'Awa', tracking_code: 'LM-3333-3333' })).status === 429;
    }
    assert.ok(limited, 'aucun 429');
    assert.ok(refusalMessage);
  });
  await test('non-regression : /api/public/products et /api/public/shops/:slug inchanges (+ champs de note)', async () => {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/public/products?shop=${ids.slug1}`).then((res) => res.json());
    assert.equal(r.items.length, 4);
    assert.ok('avg_rating' in r.items[0] && 'review_count' in r.items[0]);
    const legacy = await fetch(`http://127.0.0.1:${PORT}/api/public/shops/${ids.slug1}`).then((res) => res.json());
    assert.equal(legacy.products.length, 4);
  });
} catch (error) {
  results.push(`FAIL execution : ${error.stack || error.message}`);
} finally {
  if (created.products.length) await pool.query('DELETE FROM product_reviews WHERE product_id IN (?)', [created.products]);
  if (created.orders.length) {
    await pool.query('DELETE FROM order_items WHERE order_id IN (?)', [created.orders]);
    await pool.query('DELETE FROM orders WHERE id IN (?)', [created.orders]);
  }
  if (created.products.length) await pool.query('DELETE FROM products WHERE id IN (?)', [created.products]);
  if (created.users.length) await pool.query('DELETE FROM users WHERE id IN (?)', [created.users]);
  await pool.end();
  server.kill();
  const failed = results.filter((r) => r.startsWith('FAIL'));
  console.log(`${results.join('\n')}\n\nNettoyage : ${created.users.length} marchands, ${created.products.length} produits, ${created.orders.length} commandes de test supprimes.`);
  console.log(`${results.length - failed.length}/${results.length} tests reussis`);
  process.exitCode = failed.length ? 1 : 0;
}
