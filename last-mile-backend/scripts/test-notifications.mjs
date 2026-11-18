// Tests unitaires des canaux de notification (WhatsApp, Telegram, SMS, Messenger, LinkedIn)
// contre un faux fournisseur HTTP local.
// Aucune base de donnees ni serveur requis. Usage (depuis last-mile-backend/) : npm run test:notifications
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { ORDER_EVENTS, emitOrderEvent, orderEvents } from '../src/events/orderEvents.js';
import { NOTIFICATION_CHANNELS, initializeNotificationChannels } from '../src/services/notifications/index.js';
import { linkedinChannel } from '../src/services/notifications/linkedinService.js';
import { messengerChannel } from '../src/services/notifications/messengerService.js';
import { smsChannel } from '../src/services/notifications/smsService.js';
import { telegramChannel } from '../src/services/notifications/telegramService.js';
import { whatsappChannel } from '../src/services/notifications/whatsappService.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Journaux captures (pour verifier qu'aucun secret ni donnee personnelle n'y apparait)
const logs = [];
for (const level of ['log', 'info', 'warn', 'error']) {
  const original = console[level].bind(console);
  console[level] = (...args) => { logs.push(args.join(' ')); if (process.env.VERBOSE) original(...args); };
}

// Faux fournisseur : memorise les requetes ; le comportement depend du chemin
const received = [];
let mode = 'ok';
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    received.push({ url: req.url, auth: req.headers.authorization, headers: req.headers, body: JSON.parse(body || '{}') });
    if (mode === 'slow') return setTimeout(() => res.end('{}'), 3000);
    if (mode === 'error') { res.statusCode = 401; return res.end('{"error":"unauthorized"}'); }
    res.setHeader('Content-Type', 'application/json');
    // Telegram : 200 + ok:false doit etre traite comme un echec
    if (mode === 'telegram-not-ok') return res.end('{"ok":false,"description":"chat not found"}');
    // Messenger : 200 sans message_id doit etre traite comme un echec
    if (mode === 'messenger-no-id') return res.end('{"recipient_id":"1"}');
    if (req.url.includes('/bot')) return res.end('{"ok":true}');
    if (req.url.includes('/me/messages')) return res.end('{"recipient_id":"2468","message_id":"m_demo"}');
    if (req.url.includes('/ugcPosts')) { res.statusCode = 201; res.setHeader('x-restli-id', 'urn:li:share:1'); return res.end('{}'); }
    return res.end('{"sent":true}');
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const TELEGRAM_TOKEN = '123456:SECRET-telegram-token';

const ENV = {
  WHATSAPP_CHANNEL_ENABLED: 'true', WHATSAPP_CHANNEL_PROVIDER: 'whapi', WHATSAPP_CHANNEL_API_URL: `${BASE}/wa`,
  WHATSAPP_CHANNEL_API_TOKEN: 'SECRET-wa-token', WHATSAPP_CHANNEL_ID: '120363000000000000@newsletter',
  WHATSAPP_CHANNEL_EVENTS: 'order.created,order.failed', WHATSAPP_CHANNEL_TIMEOUT_MS: '1000',
  TELEGRAM_ENABLED: 'true', TELEGRAM_API_URL: BASE, TELEGRAM_BOT_TOKEN: TELEGRAM_TOKEN,
  TELEGRAM_CHAT_ID: '@lastmile_alertes', TELEGRAM_EVENTS: 'order.created,order.failed', TELEGRAM_TIMEOUT_MS: '1000',
  SMS_ENABLED: 'true', SMS_PROVIDER: 'http', SMS_API_URL: `${BASE}/sms`, SMS_API_KEY: 'SECRET-sms-key',
  SMS_SENDER: 'LastMile', SMS_RECIPIENTS: '+237690000000, +237670000000', SMS_EVENTS: '', SMS_TIMEOUT_MS: '1000',
  MESSENGER_ENABLED: 'true', MESSENGER_API_URL: `${BASE}/fb`, MESSENGER_GRAPH_VERSION: 'v23.0',
  MESSENGER_PAGE_TOKEN: 'SECRET-messenger-token', MESSENGER_RECIPIENT_ID: '2468', MESSENGER_EVENTS: 'order.created,order.failed', MESSENGER_TIMEOUT_MS: '1000',
  LINKEDIN_ENABLED: 'true', LINKEDIN_API_URL: `${BASE}/li`, LINKEDIN_ACCESS_TOKEN: 'SECRET-linkedin-token',
  LINKEDIN_ORGANIZATION_URN: 'urn:li:organization:1357', LINKEDIN_EVENTS: 'order.created,order.failed', LINKEDIN_TIMEOUT_MS: '1000'
};
const setEnv = (overrides = {}) => Object.assign(process.env, ENV, overrides);
const reset = () => { received.length = 0; logs.length = 0; mode = 'ok'; setEnv(); };

