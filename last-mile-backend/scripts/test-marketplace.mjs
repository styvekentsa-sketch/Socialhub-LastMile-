// Test reel des routes publiques de la marketplace (serveur lance sur le port 3099, base MySQL locale).
// Prerequis : MySQL demarre, .env renseigne, `npm run seed:demo` execute (boutique "boutique-demo").
// Usage (depuis last-mile-backend/) : npm run test:marketplace
// Le test cree 2 commandes (boutique + marchand), puis les supprime et restaure le stock.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backend = process.argv[2] || fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(backend, 'package.json'));
require('dotenv').config({ path: join(backend, '.env') });
const jwt = require('jsonwebtoken');
const { default: pool } = await import(pathToFileURL(join(backend, 'src/config/db.js')).href);

const PORT = 3099;
const BASE = `http://127.0.0.1:${PORT}/api/public`;
const SHOP = 'boutique-demo';
const TRACKING = /^LM-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const test = async (name, fn) => {
  try { await fn(); results.push(`PASS ${name}`); } catch (error) { results.push(`FAIL ${name} : ${error.message}`); }
};
const get = async (path) => {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
};
// Cherche recursivement une cle interdite dans une reponse JSON
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
const CONTACT_KEYS = ['phone', 'email', 'shop_phone', 'client_phone', 'client_email'];
const PERSONAL_KEYS = [...CONTACT_KEYS, 'client_name', 'name_client', 'delivery_address', 'address', 'latitude', 'longitude',
  'driver', 'driver_id', 'driver_name', 'driver_phone', 'driver_latitude', 'driver_longitude', 'id', 'order_id', 'merchant_id', 'changed_by'];

