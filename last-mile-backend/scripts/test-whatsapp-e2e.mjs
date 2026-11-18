// Usage (depuis last-mile-backend/) : node scripts/test-whatsapp-e2e.mjs   (ou npm run test:whatsapp-e2e)
// Test de bout en bout des declencheurs WhatsApp (order.created, order.status_changed, payment.confirmed).
// Lance le vrai serveur (port 3099), appelle les vraies routes HTTP, verifie les logs [WhatsAppChannel], puis nettoie la base.
//
// Prerequis : MySQL demarre, .env renseigne (JWT_SECRET, DB_*), NODE_ENV different de production
// (le paiement passe par le mode local FLW_LOCAL_FALLBACK), et dans la base :
//   - un admin (id 1), un livreur (id 2), un marchand (id 3) dont la boutique est "merchant-3"
//   - au moins un produit de ce marchand avec un stock > 2
// ATTENTION : le test cree de vraies commandes, puis les supprime et restaure le stock a la fin.
// A n'executer que sur une base de developpement.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backend = process.argv[2] || fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(backend, 'package.json'));
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
dotenv.config({ path: join(backend, '.env') });
const { default: pool } = await import(pathToFileURL(join(backend, 'src/config/db.js')).href);

const PORT = 3099;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_ID = 1, DRIVER_ID = 2, MERCHANT_ID = 3, SHOP_SLUG = 'merchant-3';
const token = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '10m' });
const T = { admin: token(ADMIN_ID, 'admin'), driver: token(DRIVER_ID, 'driver'), merchant: token(MERCHANT_ID, 'merchant') };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);

const createdOrderIds = [];
let product = null;