// Payload volontairement charge de donnees personnelles : aucune ne doit sortir
const PII_PAYLOAD = {
  orderId: 42, status: 'failed', client_name: 'Jean Dupont', client_phone: '+237699112233',
  client_email: 'jean@example.com', delivery_address: '12 rue des Palmiers, Douala', latitude: 4.0511, longitude: 9.7679
};
const PII_VALUES = ['Jean', 'Dupont', '699112233', 'jean@example.com', 'Palmiers', 'Douala', '4.0511', '9.7679'];
const SECRETS = ['SECRET-wa-token', 'SECRET-telegram-token', 'SECRET-sms-key', 'SECRET-messenger-token', 'SECRET-linkedin-token'];
const CHANNEL_COUNT = 5;

const results = [];
const test = async (name, fn) => {
  reset();
  try { await fn(); results.push(`PASS ${name}`); } catch (error) { results.push(`FAIL ${name} : ${error.message}`); }
};

await test('5 canaux enregistres', () => {
  assert.deepEqual(NOTIFICATION_CHANNELS.map((c) => c.name), ['whatsapp', 'telegram', 'sms', 'messenger', 'linkedin']);
});

await test('desactives par defaut : aucun appel HTTP, intention journalisee', async () => {
  setEnv({ LINKEDIN_EVENTS: 'order.failed' });
  for (const channel of NOTIFICATION_CHANNELS) delete process.env[`${channel.envPrefix}_ENABLED`];
  for (const channel of NOTIFICATION_CHANNELS) {
    const r = await channel.publish(ORDER_EVENTS.ORDER_STATUS_CHANGED, PII_PAYLOAD);
    assert.equal(r.reason, 'disabled', channel.name);
  }
  assert.equal(received.length, 0);
  assert.equal(logs.filter((l) => l.includes('(desactive)')).length, CHANNEL_COUNT);
});

await test('WhatsApp : requete whapi correcte', async () => {
  setEnv({ WHATSAPP_CHANNEL_EVENTS: 'order.failed' });
  assert.equal((await whatsappChannel.publish(ORDER_EVENTS.ORDER_STATUS_CHANGED, PII_PAYLOAD)).sent, true);
  assert.equal(received[0].url, '/wa/messages/text');
  assert.equal(received[0].auth, 'Bearer SECRET-wa-token');
  assert.deepEqual(received[0].body, { to: '120363000000000000@newsletter', body: 'Livraison du colis #42 non aboutie.' });
});

await test('Telegram : requete sendMessage correcte', async () => {
  setEnv({ TELEGRAM_EVENTS: 'order.failed' });
  assert.equal((await telegramChannel.publish(ORDER_EVENTS.ORDER_STATUS_CHANGED, PII_PAYLOAD)).sent, true);
  assert.equal(received[0].url, `/bot${TELEGRAM_TOKEN}/sendMessage`);
  assert.deepEqual(received[0].body, { chat_id: '@lastmile_alertes', text: 'Livraison du colis #42 non aboutie.', disable_web_page_preview: true });
});

await test('SMS : requete vers les destinataires internes uniquement', async () => {
  assert.equal((await smsChannel.publish(ORDER_EVENTS.ORDER_STATUS_CHANGED, PII_PAYLOAD)).sent, true);
  assert.equal(received[0].url, '/sms');
  assert.equal(received[0].auth, 'Bearer SECRET-sms-key');
  assert.deepEqual(received[0].body, { from: 'LastMile', to: ['+237690000000', '+237670000000'], message: 'Livraison du colis #42 non aboutie.' });
});