// ---------- Serveur ----------
const logs = [];
// Notifications externes desactivees : le test ne doit jamais contacter de vrai service (jetons reels dans .env)
const NOTIFICATIONS_OFF = { WHATSAPP_CHANNEL_ENABLED: 'false', TELEGRAM_ENABLED: 'false', SMS_ENABLED: 'false', MESSENGER_ENABLED: 'false', LINKEDIN_ENABLED: 'false' };
const server = spawn(process.execPath, ['src/app.js'], { cwd: backend, env: { ...process.env, ...NOTIFICATIONS_OFF, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', (d) => logs.push(d.toString()));
server.stderr.on('data', (d) => logs.push(d.toString()));
for (let i = 0; i < 60 && !logs.join('').includes(`port ${PORT}`); i++) await sleep(200);

const createdOrderIds = [];
let stockBackup = [];

try {
  const [[demoShop]] = await pool.query("SELECT id FROM users WHERE shop_slug = ? AND role = 'merchant'", [SHOP]);
  if (!demoShop) throw new Error('Boutique de demo absente : lancez npm run seed:demo');
  [stockBackup] = await pool.query('SELECT id, stock FROM products WHERE merchant_id = ?', [demoShop.id]);

  // ===== 1. GET /marketplace =====
  await test('marketplace : 200, produits en stock, boutiques, categories, chiffres', async () => {
    const r = await get('/marketplace');
    assert.equal(r.status, 200);
    assert.ok(r.json.latest_products.length > 0 && r.json.latest_products.length <= 8);
    assert.ok(r.json.latest_products.every((p) => p.in_stock && p.shop.slug));
    assert.ok(r.json.featured_shops.length > 0 && r.json.featured_shops.length <= 6);
    assert.ok(r.json.featured_shops.every((s) => s.product_count > 0));
    assert.ok(r.json.categories.some((c) => c.name === 'Électronique' && c.product_count >= 2));
    assert.ok(Number.isInteger(r.json.stats.shop_count) && Number.isInteger(r.json.stats.deliveries_completed));
    assert.match(r.headers.get('cache-control'), /max-age=30/);
  });
  await test('marketplace : aucun telephone ni email de marchand', async () => {
    assert.equal(findKey((await get('/marketplace')).json, CONTACT_KEYS), null);
  });

  // ===== 2. GET /products =====
  await test('products : pagination par defaut (24) et plafond a 48', async () => {
    const d = await get('/products');
    assert.equal(d.status, 200);
    assert.equal(d.json.pagination.limit, 24);
    assert.ok(d.json.pagination.total >= 6);
    assert.equal((await get('/products?limit=500')).json.pagination.limit, 48);
    const beyond = await get('/products?page=999');
    assert.equal(beyond.status, 200);
    assert.equal(beyond.json.items.length, 0);
  });
  await test('products : tri prix croissant et decroissant', async () => {
    const asc = (await get('/products?sort=price_asc&limit=48')).json.items.map((p) => p.price);
    const desc = (await get('/products?sort=price_desc&limit=48')).json.items.map((p) => p.price);
    assert.deepEqual(asc, [...asc].sort((a, b) => a - b));
    assert.deepEqual(desc, [...desc].sort((a, b) => b - a));
  });
  await test('products : filtres categorie, boutique, prix, stock', async () => {
    const cat = (await get(`/products?category=${encodeURIComponent('Électronique')}`)).json.items;
    assert.ok(cat.length >= 2 && cat.every((p) => p.category === 'Électronique'));
    const shop = (await get(`/products?shop=${SHOP}`)).json.items;
    assert.equal(shop.length, 6);
    assert.ok(shop.every((p) => p.shop.slug === SHOP));
    const range = (await get('/products?min_price=30000&max_price=40000&limit=48')).json.items;
    assert.ok(range.length > 0 && range.every((p) => p.price >= 30000 && p.price <= 40000));
    const stock = (await get('/products?in_stock=true&limit=48')).json.items;
    assert.ok(stock.every((p) => p.stock > 0));
  });
  await test('products : recherche texte, insensible aux jokers SQL', async () => {
    const hits = (await get('/products?q=casque')).json.items;
    assert.ok(hits.some((p) => p.name === 'Casque Bluetooth Studio'));
    assert.equal((await get(`/products?q=${encodeURIComponent('%')}`)).json.pagination.total, 0);
    assert.equal((await get('/products?q=_')).json.pagination.total, 0);
  });
  await test('products : parametres invalides -> 400', async () => {
    assert.equal((await get('/products?sort=hack')).status, 400);
    assert.equal((await get('/products?min_price=5000&max_price=100')).status, 400);
    assert.equal((await get('/products?page=0')).status, 400);
    assert.equal((await get('/products?min_price=-1')).status, 400);
    assert.equal((await get(`/products?shop=${encodeURIComponent("x' OR 1=1")}`)).status, 400);
    assert.equal((await get(`/products?q=${'a'.repeat(101)}`)).status, 400);
  });
  await test('products : aucun telephone ni email de marchand', async () => {
    assert.equal(findKey((await get('/products?limit=48')).json, CONTACT_KEYS), null);
  });

  // ===== 3. GET /products/:id =====
  await test('products/:id : fiche complete, boutique, produits du meme vendeur', async () => {
    const [[product]] = await pool.query("SELECT id FROM products WHERE merchant_id = ? AND name = 'Casque Bluetooth Studio'", [demoShop.id]);
    const r = await get(`/products/${product.id}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.product.name, 'Casque Bluetooth Studio');
    assert.match(r.json.product.description, /30 heures/);
    assert.equal(r.json.product.shop.slug, SHOP);
    assert.ok(r.json.related_products.length > 0 && r.json.related_products.length <= 4);
    assert.ok(r.json.related_products.every((p) => p.id !== product.id && p.shop.slug === SHOP));
    assert.equal(findKey(r.json, CONTACT_KEYS), null);
  });
  await test('products/:id : 400 si invalide, 404 si inconnu', async () => {
    assert.equal((await get('/products/abc')).status, 400);
    assert.equal((await get('/products/0')).status, 400);
    assert.equal((await get('/products/99999999')).status, 404);
  });

  // ===== 4. GET /shops =====
  await test('shops : annuaire, recherche, aucune donnee de contact', async () => {
    const r = await get('/shops');
    assert.equal(r.status, 200);
    assert.ok(r.json.items.some((s) => s.slug === SHOP && s.product_count === 6));
    assert.ok(r.json.items.every((s) => s.product_count > 0));
    assert.equal(findKey(r.json, CONTACT_KEYS), null);
    const search = (await get('/shops?q=akwa')).json.items;
    assert.ok(search.length >= 1 && search.every((s) => /akwa/i.test(s.name)));
  });

  // ===== 5. Codes de suivi a la creation des commandes + GET /tracking/:code =====
  let paidCode;
  await test('checkout boutique : code de suivi LM-XXXX-XXXX renvoye une fois paye', async () => {
    const [[product]] = await pool.query('SELECT id FROM products WHERE merchant_id = ? AND stock > 2 LIMIT 1', [demoShop.id]);
    const res = await fetch(`${BASE}/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_slug: SHOP, payment_method: 'orange_money', cart: [{ product_id: product.id, quantity: 1 }],
        // Quartier volontairement different du nom de la boutique de demo ("Akwa Style"), pour un controle sans ambiguite
        customer: { name: 'Testeur Confidentiel', phone: '+237 699 55 44 33', email: 'secret@example.com', district: 'Bonamoussadi' }
      })
    });
    const json = await res.json();
    assert.equal(res.status, 201);
    createdOrderIds.push(json.order.id);
    assert.equal(json.payment_status, 'paid');
    assert.match(json.order.tracking_code, TRACKING);
    paidCode = json.order.tracking_code;
    const payment = await get(`/payments/${json.payment_reference}`);
    assert.equal(payment.json.order.tracking_code, paidCode, 'code absent de la confirmation de paiement');
  });
  await test('commande marchand : code de suivi genere automatiquement', async () => {
    const token = jwt.sign({ id: demoShop.id, role: 'merchant' }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const res = await fetch(`http://127.0.0.1:${PORT}/api/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ client_name: 'Client Test', client_phone: '+237 699 00 00 77', delivery_address: 'Rue Test, Akwa', latitude: 4.05, longitude: 9.70 })
    });
    const json = await res.json();
    assert.equal(res.status, 201);
    createdOrderIds.push(json.orderId);
    const [[row]] = await pool.query('SELECT tracking_code FROM orders WHERE id = ?', [json.orderId]);
    assert.match(row.tracking_code, TRACKING);
    const [[dup]] = await pool.query('SELECT COUNT(*) AS n FROM orders WHERE tracking_code = ?', [row.tracking_code]);
    assert.equal(Number(dup.n), 1);
  });
  await test('tracking : commande payee -> statut, etapes, historique', async () => {
    const r = await get(`/tracking/${paidCode}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.tracking_code, paidCode);
    assert.equal(r.json.status, 'pending');
    assert.equal(r.json.progress.current_step_index, 0);
    assert.equal(r.json.shop.slug, SHOP);
    assert.ok(r.json.history.length >= 1 && r.json.history[0].status === 'pending' && r.json.history[0].at);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  });
  await test('tracking : ANONYMISATION (ni client, ni adresse, ni livreur, ni GPS, ni identifiant interne)', async () => {
    const [[transit]] = await pool.query("SELECT tracking_code FROM orders WHERE merchant_id = ? AND status = 'in_transit' LIMIT 1", [demoShop.id]);
    for (const code of [paidCode, transit.tracking_code]) {
      const r = await get(`/tracking/${code}`);
      assert.equal(r.status, 200);
      assert.equal(findKey(r.json, PERSONAL_KEYS), null, `cle interdite dans le suivi ${code}`);
      // Dates ISO retirees : « ...:54.000Z » contiendrait « 4.0 » et fausserait la recherche de coordonnees GPS
      const raw = JSON.stringify(r.json).replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '');
      for (const secret of ['Testeur', 'Confidentiel', '699', 'secret@', 'Bonamoussadi', 'Bonapriso', 'Manga Bell', 'Client Démo', 'Eric', '4.0', '9.7', '9.6']) {
        assert.ok(!raw.includes(secret), `donnee personnelle exposee : ${secret}`);
      }
    }
    const transitResponse = await get(`/tracking/${transit.tracking_code}`);
    assert.equal(transitResponse.json.status, 'in_transit');
    assert.equal(transitResponse.json.progress.current_step_index, 3);
  });
  await test('tracking : saisie en minuscules acceptee, format invalide 400, code inconnu 404', async () => {
    assert.equal((await get(`/tracking/${paidCode.toLowerCase()}`)).status, 200);
    assert.equal((await get('/tracking/123')).status, 400);
    assert.equal((await get('/tracking/LM-0000-0000')).status, 400); // 0 hors alphabet
    assert.equal((await get('/tracking/LM-2222-2222')).status, 404);
  });
  await test('tracking : commande boutique NON payee -> 404 (meme reponse qu\'un code inconnu)', async () => {
    await pool.query("UPDATE orders SET payment_status = 'pending' WHERE id = ?", [createdOrderIds[0]]);
    assert.equal((await get(`/tracking/${paidCode}`)).status, 404);
    await pool.query("UPDATE orders SET payment_status = 'paid' WHERE id = ?", [createdOrderIds[0]]);
  });

  // ===== Limitation de debit =====
  await test('limiteur : tracking bloque au-dela de 20 requetes/min (429 + Retry-After)', async () => {
    let first429 = null;
    for (let i = 0; i < 25 && !first429; i++) {
      const r = await get('/tracking/LM-2222-2222');
      if (r.status === 429) first429 = r;
    }
    assert.ok(first429, 'aucun 429');
    assert.ok(Number(first429.headers.get('retry-after')) > 0);
    assert.equal(first429.headers.get('ratelimit-remaining'), '0');
    assert.match(first429.json.error, /Trop de requetes/);
  });
  await test('limiteur : recherche produits bloquee au-dela de 60 requetes/min, autres routes non affectees', async () => {
    let blocked = false;
    for (let i = 0; i < 70 && !blocked; i++) blocked = (await get('/products?q=x')).status === 429;
    assert.ok(blocked, 'aucun 429 sur /products');
    assert.equal((await get('/shops')).status, 200);
    assert.equal((await get('/marketplace')).status, 200);
  });
  await test('limiteur : un depassement n\'est pas journalise comme une erreur serveur', async () => {
    assert.ok(!logs.join('').includes('Trop de requetes'), 'le 429 est passe par le gestionnaire d\'erreurs');
  });

  // ===== Non-regression des routes publiques existantes =====
  await test('non-regression : /shops/:slug inchange (telephone conserve, comme decide)', async () => {
    const r = await get(`/shops/${SHOP}`);
    assert.equal(r.status, 200);
    assert.ok('phone' in r.json.shop);
    assert.equal(r.json.products.length, 6);
  });
} catch (error) {
  results.push(`FAIL execution : ${error.stack || error.message}`);
} finally {
  if (createdOrderIds.length) {
    await pool.query('DELETE FROM delivery_logs WHERE order_id IN (?)', [createdOrderIds]);
    await pool.query('DELETE FROM order_items WHERE order_id IN (?)', [createdOrderIds]);
    await pool.query('DELETE FROM orders WHERE id IN (?)', [createdOrderIds]);
  }
  for (const { id, stock } of stockBackup) await pool.query('UPDATE products SET stock = ? WHERE id = ?', [stock, id]);
  await pool.end();
  server.kill();
  const failed = results.filter((r) => r.startsWith('FAIL'));
  console.log(`${results.join('\n')}\n\nNettoyage : commandes de test ${createdOrderIds.join(', ') || 'aucune'} supprimees, stock restaure.`);
  console.log(`${results.length - failed.length}/${results.length} tests reussis`);
  process.exitCode = failed.length ? 1 : 0;
}
