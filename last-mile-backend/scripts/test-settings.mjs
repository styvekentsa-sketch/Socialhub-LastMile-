// Tests d'integration de /api/settings : profil et boutique, unicite, mot de passe, sessions,
// preferences de notifications, effets publics (nom de boutique, pause).
// Vrai serveur (port 3098) + base MySQL locale ; comptes de test isoles puis supprimes.
// Usage (depuis last-mile-backend/) : npm run test:settings
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backend = process.argv[2] || fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(backend, 'package.json'));
require('dotenv').config({ path: join(backend, '.env') });
const bcrypt = require('bcrypt');
const { default: pool } = await import(pathToFileURL(join(backend, 'src/config/db.js')).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PORT = 3098;
const API = `http://127.0.0.1:${PORT}/api`;
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
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const login = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } }));

// ---------- Comptes de test ----------
const sfx = Date.now().toString(36);
const PASSWORD = 'Initial#2026x';
const created = { users: [], products: [] };
const accounts = {};

try {
  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const [key, role] of [['merchant', 'merchant'], ['other', 'merchant'], ['driver', 'driver']]) {
    const email = `settings-${key}-${sfx}@test.local`;
    const slug = role === 'merchant' ? `settings-${key}-${sfx}` : null;
    const [r] = await pool.query(
      'INSERT INTO users (name, email, password, phone, role, shop_slug) VALUES (?, ?, ?, ?, ?, ?)',
      [`Compte ${key}`, email, hash, '+237 690 00 00 00', role, slug]
    );
    created.users.push(r.insertId);
    accounts[key] = { id: r.insertId, email, slug };
  }
  const [product] = await pool.query(
    'INSERT INTO products (merchant_id, name, description, category, price, image_url, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [accounts.merchant.id, `Produit Settings ${sfx}`, 'Produit de test', 'TestSettings', 5000, null, 10]
  );
  created.products.push(product.insertId);

  for (const key of Object.keys(accounts)) {
    const res = await login(accounts[key].email, PASSWORD);
    assert.equal(res.status, 200, `connexion ${key}`);
    accounts[key].token = res.json.token;
  }
  const { merchant, other, driver } = accounts;

  // ===== Lecture =====
  await test('GET /settings/profile sans jeton -> 401', async () => {
    assert.equal((await call('GET', '/settings/profile')).status, 401);
  });
  await test('GET /settings/profile marchand : profil, boutique, preferences par defaut, derniere connexion', async () => {
    const { status, json } = await call('GET', '/settings/profile', { token: merchant.token });
    assert.equal(status, 200);
    assert.equal(json.profile.email, merchant.email);
    assert.equal(json.profile.role, 'merchant');
    assert.ok(json.profile.current_login_at, 'date de connexion enregistree');
    assert.equal(json.shop.slug, merchant.slug);
    assert.equal(json.shop.status, 'open');
    assert.equal(json.notifications.new_order.email, true);
    assert.equal(json.profile.password, undefined);
    assert.equal(JSON.stringify(json).includes('token_version'), false);
  });
  await test('GET /settings/profile livreur : pas de section boutique', async () => {
    const { status, json } = await call('GET', '/settings/profile', { token: driver.token });
    assert.equal(status, 200);
    assert.equal(json.shop, null);
  });

  // ===== Profil et boutique =====
  const newSlug = `ma-boutique-${sfx}`;
  await test('PUT /settings/profile : mise a jour du profil et de la boutique (persistance)', async () => {
    const { status, json } = await call('PUT', '/settings/profile', {
      token: merchant.token,
      body: {
        name: 'Awa Ngono',
        email: `settings-merchant-new-${sfx}@test.local`,
        phone: '+237 677 11 22 33',
        shop: { name: 'Akwa Mode Pro', slug: newSlug.toUpperCase(), description: 'Mode et accessoires.', pickup_address: 'Rue Joss, entrepot 4', default_city: 'Douala', status: 'open' }
      }
    });
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.profile.name, 'Awa Ngono');
    assert.equal(json.shop.slug, newSlug, 'slug normalise en minuscules');
    const [[row]] = await pool.query('SELECT name, email, phone, shop_name, shop_slug, shop_description, pickup_address, default_city, shop_status FROM users WHERE id = ?', [merchant.id]);
    assert.deepEqual(
      [row.name, row.email, row.phone, row.shop_name, row.shop_slug, row.pickup_address, row.default_city, row.shop_status],
      ['Awa Ngono', `settings-merchant-new-${sfx}@test.local`, '+237 677 11 22 33', 'Akwa Mode Pro', newSlug, 'Rue Joss, entrepot 4', 'Douala', 'open']
    );
    merchant.email = row.email;
    merchant.slug = newSlug;
  });
  await test('vitrine publique : nouveau nom et nouvelle adresse, adresse de retrait jamais exposee', async () => {
    const { status, json } = await call('GET', `/marketplace/shops/${newSlug}`);
    assert.equal(status, 200);
    assert.equal(json.shop.name, 'Akwa Mode Pro');
    assert.equal(json.shop.paused, false);
    const raw = JSON.stringify(json);
    assert.equal(raw.includes('Rue Joss'), false, 'adresse de retrait exposee');
    assert.equal(raw.includes('677 11 22 33'), false, 'telephone expose');
  });
  await test('unicite : adresse de boutique deja prise -> 409', async () => {
    const { status, json } = await call('PUT', '/settings/profile', {
      token: other.token,
      body: { name: 'Compte other', email: other.email, phone: '+237 690 00 00 00', shop: { name: 'Autre', slug: newSlug, status: 'open' } }
    });
    assert.equal(status, 409);
    assert.equal(json.code, 'SLUG_TAKEN');
  });
  await test('unicite : adresse e-mail deja utilisee -> 409', async () => {
    const { status } = await call('PUT', '/settings/profile', { token: other.token, body: { name: 'Compte other', email: merchant.email, phone: '+237 690 00 00 00' } });
    assert.equal(status, 409);
  });
  await test('validation stricte : slug, statut, e-mail, telephone, nom -> 400', async () => {
    const base = { name: 'Compte other', email: other.email, phone: '+237 690 00 00 00' };
    const cases = [
      { ...base, shop: { name: 'Autre', slug: 'a b', status: 'open' } },
      { ...base, shop: { name: 'Autre', slug: '-mauvais-', status: 'open' } },
      { ...base, shop: { name: 'Autre', slug: `ok-${sfx}`, status: 'ferme' } },
      { ...base, email: 'pas-un-email' },
      { ...base, phone: 'abc' },
      { ...base, name: 'A' },
      { ...base, shop: { name: 'Autre', slug: `ok-${sfx}`, status: 'open', description: 'x'.repeat(1001) } }
    ];
    for (const body of cases) {
      const { status } = await call('PUT', '/settings/profile', { token: other.token, body });
      assert.equal(status, 400, JSON.stringify(body).slice(0, 80));
    }
  });
  await test('boutique reservee aux marchands : livreur -> 403', async () => {
    const { status } = await call('PUT', '/settings/profile', {
      token: driver.token,
      body: { name: 'Compte driver', email: driver.email, phone: '+237 690 00 00 00', shop: { name: 'X', slug: `drv-${sfx}`, status: 'open' } }
    });
    assert.equal(status, 403);
  });
  await test('boutique en pause : vitrine signalee et commande publique refusee (409)', async () => {
    const res = await call('PUT', '/settings/profile', {
      token: merchant.token,
      body: { name: 'Awa Ngono', email: merchant.email, phone: '+237 677 11 22 33', shop: { name: 'Akwa Mode Pro', slug: newSlug, status: 'paused' } }
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.shop.status, 'paused');
    assert.equal((await call('GET', `/marketplace/shops/${newSlug}`)).json.shop.paused, true);
    const checkout = await call('POST', '/public/checkout', {
      body: { shop_slug: newSlug, cart: [{ product_id: created.products[0], quantity: 1 }], customer: { name: 'Client Test', phone: '+237 699 00 00 09', district: 'Akwa' }, payment_method: 'orange_money' }
    });
    assert.equal(checkout.status, 409, JSON.stringify(checkout.json));
    const [[{ stock }]] = await pool.query('SELECT stock FROM products WHERE id = ?', [created.products[0]]);
    assert.equal(stock, 10, 'stock inchange');
  });

  // ===== Mot de passe =====
  const NEW_PASSWORD = 'Nouveau#Pass2026';
  await test('mot de passe : ancien mot de passe incorrect -> 400 (sans deconnexion)', async () => {
    const { status, json } = await call('PUT', '/settings/password', { token: merchant.token, body: { current_password: 'Mauvais#2026x', new_password: NEW_PASSWORD } });
    assert.equal(status, 400);
    assert.equal(json.code, 'INVALID_CURRENT_PASSWORD');
    assert.equal((await call('GET', '/settings/profile', { token: merchant.token })).status, 200, 'session toujours valide');
  });
  await test('mot de passe : nouveau mot de passe trop faible -> 400', async () => {
    for (const weak of ['court1!A', 'toutminuscule1!', 'SansChiffre!!x', 'SansSymbole2026x']) {
      const { status, json } = await call('PUT', '/settings/password', { token: merchant.token, body: { current_password: PASSWORD, new_password: weak } });
      assert.equal(status, 400, weak);
      assert.equal(json.code, 'WEAK_PASSWORD', weak);
    }
  });
  await test('mot de passe : changement reussi, autres sessions revoquees, nouvelle connexion', async () => {
    const second = (await login(merchant.email, PASSWORD)).json.token;
    const { status, json } = await call('PUT', '/settings/password', { token: merchant.token, body: { current_password: PASSWORD, new_password: NEW_PASSWORD } });
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(json.token, 'nouveau jeton pour la session courante');
    assert.equal((await call('GET', '/settings/profile', { token: merchant.token })).status, 401, 'ancien jeton revoque');
    assert.equal((await call('GET', '/settings/profile', { token: second })).status, 401, 'autre session revoquee');
    assert.equal((await call('GET', '/settings/profile', { token: json.token })).status, 200, 'nouveau jeton valide');
    assert.equal((await login(merchant.email, PASSWORD)).status, 401, 'ancien mot de passe refuse');
    const fresh = await login(merchant.email, NEW_PASSWORD);
    assert.equal(fresh.status, 200, 'nouveau mot de passe accepte');
    merchant.token = fresh.json.token;
    const [[row]] = await pool.query('SELECT password FROM users WHERE id = ?', [merchant.id]);
    assert.ok(row.password.startsWith('$2'), 'mot de passe stocke hache (bcrypt)');
  });

  // ===== Sessions =====
  await test('deconnecter les autres sessions : jeton courant renouvele, autres jetons refuses', async () => {
    const other1 = (await login(driver.email, PASSWORD)).json.token;
    const { status, json } = await call('POST', '/settings/sessions/revoke-others', { token: driver.token });
    assert.equal(status, 200);
    assert.equal((await call('GET', '/settings/profile', { token: other1 })).status, 401);
    assert.equal((await call('GET', '/settings/profile', { token: json.token })).status, 200);
    driver.token = json.token;
  });
  await test('derniere connexion : la connexion precedente est restituee', async () => {
    const { json } = await call('GET', '/settings/profile', { token: driver.token });
    assert.ok(json.profile.last_login_at, 'connexion precedente');
    assert.ok(new Date(json.profile.current_login_at) >= new Date(json.profile.last_login_at));
  });

  // ===== Preferences =====
  await test('notifications : enregistrement et persistance (+ langue)', async () => {
    const notifications = {
      new_order: { email: false, push: true },
      order_status: { email: true, push: false },
      payment_received: { email: true, push: true },
      daily_summary: { email: true, push: false }
    };
    const put = await call('PUT', '/settings/notifications', { token: driver.token, body: { notifications, language: 'en' } });
    assert.equal(put.status, 200, JSON.stringify(put.json));
    const { json } = await call('GET', '/settings/profile', { token: driver.token });
    assert.deepEqual(json.notifications, notifications);
    assert.equal(json.language, 'en');
    // Les preferences survivent a une reconnexion
    const relog = (await login(driver.email, PASSWORD)).json.token;
    assert.deepEqual((await call('GET', '/settings/profile', { token: relog })).json.notifications, notifications);
  });
  await test('notifications : validation stricte -> 400', async () => {
    const cases = [
      { notifications: { unknown_event: { email: true } } },
      { notifications: { new_order: { sms: true } } },
      { notifications: { new_order: { email: 'oui' } } },
      { notifications: [] },
      { notifications: {}, language: 'de' }
    ];
    for (const body of cases) {
      assert.equal((await call('PUT', '/settings/notifications', { token: driver.token, body })).status, 400, JSON.stringify(body));
    }
  });
} catch (error) {
  results.push(`FAIL preparation : ${error.stack}`);
} finally {
  if (created.products.length) await pool.query(`DELETE FROM products WHERE id IN (${created.products.map(() => '?').join(',')})`, created.products);
  if (created.users.length) await pool.query(`DELETE FROM users WHERE id IN (${created.users.map(() => '?').join(',')})`, created.users);
  console.log(`\nNettoyage : ${created.users.length} comptes et ${created.products.length} produit de test supprimes.`);
  server.kill();
  await pool.end();
}

console.log(results.join('\n'));
const failed = results.filter((line) => line.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} tests reussis`);
if (failed) {
  console.log('\n--- Journal du serveur (fin) ---\n' + logs.join('').slice(-3000));
  process.exitCode = 1;
}