const startServer = async (extraEnv) => {
  const logs = [];
  const proc = spawn(process.execPath, ['src/app.js'], {
    cwd: backend,
    env: { ...process.env, PORT: String(PORT), ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const onData = (d) => logs.push(...d.toString().split(/\r?\n/).filter(Boolean));
  proc.stdout.on('data', onData);
  proc.stderr.on('data', onData);
  for (let i = 0; i < 60; i++) {
    if (logs.some((l) => l.includes(`port ${PORT}`))) return { proc, logs };
    await sleep(200);
  }
  proc.kill();
  throw new Error(`Serveur non demarre :\n${logs.join('\n')}`);
};

const call = async (method, path, tokenValue, body) => {
  const t = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tokenValue ? { Authorization: `Bearer ${tokenValue}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, ms: Date.now() - t };
};

const runScenario = async (label) => {
  const timings = [];
  const created = await call('POST', '/api/orders', T.merchant, {
    client_name: 'Client Fictif', client_phone: '+237 699 00 00 00',
    delivery_address: '1 rue Imaginaire, Akwa', latitude: 4.0483, longitude: 9.7043,
    description: 'Commande de test E2E WhatsApp'
  });
  const orderId = created.json?.orderId;
  if (orderId) createdOrderIds.push(orderId);
  timings.push(['POST /api/orders', created.status, created.ms]);

  const assigned = await call('PUT', `/api/orders/${orderId}/assign`, T.admin, { driver_id: DRIVER_ID });
  timings.push(['PUT assign', assigned.status, assigned.ms]);

  const forbidden = await call('PUT', `/api/orders/${orderId}/status`, T.driver, { status: 'delivered' });
  timings.push(['PUT status delivered (saut interdit)', forbidden.status, forbidden.ms]);

  for (const status of ['picking', 'in_transit', 'delivered']) {
    const r = await call('PUT', `/api/orders/${orderId}/status`, T.driver, { status });
    timings.push([`PUT status ${status}`, r.status, r.ms]);
  }

  const checkout = await call('POST', '/api/public/checkout', null, {
    shop_slug: SHOP_SLUG, payment_method: 'orange_money',
    customer: { name: 'Acheteur Fictif', phone: '+237 699 11 11 11', email: 'fictif@example.com', district: 'Akwa' },
    cart: [{ product_id: product.id, quantity: 1 }]
  });
  const shopOrderId = checkout.json?.order_id ?? checkout.json?.orderId ?? checkout.json?.order?.order_id;
  timings.push(['POST /api/public/checkout', checkout.status, checkout.ms]);

  const [rows] = await pool.query('SELECT id FROM orders WHERE merchant_id = ? AND id > ? AND client_name = ?',
    [MERCHANT_ID, orderId, 'Acheteur Fictif']);
  const shopIds = rows.map((r) => r.id);
  createdOrderIds.push(...shopIds);

  console.log(`\n--- ${label} : temps de reponse HTTP ---`);
  for (const [name, status, ms] of timings) console.log(`${String(status).padEnd(4)} ${String(ms).padStart(5)} ms  ${name}`);
  return { orderId, shopOrderId: shopOrderId ?? shopIds[0], timings, created, assigned, forbidden, checkout };
};

const waLines = (logs) => logs.filter((l) => l.includes('[WhatsAppChannel]') && !l.includes('initialise'));

try {
  const [products] = await pool.query('SELECT id, stock FROM products WHERE merchant_id = ? AND stock > 2 ORDER BY id LIMIT 1', [MERCHANT_ID]);
  product = products[0];
  if (!product) throw new Error('Aucun produit en stock pour le marchand 3');

  // ---------- PHASE 1 : service desactive (defaut), toutes les cles autorisees pour voir chaque declencheur ----------
  const ALL_KEYS = 'order.created,payment.confirmed,order.assigned,order.picking,order.picked_up,order.in_transit,order.delivered,order.failed,order.cancelled';
  let server = await startServer({ WHATSAPP_CHANNEL_ENABLED: 'false', WHATSAPP_CHANNEL_EVENTS: ALL_KEYS });
  const p1 = await runScenario('Phase 1 (desactive)');
  await sleep(300);
  server.proc.kill();
  const l1 = waLines(server.logs);
  console.log('\n--- Phase 1 : logs [WhatsAppChannel] ---');
  l1.forEach((l) => console.log(l));

  const A = p1.orderId, B = p1.shopOrderId;
  check('P1 creation commande marchand -> 201', p1.created.status === 201);
  check('P1 order.created logue pour la commande marchand',
    l1.some((l) => l.includes('[order.created]') && l.includes(`#${A} validée`)));
  check('P1 assignation -> 200, aucun message (non branchee)', p1.assigned.status === 200 && !l1.some((l) => l.includes('[order.assigned]')));
  check('P1 transition interdite -> 409 et aucun evenement', p1.forbidden.status === 409
    && l1.filter((l) => l.includes(`#${A} livré`)).length === 1);
  for (const [key, text] of [['order.picking', `colis #${A}.`], ['order.in_transit', `Colis #${A} en cours`], ['order.delivered', `Colis #${A} livré avec succès`]]) {
    check(`P1 ${key} logue`, l1.some((l) => l.includes(`[${key}]`) && l.includes(text)));
  }
  check('P1 checkout boutique -> 201 paye', p1.checkout.status === 201 && p1.checkout.json?.payment_status === 'paid', `commande #${B}`);
  check('P1 payment.confirmed logue une seule fois pour la commande boutique',
    l1.filter((l) => l.includes('[payment.confirmed]') && l.includes(`#${B} validée`)).length === 1);
  check('P1 ANTI-DOUBLON : aucun order.created pour la commande boutique',
    !l1.some((l) => l.includes('[order.created]') && l.includes(`#${B} `)));
  check('P1 total : exactement 5 messages (created + 3 statuts + payment)', l1.length === 5, `${l1.length} lignes`);
  check('P1 aucune donnee personnelle dans les logs',
    !l1.some((l) => /Fictif|699|Imaginaire|example\.com|4\.04/.test(l)));

  // ---------- PHASE 2 : service active, fournisseur lent (4 s) avec delai max 2 s ----------
  const received = [];
  const mock = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => { received.push(body); setTimeout(() => res.end('{}'), 4000); });
  });
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  server = await startServer({
    WHATSAPP_CHANNEL_ENABLED: 'true', WHATSAPP_CHANNEL_PROVIDER: 'whapi',
    WHATSAPP_CHANNEL_API_URL: `http://127.0.0.1:${mock.address().port}`,
    WHATSAPP_CHANNEL_API_TOKEN: 'test-token', WHATSAPP_CHANNEL_ID: '120363000000000000@newsletter',
    WHATSAPP_CHANNEL_EVENTS: ALL_KEYS, WHATSAPP_CHANNEL_TIMEOUT_MS: '2000'
  });
  const p2 = await runScenario('Phase 2 (active, fournisseur lent 4 s)');
  await sleep(2600);
  server.proc.kill();
  mock.close();
  const l2 = waLines(server.logs);
  console.log('\n--- Phase 2 : logs [WhatsAppChannel] ---');
  l2.forEach((l) => console.log(l));
  console.log('\n--- Phase 2 : corps recus par le faux fournisseur ---');
  received.forEach((b) => console.log(b));

  const ok2xx = p2.timings.filter(([n]) => !n.includes('interdit')).every(([, s]) => s >= 200 && s < 300);
  const maxMs = Math.max(...p2.timings.map(([, , ms]) => ms));
  check('P2 toutes les requetes reussissent malgre le fournisseur lent', ok2xx);
  check('P2 aucune requete ralentie (< 1000 ms alors que le fournisseur met 4000 ms)', maxMs < 1000, `max ${maxMs} ms`);
  check('P2 5 requetes envoyees au fournisseur', received.length === 5, `${received.length}`);
  check('P2 5 echecs "timeout" journalises sans planter', l2.filter((l) => l.includes('(timeout)')).length === 5);
  check('P2 aucune donnee personnelle envoyee au fournisseur',
    !received.some((b) => /Fictif|699|Imaginaire|example\.com|Akwa|4\.04/.test(b)));
} catch (error) {
  results.push(`FAIL execution : ${error.stack || error.message}`);
} finally {
  // ---------- NETTOYAGE ----------
  if (createdOrderIds.length) {
    const ids = [...new Set(createdOrderIds)];
    await pool.query('DELETE FROM delivery_logs WHERE order_id IN (?)', [ids]);
    await pool.query('DELETE FROM order_items WHERE order_id IN (?)', [ids]);
    await pool.query('DELETE FROM orders WHERE id IN (?)', [ids]);
    console.log(`\nNettoyage : commandes de test supprimees ${ids.join(', ')}`);
  }
  if (product) {
    await pool.query('UPDATE products SET stock = ? WHERE id = ?', [product.stock, product.id]);
    const [[after]] = await pool.query('SELECT stock FROM products WHERE id = ?', [product.id]);
    console.log(`Nettoyage : stock produit #${product.id} restaure a ${after.stock} (initial ${product.stock})`);
  }
  await pool.end();
  console.log('\n===== RESULTATS =====');
  results.forEach((r) => console.log(r));
}
