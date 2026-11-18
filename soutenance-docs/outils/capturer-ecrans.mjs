// Capture les ecrans du guide (soutenance-docs/images-guide/) en pilotant Chrome sans fenetre.
// Prerequis : backend (3000) + frontend (5173) lances. Le script relance lui-meme le seed de demonstration
// (last-mile-backend/scripts/seed-demo.js) pour partir de donnees propres, car la capture 13 modifie un statut.
// Usage (depuis soutenance-docs/outils/) : node capturer-ecrans.mjs
// Aucune dependance : Node 22 (fetch + WebSocket natifs) et Google Chrome ou Microsoft Edge.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = process.env.APP_URL || 'http://127.0.0.1:5173';
const API = process.env.API_URL || 'http://localhost:3000';
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo2026!';
const OUT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'images-guide');
const VIEWPORT = { width: 1440, height: 900 };
const DOUALA = { latitude: 4.0405, longitude: 9.7021 }; // pres de la commande en transit (Bonapriso)
// roleLabel = libelle francais du bouton "Espace de travail" sur la page de connexion
const ACCOUNTS = {
  admin: { email: 'admin@demo.lastmile.test', roleLabel: 'Admin' },
  merchant: { email: 'marchand@demo.lastmile.test', roleLabel: 'Marchand' },
  driver: { email: 'livreur@demo.lastmile.test', roleLabel: 'Chauffeur' }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...args) => console.log('[capture]', ...args);

// Donnees de demo fraiches (comptes, produits, commandes, position GPS recente)
const BACKEND = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'last-mile-backend');
log('Seed de demonstration...');
execFileSync(process.execPath, ['scripts/seed-demo.js'], { cwd: BACKEND, stdio: ['ignore', 'ignore', 'inherit'] });

// ---------- Chrome + protocole DevTools ----------
const findChrome = () => [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'
].find((p) => p && existsSync(p));

const chromePath = findChrome();
if (!chromePath) throw new Error('Chrome/Edge introuvable (definir CHROME_PATH).');
const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, '--no-first-run',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lm-capture-'))}`, `--window-size=${VIEWPORT.width},${VIEWPORT.height}`, 'about:blank'
], { stdio: 'ignore' });

let version;
for (let i = 0; i < 60 && !version; i++) {
  try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(250); }
}
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let nextId = 0;
const pending = new Map();
const listeners = new Set();
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve: ok, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(`${msg.error.message}`)) : ok(msg.result);
  } else {
    listeners.forEach((fn) => fn(msg));
  }
});
const cdp = (method, params = {}, sessionId) => new Promise((ok, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve: ok, reject });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});

// ---------- Une "page" = un contexte isole (stockage, cookies) ----------
const newPage = async (label) => {
  const { browserContextId } = await cdp('Target.createBrowserContext');
  const { targetId } = await cdp('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => cdp(method, params, sessionId);
  const errors = [];
  listeners.add((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });
  await cdp('Browser.grantPermissions', { permissions: ['geolocation'], origin: APP, browserContextId });
  await send('Emulation.setGeolocationOverride', { ...DOUALA, accuracy: 10 });

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(`${label}: ${exceptionDetails.exception?.description || exceptionDetails.text}`);
    return result.value;
  };
  const waitFor = async (expression, timeout = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await evaluate(expression).catch(() => false)) return true;
      await sleep(200);
    }
    throw new Error(`${label}: delai depasse en attendant ${expression}`);
  };
  const goto = async (path, settle = 1500) => {
    await send('Page.navigate', { url: `${APP}${path}` });
    await waitFor('document.readyState === "complete"');
    await sleep(settle);
  };
  // Clique au centre d'un element (vrais evenements souris, compatibles avec les animations)
  const clickAt = async (findExpression) => {
    const rect = await evaluate(`(() => { const el = ${findExpression}; if (!el) return null; el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    if (!rect) throw new Error(`${label}: element introuvable ${findExpression}`);
    await sleep(250);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    }
    await sleep(500);
  };
  const byText = (text, selector = 'button') => `[...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => el.getClientRects().length > 0 && el.innerText.trim().includes(${JSON.stringify(text)}))`;
  const clickText = (text, selector) => clickAt(byText(text, selector));
  const type = async (selector, value) => {
    await clickAt(`document.querySelector(${JSON.stringify(selector)})`);
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).select?.()`);
    await send('Input.insertText', { text: value });
  };
  const shot = async (file) => {
    await evaluate('document.activeElement?.blur?.()');
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, file), Buffer.from(data, 'base64'));
    log(`OK ${file}${errors.length ? `  (erreurs JS : ${errors.splice(0).join(' | ').slice(0, 200)})` : ''}`);
  };
  const login = async (role) => {
    await goto('/login', 500);
    await evaluate("localStorage.setItem('last-mile-language', 'fr')");
    await goto('/login', 1200);
    await clickAt(`[...document.querySelectorAll('form button[type=button]')].find((b) => b.innerText.trim() === ${JSON.stringify(ACCOUNTS[role].roleLabel)})`);
    await type('input[name=email]', ACCOUNTS[role].email);
    await type('input[name=password]', PASSWORD);
    await clickAt("document.querySelector('button[type=submit]')");
    await waitFor("location.pathname !== '/login'");
    await sleep(2500);
    log(`${label} connecte -> ${await evaluate('location.pathname')}`);
  };
  return { evaluate, waitFor, goto, clickAt, clickText, byText, type, shot, login, send };
};