await test('Messenger : requete Graph /me/messages correcte, jeton dans l\'en-tete et pas dans l\'URL', async () => {
  assert.equal((await messengerChannel.publish(ORDER_EVENTS.ORDER_STATUS_CHANGED, PII_PAYLOAD)).sent, true);
  assert.equal(received[0].url, '/fb/v23.0/me/messages');
  assert.equal(received[0].auth, 'Bearer SECRET-messenger-token');
  assert.ok(!received[0].url.includes('SECRET'), 'jeton dans l\'URL');
  assert.deepEqual(received[0].body, { recipient: { id: '2468' }, messaging_type: 'UPDATE', message: { text: 'Livraison du colis #42 non aboutie.' } });
});

await test('LinkedIn : requete /v2/ugcPosts correcte, auteur = page entreprise', async () => {
  assert.equal((await linkedinChannel.publish(ORDER_EVENTS.ORDER_STATUS_CHANGED, PII_PAYLOAD)).sent, true);
  assert.equal(received[0].url, '/li/v2/ugcPosts');
  assert.equal(received[0].auth, 'Bearer SECRET-linkedin-token');
  assert.equal(received[0].headers['x-restli-protocol-version'], '2.0.0');
  assert.deepEqual(received[0].body, {
    author: 'urn:li:organization:1357',
    lifecycleState: 'PUBLISHED',
    specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: 'Livraison du colis #42 non aboutie.' }, shareMediaCategory: 'NONE' } },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
  });
});

await test('valeurs par defaut prudentes : SMS = echecs, Messenger = echecs/annulations, LinkedIn = livraisons', async () => {
  setEnv({ SMS_EVENTS: '', MESSENGER_EVENTS: '', LINKEDIN_EVENTS: '' });
  assert.deepEqual([...smsChannel.getConfig().events], ['order.failed']);
  assert.deepEqual([...messengerChannel.getConfig().events], ['order.failed', 'order.cancelled']);
  assert.deepEqual([...linkedinChannel.getConfig().events], ['order.delivered']);
});

await test('SMS : par defaut, seuls les echecs de livraison sont envoyes', async () => {
  assert.equal((await smsChannel.publish(ORDER_EVENTS.ORDER_CREATED, { orderId: 7 })).reason, 'event_filtered');
  assert.equal((await smsChannel.publish(ORDER_EVENTS.ORDER_STATUS_CHANGED, { orderId: 7, status: 'delivered' })).reason, 'event_filtered');
});

await test('CONFIDENTIALITE : aucune donnee personnelle envoyee, sur aucun canal', async () => {
  setEnv({ WHATSAPP_CHANNEL_EVENTS: 'order.failed', TELEGRAM_EVENTS: 'order.failed' });
  for (const channel of NOTIFICATION_CHANNELS) await channel.publish(ORDER_EVENTS.ORDER_STATUS_CHANGED, PII_PAYLOAD);
  assert.equal(received.length, CHANNEL_COUNT);
  const sent = JSON.stringify(received.map((r) => r.body));
  for (const value of PII_VALUES) assert.ok(!sent.includes(value), `donnee personnelle envoyee : ${value}`);
  const journal = logs.join('\n');
  for (const value of PII_VALUES) assert.ok(!journal.includes(value), `donnee personnelle journalisee : ${value}`);
});

await test('configuration invalide : message ignore, raison explicite', async () => {
  // Destinataires refuses : un particulier WhatsApp, un nom au lieu d'un PSID, un profil LinkedIn personnel
  setEnv({
    WHATSAPP_CHANNEL_ID: '237690000000@s.whatsapp.net', TELEGRAM_BOT_TOKEN: 'pas-un-jeton', SMS_RECIPIENTS: '0690000000', SMS_EVENTS: 'order.created',
    MESSENGER_RECIPIENT_ID: 'jean.dupont', LINKEDIN_ORGANIZATION_URN: 'urn:li:person:123'
  });
  for (const channel of NOTIFICATION_CHANNELS) {
    assert.equal((await channel.publish(ORDER_EVENTS.ORDER_CREATED, { orderId: 1 })).reason, 'invalid_config', channel.name);
  }
  assert.equal(received.length, 0);
  for (const hint of ['@newsletter', 'TELEGRAM_BOT_TOKEN', 'format international', 'PSID', 'page entreprise uniquement']) {
    assert.ok(logs.some((l) => l.includes(hint)), `raison absente : ${hint}`);
  }
});

