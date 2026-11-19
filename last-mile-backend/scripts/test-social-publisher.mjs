// Test du module Social Commerce : deux marchands, chacun avec SES canaux.
// Vrai serveur (port 3099) + vraie base MySQL ; toutes les API sociales sont redirigees vers un faux
// fournisseur local qui enregistre chaque requete. Aucun service reel n'est contacte.
// Usage (depuis last-mile-backend/) : npm run test:social-publisher
// Le test cree 2 marchands temporaires, leurs produits et canaux, puis supprime tout.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backend = process.argv[2] || fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(backend, 'package.json'));
require('dotenv').config({ path: join(backend, '.env') });
const jwt = require('jsonwebtoken');
const { default: pool } = await import(pathToFileURL(join(backend, 'src/config/db.js')).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Faux fournisseur (Whapi, Telegram, Graph Meta, LinkedIn) ----------
const received = [];
let mockDelayMs = 0; // > 0 : le faux fournisseur repond lentement
const mock = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    // Enregistrement immediat ; seule la reponse est retardee (mockDelayMs)
    const auth = req.headers.authorization || '';
    received.push({ path: req.url, auth, body: body ? JSON.parse(body) : null });
    setTimeout(() => respond(req, res, auth), mockDelayMs);
  });
});
const respond = (req, res, auth) => {
    res.setHeader('Content-Type', 'application/json');
    // Jeton marque FAILTOKEN : refus, avec un message qui RECOPIE le jeton (pour verifier le masquage)
    if (/FAILTOKEN/.test(auth) || /FAILTOKEN/.test(req.url)) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: { message: `Invalid OAuth token ${auth.replace('Bearer ', '') || req.url}` } }));
    }
    if (req.url.startsWith('/whapi/messages/')) return res.end(JSON.stringify({ sent: true, message: { id: `wamid-${received.length}` } }));
    if (req.url.startsWith('/telegram/bot')) return res.end(JSON.stringify({ ok: true, result: { message_id: received.length } }));
    if (/\/graph\/v[\d.]+\/\d+\/photos$/.test(req.url)) return res.end(JSON.stringify({ id: 'photo-1', post_id: `fbpost-${received.length}` }));
    if (/\/graph\/v[\d.]+\/\d+\/media$/.test(req.url)) return res.end(JSON.stringify({ id: `container-${received.length}` }));
    if (/\/graph\/v[\d.]+\/\d+\/media_publish$/.test(req.url)) return res.end(JSON.stringify({ id: `igpost-${received.length}` }));
    if (req.url === '/linkedin/v2/ugcPosts') { res.statusCode = 201; res.setHeader('x-restli-id', `urn:li:share:${received.length}`); return res.end('{}'); }
    res.statusCode = 404;
    return res.end('{}');
};
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
const MOCK = `http://127.0.0.1:${mock.address().port}`;