// ---------- API (identifiants des commandes, declenchement d'une notification) ----------
const apiLogin = async (email) => (await (await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD })
})).json()).token;
const api = async (method, path, token, body) => {
  const res = await fetch(`${API}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

const failures = [];
const step = async (name, fn) => {
  try { await fn(); } catch (error) { failures.push(`${name} : ${error.message}`); log(`ECHEC ${name} : ${error.message}`); }
};

try {
  const merchantToken = await apiLogin(ACCOUNTS.merchant.email);
  const driverToken = await apiLogin(ACCOUNTS.driver.email);
  const orders = (await api('GET', '/api/orders', merchantToken)).json;
  const byStatus = (status) => orders.find((order) => order.status === status);
  const inTransit = byStatus('in_transit');
  const assigned = byStatus('assigned');
  if (!inTransit || !assigned) throw new Error('Donnees de demo absentes : lancez `npm run seed:demo` dans last-mile-backend.');
  log(`Commandes de demo : en transit #${inTransit.id}, assignee #${assigned.id}`);

  // ----- Public -----
  const visitor = await newPage('public');
  await step('01 connexion', async () => {
    await visitor.goto('/login', 500);
    await visitor.evaluate("localStorage.setItem('last-mile-language', 'fr')");
    await visitor.goto('/login', 2000);
    await visitor.shot('01-public-connexion.png');
  });
  await step('02 inscription', async () => { await visitor.goto('/register', 2000); await visitor.shot('02-public-inscription.png'); });
  await step('06 boutique', async () => {
    await visitor.goto('/shop/boutique-demo', 4000);
    await visitor.waitFor('[...document.images].every((img) => img.complete)', 20000).catch(() => undefined);
    await visitor.shot('06-public-boutique.png');
  });
  await step('07 paiement', async () => {
    const addButton = (n) => `document.querySelectorAll('section button[aria-label="Ajouter au panier"]')[${n}]`;
    await visitor.clickAt(addButton(0));
    await visitor.clickAt(addButton(2));
    await visitor.clickText('Commander');
    await visitor.waitFor("!!document.querySelector('input[name=name]')");
    await sleep(800);
    await visitor.type('input[name=name]', 'Client Démo');
    await visitor.type('input[name=phone]', '+237 690 000 199');
    // <select> controle par React : setter natif + evenement change
    await visitor.evaluate(`(() => { const s = document.querySelector('select[name=district]');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'Akwa');
      s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await visitor.clickText('Orange Money').catch(() => undefined);
    await sleep(800);
    await visitor.shot('07-public-paiement.png');
  });

  // ----- Livreur (reste connecte pour apparaitre dans la liste de l'admin) -----
  const driver = await newPage('livreur');
  await step('09 livraisons', async () => { await driver.login('driver'); await driver.goto('/deliveries', 2500); await driver.shot('09-livreur-livraisons.png'); });
  await step('11 detail statut', async () => {
    await driver.clickAt(driver.byText(`#${inTransit.id}`, 'button') + ` || ${driver.byText(inTransit.client_name, 'button')}`);
    await sleep(1500);
    await driver.shot('11-livreur-changement-statut.png');
  });
  await step('10 carte', async () => {
    await driver.goto('/map', 6000);
    await driver.shot('10-livreur-carte.png');
  });

  // ----- Admin -----
  const admin = await newPage('admin');
  await step('08 assignation', async () => {
    await admin.login('admin');
    await admin.goto('/orders', 3000);
    await admin.clickText('Assigner un chauffeur');
    await sleep(1500);
    await admin.shot('08-admin-assignation.png');
  });

  // ----- Marchand -----
  const merchant = await newPage('marchand');
  await step('03 tableau de bord', async () => { await merchant.login('merchant'); await merchant.goto('/orders', 3000); await merchant.shot('03-marchand-tableau-de-bord.png'); });
  await step('04 creation course', async () => { await merchant.goto('/create', 3000); await merchant.shot('04-marchand-creation-course.png'); });
  await step('05 catalogue', async () => {
    await merchant.goto('/catalog', 3000);
    await merchant.waitFor('[...document.images].every((img) => img.complete)', 20000).catch(() => undefined);
    await merchant.shot('05-marchand-catalogue.png');
  });
  await step('12 suivi temps reel', async () => {
    await driver.goto('/map', 3000); // rafraichit la position GPS du livreur
    await merchant.goto(`/tracking/${inTransit.id}`, 6000);
    await merchant.shot('12-suivi-temps-reel.png');
  });
  await step('13 notification', async () => {
    await merchant.goto('/orders', 3000);
    const res = await api('PUT', `/api/orders/${assigned.id}/status`, driverToken, { status: 'picking' });
    if (res.status !== 200) throw new Error(`changement de statut refuse (${res.status})`);
    await sleep(900);
    await merchant.shot('13-notification-statut.png');
  });
} finally {
  ws.close();
  chrome.kill();
  console.log(`\nCaptures dans ${OUT}`);
  if (failures.length) {
    console.log('Echecs :');
    failures.forEach((f) => console.log(` - ${f}`));
    process.exitCode = 1;
  }
}