await test('Messenger : HTTP 200 sans message_id traite comme un echec', async () => {
  mode = 'messenger-no-id';
  assert.equal((await messengerChannel.publish(ORDER_EVENTS.ORDER_CREATED, { orderId: 3 })).reason, 'provider_error');
});

await test('Telegram : HTTP 200 avec ok:false traite comme un echec', async () => {
  mode = 'telegram-not-ok';
  const r = await telegramChannel.publish(ORDER_EVENTS.ORDER_CREATED, { orderId: 3 });
  assert.equal(r.reason, 'provider_error');
});

await test('refus 401, delai depasse, reseau coupe : aucune exception', async () => {
  mode = 'error';
  for (const channel of NOTIFICATION_CHANNELS) {
    const r = await channel.publish(ORDER_EVENTS.ORDER_STATUS_CHANGED, { orderId: 5, status: 'failed' });
    assert.equal(r.reason, 'provider_error', channel.name);
  }
  mode = 'slow';
  const start = Date.now();
  const timeouts = await Promise.all(NOTIFICATION_CHANNELS.map((c) => c.publish(ORDER_EVENTS.ORDER_STATUS_CHANGED, { orderId: 5, status: 'failed' })));
  assert.ok(timeouts.every((r) => r.reason === 'timeout'));
  assert.ok(Date.now() - start < 2500, 'delai non respecte');
  setEnv({
    WHATSAPP_CHANNEL_API_URL: 'http://127.0.0.1:9', TELEGRAM_API_URL: 'http://127.0.0.1:9', SMS_API_URL: 'http://127.0.0.1:9',
    MESSENGER_API_URL: 'http://127.0.0.1:9', LINKEDIN_API_URL: 'http://127.0.0.1:9'
  });
  for (const channel of NOTIFICATION_CHANNELS) {
    assert.equal((await channel.publish(ORDER_EVENTS.ORDER_STATUS_CHANGED, { orderId: 5, status: 'failed' })).reason, 'network_error', channel.name);
  }
});

await test('SECURITE : aucun jeton ni cle API dans les journaux', async () => {
  mode = 'error';
  for (const channel of NOTIFICATION_CHANNELS) await channel.publish(ORDER_EVENTS.ORDER_STATUS_CHANGED, { orderId: 6, status: 'failed' });
  mode = 'slow';
  await Promise.all(NOTIFICATION_CHANNELS.map((c) => c.publish(ORDER_EVENTS.ORDER_STATUS_CHANGED, { orderId: 6, status: 'failed' })));
  const journal = logs.join('\n');
  for (const secret of SECRETS) assert.ok(!journal.includes(secret), `secret journalise : ${secret}`);
});

await test('bus : diffusion vers les 5 canaux, non bloquante, un canal en panne n\'affecte pas les autres', async () => {
  initializeNotificationChannels();
  initializeNotificationChannels(); // idempotent
  for (const eventName of Object.values(ORDER_EVENTS)) assert.equal(orderEvents.listenerCount(eventName), 1);
  setEnv({ WHATSAPP_CHANNEL_EVENTS: 'order.failed', TELEGRAM_EVENTS: 'order.failed', TELEGRAM_API_URL: 'http://127.0.0.1:9' });
  const start = Date.now();
  emitOrderEvent(ORDER_EVENTS.ORDER_STATUS_CHANGED, { orderId: 77, status: 'failed', client_phone: '+237699112233' });
  assert.ok(Date.now() - start < 50, 'emission bloquante');
  await sleep(500);
  assert.deepEqual(received.map((r) => r.url).sort(), ['/fb/v23.0/me/messages', '/li/v2/ugcPosts', '/sms', '/wa/messages/text']);
  assert.ok(logs.some((l) => l.includes('[TelegramChannel] Echec de publication (network_error)')));
});

await sleep(3200); // laisse se terminer les reponses lentes du faux fournisseur
server.close();
for (const level of ['log', 'info', 'warn', 'error']) delete console[level];
const failed = results.filter((r) => r.startsWith('FAIL'));
process.stdout.write(`\n${results.join('\n')}\n\n${results.length - failed.length}/${results.length} tests reussis\n`);
process.exitCode = failed.length ? 1 : 0;