// ---------- Serveur Last-Mile ----------
const PORT = 3099;
const API = `http://127.0.0.1:${PORT}/api`;
const logs = [];
const server = spawn(process.execPath, ['src/app.js'], {
  cwd: backend,
  env: {
    ...process.env,
    PORT: String(PORT),
    SOCIAL_WHAPI_API_URL: `${MOCK}/whapi`,
    SOCIAL_TELEGRAM_API_URL: `${MOCK}/telegram`,
    SOCIAL_META_GRAPH_URL: `${MOCK}/graph`,
    SOCIAL_LINKEDIN_API_URL: `${MOCK}/linkedin`,
    // Notifications logistiques globales coupees : le test ne contacte aucun vrai service
    WHATSAPP_CHANNEL_ENABLED: 'false', TELEGRAM_ENABLED: 'false', SMS_ENABLED: 'false', MESSENGER_ENABLED: 'false', LINKEDIN_ENABLED: 'false'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
server.stdout.on('data', (d) => logs.push(d.toString()));
server.stderr.on('data', (d) => logs.push(d.toString()));
for (let i = 0; i < 60 && !logs.join('').includes(`port ${PORT}`); i++) await sleep(200);

// ---------- Jeux de donnees ----------
const SECRETS = {
  A: {
    whatsapp: { token: 'TOKEN-A-whapi-1234567890-3BGUV', channel_id: '111111111@newsletter' },
    telegram: { bot_token: '111111:AAA-telegram-token-A-xxxxx', chat_id: '@boutique_a' },
    facebook: { page_id: '1010101010', page_access_token: 'FB-PAGE-TOKEN-A-xxxxxxxxxxxx' },
    instagram: { ig_user_id: '2020202020', access_token: 'IG-TOKEN-A-xxxxxxxxxxxxxxxxx' },
    linkedin: { organization_urn: 'urn:li:organization:3030', access_token: 'LI-TOKEN-A-xxxxxxxxxxxxxxxx' }
  },
  B: {
    whatsapp: { token: 'TOKEN-B-whapi-0987654321-ZZZZZ', channel_id: '222222222@newsletter' },
    telegram: { bot_token: '222222:BBB-telegram-token-B-yyyyy', chat_id: '@boutique_b' }
  }
};
const ALL_SECRET_VALUES = [
  ...Object.values(SECRETS.A).flatMap((c) => Object.values(c)),
  ...Object.values(SECRETS.B).flatMap((c) => Object.values(c))
].filter((v) => /TOKEN|token/.test(v));
const A_MARKERS = ['TOKEN-A', 'token-A', '111111111@newsletter', '@boutique_a', '1010101010', '2020202020', 'organization:3030'];
const B_MARKERS = ['TOKEN-B', 'token-B', '222222222@newsletter', '@boutique_b'];
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const results = [];
const test = async (name, fn) => {
  try { await fn(); results.push(`PASS ${name}`); } catch (error) { results.push(`FAIL ${name} : ${error.message}`); }
};
const call = async (method, path, token, body) => {
  const t = Date.now();
  const res = await fetch(`${API}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, json: await res.json().catch(() => null), ms: Date.now() - t };
};
const requestsMatching = (markers) => received.filter((r) => markers.some((m) => JSON.stringify(r).includes(m)));

const created = { users: [], products: [], autoProductIds: [] };
const suffix = Date.now().toString(36);

try {
  // Deux marchands temporaires et un produit chacun
  const merchants = {};
  for (const key of ['A', 'B']) {
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password, phone, role, shop_slug) VALUES (?, ?, 'x', '+237690000000', 'merchant', ?)",
      [`Test Social ${key}`, `social-${key.toLowerCase()}-${suffix}@test.local`, `test-social-${key.toLowerCase()}-${suffix}`]
    );
    created.users.push(result.insertId);
    const [product] = await pool.query(
      'INSERT INTO products (merchant_id, name, description, category, price, image_url, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [result.insertId, `Produit du marchand ${key}`, `Description du produit ${key}, idéal pour tester la diffusion.`, 'Test', key === 'A' ? 35000 : 12500, `https://images.example.com/produit-${key}.jpg`, 5]
    );
    created.products.push(product.insertId);
    merchants[key] = { id: result.insertId, productId: product.insertId, token: jwt.sign({ id: result.insertId, role: 'merchant' }, process.env.JWT_SECRET, { expiresIn: '10m' }), channels: {} };
  }
  const { A, B } = merchants;
  // Livreur reel : les jetons d'un compte inexistant sont refuses (401) avant tout controle de role
  const [[existingDriver]] = await pool.query("SELECT id FROM users WHERE role = 'driver' ORDER BY id LIMIT 1");
  const driverToken = existingDriver && jwt.sign({ id: existingDriver.id, role: 'driver' }, process.env.JWT_SECRET, { expiresIn: '10m' });

  // ===== Configuration des canaux =====
  await test('creation des canaux : 5 pour A, 2 pour B (201)', async () => {
    const autoFor = { whatsapp: true, telegram: true, facebook: false, instagram: false, linkedin: false };
    for (const [platform, credentials] of Object.entries(SECRETS.A)) {
      const r = await call('POST', '/merchant/channels', A.token, { platform, channel_name: `A ${platform}`, credentials, auto_publish: autoFor[platform] });
      assert.equal(r.status, 201, `${platform} : ${JSON.stringify(r.json)}`);
      A.channels[platform] = r.json.channel.id;
    }
    for (const [platform, credentials] of Object.entries(SECRETS.B)) {
      const r = await call('POST', '/merchant/channels', B.token, { platform, channel_name: `B ${platform}`, credentials, auto_publish: true });
      assert.equal(r.status, 201);
      B.channels[platform] = r.json.channel.id;
    }
  });

  await test('MASQUAGE : aucun jeton en clair dans les reponses, format ••••••••3BGUV', async () => {
    const r = await call('GET', '/merchant/channels', A.token);
    assert.equal(r.status, 200);
    const raw = JSON.stringify(r.json);
    for (const secret of ALL_SECRET_VALUES) assert.ok(!raw.includes(secret), `jeton en clair : ${secret}`);
    const wa = r.json.channels.find((c) => c.platform === 'whatsapp');
    assert.equal(wa.credentials.token, '••••••••3BGUV');
    assert.equal(wa.credentials.channel_id, '111111111@newsletter'); // identifiant non secret : visible
    assert.equal(r.json.channels.length, 5);
  });

  await test('CHIFFREMENT : les jetons ne sont jamais en clair dans la base', async () => {
    const [rows] = await pool.query('SELECT credentials_json FROM merchant_social_channels WHERE merchant_id IN (?)', [created.users]);
    assert.equal(rows.length, 7);
    const raw = JSON.stringify(rows);
    for (const secret of ALL_SECRET_VALUES) assert.ok(!raw.includes(secret), `jeton en clair en base : ${secret}`);
    assert.ok(rows.every((row) => JSON.parse(row.credentials_json).alg === 'aes-256-gcm'));
  });

  await test('ISOLATION lecture : B ne voit que ses 2 canaux', async () => {
    const r = await call('GET', '/merchant/channels', B.token);
    assert.equal(r.json.channels.length, 2);
    assert.ok(r.json.channels.every((c) => c.channel_name.startsWith('B ')));
  });

  await test('ISOLATION ecriture : B ne peut ni modifier, ni supprimer un canal de A (404)', async () => {
    const update = await call('POST', '/merchant/channels', B.token, { id: A.channels.whatsapp, channel_name: 'pirate', credentials: SECRETS.B.whatsapp });
    assert.equal(update.status, 404);
    assert.equal((await call('DELETE', `/merchant/channels/${A.channels.whatsapp}`, B.token)).status, 404);
    const [[row]] = await pool.query('SELECT channel_name FROM merchant_social_channels WHERE id = ?', [A.channels.whatsapp]);
    assert.equal(row.channel_name, 'A whatsapp');
  });

  await test('ISOLATION publication : B ne peut pas publier le produit de A (404, aucun envoi)', async () => {
    const before = received.length;
    assert.equal((await call('POST', `/merchant/products/${A.productId}/publish`, B.token)).status, 404);
    assert.equal(received.length, before);
  });

  await test('validation : plateforme inconnue, chaine sans @newsletter, profil LinkedIn personnel -> 400', async () => {
    assert.equal((await call('POST', '/merchant/channels', A.token, { platform: 'tiktok', channel_name: 'x', credentials: {} })).status, 400);
    assert.equal((await call('POST', '/merchant/channels', A.token, { platform: 'whatsapp', channel_name: 'x', credentials: { token: 'abcdefghijkl', channel_id: '237690000000@s.whatsapp.net' } })).status, 400);
    assert.equal((await call('POST', '/merchant/channels', A.token, { platform: 'linkedin', channel_name: 'x', credentials: { organization_urn: 'urn:li:person:42', access_token: 'LI-xxxxxxxxxxxxxxxxxxxxxx' } })).status, 400);
  });

  await test('acces : role livreur refuse (403), sans jeton refuse (401)', async () => {
    assert.equal((await call('GET', '/merchant/channels', driverToken)).status, 403);
    assert.equal((await fetch(`${API}/merchant/channels`)).status, 401);
  });

  // ===== Publication manuelle =====
  await test('publication manuelle A : 5 canaux, uniquement les identifiants de A', async () => {
    received.length = 0;
    const r = await call('POST', `/merchant/products/${A.productId}/publish`, A.token);
    assert.equal(r.status, 200);
    assert.equal(r.json.total, 5);
    assert.equal(r.json.sent, 5, JSON.stringify(r.json.results));
    assert.equal(requestsMatching(B_MARKERS).length, 0, 'un identifiant de B a ete utilise pour A');
    assert.equal(received.length, 6); // Instagram : 2 appels (conteneur + publication)
    const wa = received.find((x) => x.path === '/whapi/messages/image');
    assert.equal(wa.auth, `Bearer ${SECRETS.A.whatsapp.token}`);
    assert.equal(wa.body.to, '111111111@newsletter');
    assert.equal(wa.body.media, 'https://images.example.com/produit-A.jpg');
    assert.match(wa.body.caption, /^Produit du marchand A\n35 000 FCFA\n\nDescription du produit A/);
    assert.match(wa.body.caption, /Commander : https?:\/\/[^\s]+\/produits\/\d+$/);
    assert.ok(received.some((x) => x.path === `/telegram/bot${SECRETS.A.telegram.bot_token}/sendPhoto` && x.body.chat_id === '@boutique_a'));
    assert.ok(received.some((x) => x.path.endsWith('/1010101010/photos') && x.auth === `Bearer ${SECRETS.A.facebook.page_access_token}`));
    assert.ok(received.some((x) => x.path.endsWith('/2020202020/media_publish')));
    const li = received.find((x) => x.path === '/linkedin/v2/ugcPosts');
    assert.equal(li.body.author, 'urn:li:organization:3030');
  });

  await test('publication manuelle B : 2 canaux, uniquement les identifiants de B', async () => {
    received.length = 0;
    const r = await call('POST', `/merchant/products/${B.productId}/publish`, B.token);
    assert.equal(r.json.sent, 2);
    assert.equal(received.length, 2);
    assert.equal(requestsMatching(A_MARKERS).length, 0, 'un identifiant de A a ete utilise pour B');
    assert.ok(received.every((x) => JSON.stringify(x).includes('Produit du marchand B') && JSON.stringify(x).includes('12 500 FCFA')));
  });

  await test('historique : product_social_posts ne contient que des lignes coherentes (A -> A, B -> B)', async () => {
    const [rows] = await pool.query('SELECT product_id, merchant_id, status, external_post_id FROM product_social_posts WHERE merchant_id IN (?)', [created.users]);
    assert.equal(rows.filter((r) => r.merchant_id === A.id && r.product_id === A.productId && r.status === 'sent').length, 5);
    assert.equal(rows.filter((r) => r.merchant_id === B.id && r.product_id === B.productId && r.status === 'sent').length, 2);
    assert.equal(rows.filter((r) => (r.merchant_id === A.id && r.product_id === B.productId) || (r.merchant_id === B.id && r.product_id === A.productId)).length, 0);
    assert.ok(rows.every((r) => r.external_post_id));
  });

  // ===== Mise a jour, echecs, canaux inactifs =====
  await test('mise a jour sans ressaisir le jeton : le jeton enregistre est conserve', async () => {
    const r = await call('POST', '/merchant/channels', A.token, { id: A.channels.whatsapp, channel_name: 'A WhatsApp renomme', credentials: { token: '••••••••3BGUV', channel_id: '111111111@newsletter' } });
    assert.equal(r.status, 200);
    assert.equal(r.json.channel.channel_name, 'A WhatsApp renomme');
    received.length = 0;
    await call('POST', `/merchant/products/${A.productId}/publish`, A.token);
    assert.equal(received.find((x) => x.path.startsWith('/whapi')).auth, `Bearer ${SECRETS.A.whatsapp.token}`);
  });

  await test('echec d\'une plateforme : rapport detaille, autres canaux publies, jeton masque dans l\'erreur', async () => {
    const failing = 'FB-FAILTOKEN-secret-A-zzzzzzzzzzzz';
    await call('POST', '/merchant/channels', A.token, { id: A.channels.facebook, credentials: { page_id: '1010101010', page_access_token: failing } });
    const r = await call('POST', `/merchant/products/${A.productId}/publish`, A.token);
    const fb = r.json.results.find((x) => x.platform === 'facebook');
    assert.equal(fb.status, 'failed');
    assert.match(fb.error, /Facebook a refuse la publication \(HTTP 401\)/);
    assert.ok(!fb.error.includes(failing), 'jeton recopie dans le message d\'erreur');
    assert.equal(r.json.sent, 4);
    const [[row]] = await pool.query("SELECT error_message FROM product_social_posts WHERE channel_id = ? AND status = 'failed' ORDER BY id DESC LIMIT 1", [A.channels.facebook]);
    assert.ok(row.error_message && !row.error_message.includes(failing));
  });

  await test('canal desactive : jamais utilise', async () => {
    await call('POST', '/merchant/channels', A.token, { id: A.channels.linkedin, is_active: false });
    received.length = 0;
    const r = await call('POST', `/merchant/products/${A.productId}/publish`, A.token);
    assert.equal(r.json.total, 4);
    assert.ok(!received.some((x) => x.path.startsWith('/linkedin')));
  });

  // ===== Publication automatique a la creation d'un produit =====
  await test('creation de produit : publication AUTO non bloquante, seulement sur les canaux auto_publish de A', async () => {
    received.length = 0;
    const r = await call('POST', '/products', A.token, { name: 'Nouveau produit auto A', price: 9900, stock: 3, image_base64: PNG_1PX });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    created.autoProductIds.push(r.json.product.id);
    await sleep(800);
    // Canaux auto de A : WhatsApp + Telegram (Facebook, Instagram : manuels ; LinkedIn : inactif)
    assert.deepEqual(received.map((x) => x.path.split('/')[1]).sort(), ['telegram', 'whapi']);
    assert.equal(requestsMatching(B_MARKERS).length, 0);
    assert.ok(received.every((x) => JSON.stringify(x).includes('Nouveau produit auto A') && JSON.stringify(x).includes('9 900 FCFA')));
    const wa = received.find((x) => x.path.startsWith('/whapi'));
    assert.match(wa.body.media, /^https?:\/\/.+\/uploads\/products\/[\w-]+\.png$/, 'image non absolue');
  });

  await test('creation de produit : la reponse n\'attend pas les reseaux (fournisseur qui met 3 s)', async () => {
    mockDelayMs = 3000;
    received.length = 0;
    const r = await call('POST', '/products', A.token, { name: 'Produit rapide A', price: 1000, stock: 1, image_base64: PNG_1PX });
    created.autoProductIds.push(r.json.product.id);
    assert.equal(r.status, 201);
    assert.ok(r.ms < 1000, `creation bloquee par les reseaux : ${r.ms} ms`);
    await sleep(500);
    assert.equal(received.length, 2, 'les publications auto ont bien ete lancees en arriere-plan');
    await sleep(3000); // laisse les publications lentes se terminer
    mockDelayMs = 0;
  });

  await test('suppression d\'un canal par son proprietaire', async () => {
    assert.equal((await call('DELETE', `/merchant/channels/${A.channels.instagram}`, A.token)).status, 200);
    assert.equal((await call('GET', '/merchant/channels', A.token)).json.channels.length, 4);
  });

  await test('limiteur : 10 publications manuelles par minute et par marchand', async () => {
    let limited = false;
    for (let i = 0; i < 12 && !limited; i++) limited = (await call('POST', `/merchant/products/${B.productId}/publish`, B.token)).status === 429;
    assert.ok(limited, 'aucun 429');
  });

  await test('JOURNAUX : aucun jeton en clair dans les logs du serveur', async () => {
    await sleep(300);
    const journal = logs.join('');
    for (const secret of [...ALL_SECRET_VALUES, 'FB-FAILTOKEN-secret-A-zzzzzzzzzzzz']) assert.ok(!journal.includes(secret), `jeton journalise : ${secret}`);
    assert.match(journal, /\[SocialPublisher\] Produit #\d+ \(marchand #\d+, auto\)/);
  });
} catch (error) {
  results.push(`FAIL execution : ${error.stack || error.message}`);
} finally {
  // Nettoyage : produits auto via l'API (supprime aussi les images), puis donnees de test (canaux et posts en cascade)
  const tokenA = created.users[0] && jwt.sign({ id: created.users[0], role: 'merchant' }, process.env.JWT_SECRET, { expiresIn: '1m' });
  for (const productId of created.autoProductIds) {
    await fetch(`${API}/products/${productId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tokenA}` } }).catch(() => undefined);
  }
  if (created.users.length) {
    await pool.query('DELETE FROM product_social_posts WHERE merchant_id IN (?)', [created.users]);
    await pool.query('DELETE FROM products WHERE merchant_id IN (?)', [created.users]);
    await pool.query('DELETE FROM users WHERE id IN (?)', [created.users]);
  }
  await pool.end();
  server.kill();
  mock.close();
  const failed = results.filter((r) => r.startsWith('FAIL'));
  console.log(`${results.join('\n')}\n\nNettoyage : ${created.users.length} marchands de test, leurs produits, canaux et publications supprimes.`);
  console.log(`${results.length - failed.length}/${results.length} tests reussis`);
  process.exitCode = failed.length ? 1 : 0;
}
