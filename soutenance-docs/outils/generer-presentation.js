// Genere soutenance-docs/Presentation_Last_Mile.pptx a partir du plan PRESENTATION_SOUTENANCE.md.
// Usage (depuis soutenance-docs/outils/) : npm install && npm run presentation
const path = require('path');
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const Lu = require('react-icons/lu');
const Fa = require('react-icons/fa6'); // logos des plateformes (WhatsApp, Telegram, Messenger, LinkedIn)
const { applyTheme } = require('./apply_theme.js');

const OUTPUT = path.resolve(__dirname, '..', 'Presentation_Last_Mile.pptx');

// ---------- Informations administratives (diapositive 1) ----------
const PRESENTE_PAR = 'Styve Kentsa';
const ETABLISSEMENT = 'Vocational & Technical Institute Bureau (VTIB)';
const ENCADRANT = 'à compléter'; // remplacer par le nom de l'encadrant, puis : npm run presentation
const DATE_SOUTENANCE = 'Novembre 2026';

// ---------- Bilan des tests (diapositive 5) : a mettre a jour apres chaque campagne ----------
const TESTS_UNITAIRES = 16; // npm run test:notifications (5 canaux)
const TESTS_BOUT_EN_BOUT = 17; // npm run test:whatsapp-e2e

// ---------- Theme : reprend l'identite de l'application (fond sombre, accent orange) ----------
const THEME = {
  name: 'Last-Mile',
  headFontFace: 'Arial',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '0E0E11', // fond des diapositives
    lt1: 'F4F4F5', // texte principal
    dk2: '1A1A1F', // cartes
    lt2: 'A1A1AA', // texte secondaire
    accent1: 'F59E0B', // orange Last-Mile
    accent2: '25D366', // vert WhatsApp (reserve)
    accent3: '2A2A31', // cercles d'icones, cartes en relief
    accent4: 'FBBF24',
    accent5: '3F3F46', // traits et fleches
    accent6: 'EF4444',
    hlink: 'F59E0B',
    folHlink: 'FBBF24'
  }
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 pouces
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'Last-Mile : soutenance de fin d\'études';
pres.subject = 'Plateforme de livraison du dernier kilomètre';
pres.author = PRESENTE_PAR;
const C = pres.SchemeColor;
const BG = C.text1; // dk1
const FG = C.background1; // lt1
const CARD = C.text2; // dk2
const MUTED = C.background2; // lt2
const ORANGE = C.accent1;
const RAISED = C.accent3;
const LINE = C.accent5;

// ---------- Icones (react-icons -> SVG -> PNG) ----------
const iconCache = new Map();
const icon = async (name, colorHex) => {
  const key = `${name}-${colorHex}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const Component = name.startsWith('Fa') ? Fa[name] : Lu[name];
  if (!Component) throw new Error(`Icone introuvable : ${name}`);
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Component, { color: `#${colorHex}`, size: 256 }));
  const png = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  const data = `image/png;base64,${png.toString('base64')}`;
  iconCache.set(key, data);
  return data;
};

// ---------- Layouts ----------
const FOOTER = { x: 0.6, y: 7.0, w: 9, h: 0.3, fontSize: 10, color: MUTED, margin: 0 };
pres.defineSlideMaster({
  title: 'TITRE',
  background: { color: BG },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 1.55, w: 6.6, h: 1.2, fontFace: THEME.headFontFace, fontSize: 60, bold: true, color: FG, align: 'left', valign: 'middle', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.8, y: 2.8, w: 6.4, h: 1.1, fontSize: 24, color: ORANGE, align: 'left', valign: 'top', margin: 0 }, text: '' } }
  ]
});
pres.defineSlideMaster({
  title: 'CONTENU',
  background: { color: BG },
  margin: [0.5, 0.6, 0.6, 0.6],
  slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: MUTED, align: 'right' },
  objects: [
    { text: { text: 'Last-Mile · Soutenance de fin d\'études 2026', options: FOOTER } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.4, w: 12.1, h: 0.75, fontFace: THEME.headFontFace, fontSize: 32, bold: true, color: FG, align: 'left', valign: 'middle', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'accroche', type: 'body', x: 0.6, y: 1.15, w: 12.1, h: 0.6, fontSize: 18, italic: true, color: ORANGE, align: 'left', valign: 'top', margin: 0 }, text: '' } }
  ]
});

// ---------- Briques graphiques ----------
const card = (slide, name, x, y, w, h, fill = CARD) => slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  objectName: name, x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill }
});

const iconCircle = async (slide, name, iconName, x, y, d, { circle = RAISED, iconHex = HEX.accent1 } = {}) => {
  slide.addShape(pres.shapes.OVAL, { objectName: `${name} (cercle)`, x, y, w: d, h: d, fill: { color: circle }, line: { color: circle } });
  const pad = d * 0.24;
  slide.addImage({ objectName: `${name} (icone)`, data: await icon(iconName, iconHex), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, altText: name });
};

const text = (slide, name, value, opts) => slide.addText(value, { objectName: name, isTextBox: true, margin: 0, color: FG, fontSize: 14, valign: 'top', ...opts });

const arrow = (slide, name, x, y, w, h, color = LINE) => slide.addShape(pres.shapes.LINE, {
  objectName: name, x, y, w, h, line: { color, width: 2, endArrowType: 'triangle' }
});

// ---------- Slide 1 : Introduction ----------
const slide1 = async () => {
  pres.addSection({ title: 'Introduction' });
  const s = pres.addSlide({ masterName: 'TITRE', sectionTitle: 'Introduction' });
  await iconCircle(s, 'Logo', 'LuRoute', 0.8, 0.6, 0.8, { circle: ORANGE, iconHex: HEX.dk1 });
  text(s, 'Nom du logo', 'Operations Console', { x: 1.75, y: 0.75, w: 4, h: 0.5, fontSize: 16, color: MUTED, valign: 'middle' });
  s.addText('Last-Mile', { placeholder: 'title' });
  s.addText('La livraison du dernier kilomètre, suivie en temps réel', { placeholder: 'body' });
  text(s, 'Pitch', 'Une plateforme qui relie commerçants, livreurs et clients, du paiement jusqu\'à la livraison.', { x: 0.8, y: 4.1, w: 6.2, h: 0.9, fontSize: 18, color: FG });
  const label = (value) => ({ text: value, options: { color: MUTED } });
  const valeur = (value, last = false) => ({ text: value, options: { color: FG, bold: true, breakLine: !last } });
  text(s, 'Informations administratives', [
    label('Présenté par : '), valeur(PRESENTE_PAR),
    label('Établissement : '), valeur(ETABLISSEMENT),
    label('Encadrant : '), valeur(ENCADRANT),
    { text: `Soutenance de fin d'études · ${DATE_SOUTENANCE}`, options: { color: MUTED } }
  ], { x: 0.8, y: 5.3, w: 6.6, h: 1.4, fontSize: 14, paraSpaceAfter: 3 });

  const pillars = [
    ['LuTruck', 'Gestion de flotte', 'Assignation des livreurs'],
    ['LuMapPin', 'Suivi temps réel', 'Position GPS et statuts'],
    ['LuStore', 'Boutiques en ligne', 'Catalogue et Mobile Money'],
    ['LuMessageCircle', 'Notifications', '5 canaux, données protégées']
  ];
  for (const [i, [ic, title, sub]] of pillars.entries()) {
    const x = 7.75 + (i % 2) * 2.55;
    const y = 1.55 + Math.floor(i / 2) * 2.55;
    card(s, `Pilier ${title}`, x, y, 2.35, 2.35);
    await iconCircle(s, `Pilier ${title}`, ic, x + 0.3, y + 0.3, 0.8);
    text(s, `Pilier ${title} titre`, title, { x: x + 0.3, y: y + 1.25, w: 1.85, h: 0.4, fontSize: 16, bold: true });
    text(s, `Pilier ${title} texte`, sub, { x: x + 0.3, y: y + 1.65, w: 1.85, h: 0.55, fontSize: 12, color: MUTED });
  }
  s.addNotes('≈ 1 min. Se présenter et présenter le cadre du projet. Annoncer le plan : problème, solution, architecture, sécurité, innovation, démonstration.');
};

// ---------- Slide 2 : Problematique et objectifs ----------
const slide2 = async () => {
  const s = pres.addSlide({ masterName: 'CONTENU', sectionTitle: 'Introduction' });
  s.addText('Problématique et objectifs', { placeholder: 'title' });
  s.addText('Comment donner une visibilité en temps réel et automatiser l\'information, sans exposer les données des clients ?', { placeholder: 'accroche' });

  card(s, 'Constat', 0.6, 2.1, 5.4, 4.6);
  text(s, 'Constat titre', 'Le constat', { x: 0.95, y: 2.4, w: 4.7, h: 0.45, fontSize: 20, bold: true });
  const facts = [
    ['LuPhoneCall', 'Coordination par appels', 'Les livreurs sont gérés un par un, par téléphone et messages.'],
    ['LuEyeOff', 'Aucune visibilité', 'Le commerçant ne sait pas où se trouve son colis.'],
    ['LuUserX', 'Client non informé', 'Aucune information sur l\'avancement de la livraison.']
  ];
  for (const [i, [ic, title, body]] of facts.entries()) {
    const y = 3.1 + i * 1.15;
    await iconCircle(s, `Constat ${title}`, ic, 0.95, y, 0.7);
    text(s, `Constat ${title} titre`, title, { x: 1.85, y: y - 0.02, w: 3.9, h: 0.35, fontSize: 16, bold: true });
    text(s, `Constat ${title} texte`, body, { x: 1.85, y: y + 0.33, w: 3.9, h: 0.6, fontSize: 14, color: MUTED });
  }

  text(s, 'Objectifs titre', 'Les objectifs', { x: 6.5, y: 2.1, w: 6, h: 0.45, fontSize: 20, bold: true });
  const goals = [
    ['01', 'Centraliser', 'Commandes, livreurs et paiements dans un seul outil'],
    ['02', 'Suivre', 'Chaque colis et chaque livreur en temps réel'],
    ['03', 'Vendre en ligne', 'Boutique publique et paiement Mobile Money'],
    ['04', 'Automatiser', 'Les notifications, dans le respect de la vie privée']
  ];
  for (const [i, [num, title, body]] of goals.entries()) {
    const x = 6.5 + (i % 2) * 3.15;
    const y = 2.7 + Math.floor(i / 2) * 2.05;
    card(s, `Objectif ${num}`, x, y, 3.0, 1.9);
    text(s, `Objectif ${num} numero`, num, { x: x + 0.3, y: y + 0.25, w: 1, h: 0.5, fontSize: 26, bold: true, color: ORANGE, fontFace: THEME.headFontFace });
    text(s, `Objectif ${num} titre`, title, { x: x + 0.3, y: y + 0.8, w: 2.45, h: 0.35, fontSize: 16, bold: true });
    text(s, `Objectif ${num} texte`, body, { x: x + 0.3, y: y + 1.15, w: 2.5, h: 0.65, fontSize: 13, color: MUTED });
  }
  s.addNotes('≈ 2 min. Exemple concret : un commerçant qui vend sur les réseaux sociaux et appelle ses livreurs un par un. Insister sur les deux mots-clés : visibilité et automatisation.');
};

// ---------- Slide 3 : Architecture ----------
const slide3 = async () => {
  pres.addSection({ title: 'Solution technique' });
  const s = pres.addSlide({ masterName: 'CONTENU', sectionTitle: 'Solution technique' });
  s.addText('Architecture technique et choix de stack', { placeholder: 'title' });
  s.addText('Une architecture modulaire, temps réel, sans dépendance superflue', { placeholder: 'accroche' });

  // Frontend
  card(s, 'Frontend', 0.6, 2.75, 2.5, 1.9);
  await iconCircle(s, 'Frontend', 'LuMonitorSmartphone', 0.85, 2.95, 0.6);
  text(s, 'Frontend titre', 'Frontend PWA', { x: 0.85, y: 3.65, w: 2.1, h: 0.35, fontSize: 16, bold: true });
  text(s, 'Frontend texte', 'React 19 · Vite · Leaflet', { x: 0.85, y: 4.0, w: 2.1, h: 0.5, fontSize: 12, color: MUTED });

  // Fleches front <-> back
  arrow(s, 'Fleche REST', 3.15, 3.25, 0.95, 0);
  text(s, 'Libelle REST', 'REST', { x: 3.15, y: 2.9, w: 0.95, h: 0.3, fontSize: 11, color: MUTED, align: 'center' });
  arrow(s, 'Fleche WebSocket', 3.15, 4.15, 0.95, 0, ORANGE);
  text(s, 'Libelle WebSocket', 'WebSocket', { x: 3.1, y: 4.25, w: 1.05, h: 0.3, fontSize: 11, color: ORANGE, align: 'center' });

  // Backend
  card(s, 'Backend', 4.15, 2.1, 3.6, 3.25);
  await iconCircle(s, 'Backend', 'LuServer', 4.4, 2.3, 0.6);
  text(s, 'Backend titre', 'API Node.js / Express', { x: 5.15, y: 2.42, w: 2.5, h: 0.35, fontSize: 16, bold: true, valign: 'middle' });
  const layers = ['Routes → contrôleurs', 'Modèles SQL (transactions)', 'Bus d\'événements métier', 'Socket.IO (salons par rôle)'];
  for (const [i, label] of layers.entries()) {
    const y = 3.1 + i * 0.55;
    card(s, `Couche ${label}`, 4.4, y, 3.1, 0.45, RAISED);
    text(s, `Couche ${label} texte`, label, { x: 4.55, y, w: 2.9, h: 0.45, fontSize: 13, valign: 'middle' });
  }

  // Donnees et services externes
  arrow(s, 'Fleche MySQL', 5.0, 5.4, 0, 0.45);
  arrow(s, 'Fleche services', 6.9, 5.4, 0, 0.45);
  card(s, 'MySQL', 4.15, 5.9, 1.7, 0.85);
  await iconCircle(s, 'MySQL', 'LuDatabase', 4.3, 6.05, 0.55);
  text(s, 'MySQL texte', 'MySQL', { x: 4.95, y: 5.9, w: 0.85, h: 0.85, fontSize: 14, bold: true, valign: 'middle' });
  card(s, 'Services', 6.05, 5.9, 1.7, 0.85);
  text(s, 'Services texte', [
    { text: 'Flutterwave', options: { breakLine: true } },
    { text: 'WhatsApp' }
  ], { x: 6.2, y: 5.9, w: 1.45, h: 0.85, fontSize: 13, bold: true, valign: 'middle' });

  // Justifications
  text(s, 'Pourquoi titre', 'Pourquoi ces choix ?', { x: 8.3, y: 2.1, w: 4.4, h: 0.45, fontSize: 20, bold: true });
  const reasons = [
    ['LuZap', 'Node.js / Express', 'Non bloquant : idéal pour les nombreuses connexions des livreurs'],
    ['LuDatabase', 'MySQL sans ORM', 'Données relationnelles, transactions maîtrisées, requêtes paramétrées'],
    ['LuRadio', 'Socket.IO', 'Diffusion instantanée, uniquement aux salons autorisés'],
    ['LuWorkflow', 'Bus d\'événements', 'Logique métier indépendante des services externes']
  ];
  for (const [i, [ic, title, body]] of reasons.entries()) {
    const y = 2.75 + i * 1.0;
    await iconCircle(s, `Choix ${title}`, ic, 8.3, y, 0.6);
    text(s, `Choix ${title} titre`, title, { x: 9.1, y: y - 0.05, w: 3.6, h: 0.32, fontSize: 15, bold: true });
    text(s, `Choix ${title} texte`, body, { x: 9.1, y: y + 0.27, w: 3.6, h: 0.6, fontSize: 13, color: MUTED });
  }
  s.addNotes('≈ 3 min. Parcourir le chemin d\'une requête : route, contrôleur, modèle SQL, événement, service. Justifier l\'absence d\'ORM : un changement de statut et son historique sont écrits dans une seule transaction. Mentionner les migrations SQL rejouables.');
};

// ---------- Slide 4 : Fonctionnalites et securite ----------
const slide4 = async () => {
  const s = pres.addSlide({ masterName: 'CONTENU', sectionTitle: 'Solution technique' });
  s.addText('Fonctionnalités clés et sécurité', { placeholder: 'title' });
  s.addText('Quatre rôles, des droits stricts, des données protégées', { placeholder: 'accroche' });

  const roles = [
    ['LuShoppingBag', 'Client', 'Achète en boutique et paie, sans créer de compte'],
    ['LuStore', 'Marchand', 'Gère son catalogue, crée des courses, suit ses colis'],
    ['LuBike', 'Livreur', 'Partage sa position et met à jour le statut'],
    ['LuUserCog', 'Administrateur', 'Assigne les livreurs et supervise la flotte']
  ];
  for (const [i, [ic, title, body]] of roles.entries()) {
    const x = 0.6 + (i % 2) * 3.05;
    const y = 2.0 + Math.floor(i / 2) * 1.75;
    card(s, `Role ${title}`, x, y, 2.9, 1.6);
    await iconCircle(s, `Role ${title}`, ic, x + 0.25, y + 0.25, 0.6);
    text(s, `Role ${title} titre`, title, { x: x + 1.0, y: y + 0.3, w: 1.8, h: 0.5, fontSize: 16, bold: true, valign: 'middle' });
    text(s, `Role ${title} texte`, body, { x: x + 0.25, y: y + 0.95, w: 2.5, h: 0.6, fontSize: 13, color: MUTED });
  }

  card(s, 'Securite', 6.95, 2.0, 5.75, 3.35);
  text(s, 'Securite titre', 'Sécurité', { x: 7.25, y: 2.2, w: 5, h: 0.4, fontSize: 18, bold: true });
  const security = [
    ['LuKeyRound', 'JWT et mots de passe hachés (bcrypt)'],
    ['LuLock', 'Contrôle d\'accès par rôle sur chaque route'],
    ['LuBan', 'Blocage après 3 tentatives non autorisées'],
    ['LuShieldCheck', 'Webhook de paiement signé (HMAC SHA-256)'],
    ['LuCrosshair', 'Positions GPS imprécises rejetées']
  ];
  for (const [i, [ic, label]] of security.entries()) {
    const y = 2.72 + i * 0.5;
    s.addImage({ objectName: `Securite ${label} (icone)`, data: await icon(ic, HEX.accent1), x: 7.25, y: y + 0.07, w: 0.3, h: 0.3, altText: label });
    text(s, `Securite ${label}`, label, { x: 7.75, y, w: 4.8, h: 0.44, fontSize: 14, valign: 'middle' });
  }

  text(s, 'Cycle titre', 'Cycle de vie d\'un colis : chaque transition est contrôlée par le serveur', { x: 0.6, y: 5.6, w: 12.1, h: 0.35, fontSize: 14, color: MUTED });
  const steps = ['En attente', 'Assigné', 'En route', 'En transit', 'Livré'];
  for (const [i, label] of steps.entries()) {
    const x = 0.6 + i * 2.5;
    const last = i === steps.length - 1;
    card(s, `Etape ${label}`, x, 6.05, 2.0, 0.6, last ? ORANGE : RAISED);
    text(s, `Etape ${label} texte`, label, { x, y: 6.05, w: 2.0, h: 0.6, fontSize: 14, bold: true, align: 'center', valign: 'middle', color: last ? BG : FG });
    if (!last) arrow(s, `Fleche ${label}`, x + 2.05, 6.35, 0.4, 0);
  }
  s.addNotes('≈ 3 min. Montrer le cycle de vie d\'un colis : en attente, assigné, en route, en transit, livré ou échoué. Expliquer que les transitions sont contrôlées côté serveur : un livreur ne peut pas sauter d\'étape.');
};

// ---------- Slide 5 : Innovation, notifications multi-canaux ----------
const slide5 = async () => {
  pres.addSection({ title: 'Innovation' });
  const s = pres.addSlide({ masterName: 'CONTENU', sectionTitle: 'Innovation' });
  s.addText('Innovation : notifications multi-canaux', { placeholder: 'title' });
  s.addText('Cinq plateformes, une seule règle : aucune donnée personnelle publiée', { placeholder: 'accroche' });

  // Parcours d'un evenement : controleur -> bus -> messages anonymises
  const PIPE_Y = 2.63;
  const PIPE_H = 1.05;
  const pipeline = [
    ['LuCode', 'Contrôleur', 'Commande, statut, paiement'],
    ['LuWorkflow', 'Bus orderEvents', 'Événements métier'],
    ['LuFilter', 'Anonymisation', 'Modèles fixes, communs']
  ];
  for (const [i, [ic, title, sub]] of pipeline.entries()) {
    const x = 0.6 + i * 2.7;
    card(s, `Flux ${title}`, x, PIPE_Y, 2.3, PIPE_H);
    await iconCircle(s, `Flux ${title}`, ic, x + 0.15, PIPE_Y + 0.25, 0.55);
    text(s, `Flux ${title} titre`, title, { x: x + 0.8, y: PIPE_Y + 0.14, w: 1.45, h: 0.45, fontSize: 13, bold: true, valign: 'middle' });
    text(s, `Flux ${title} texte`, sub, { x: x + 0.8, y: PIPE_Y + 0.56, w: 1.45, h: 0.42, fontSize: 10, color: MUTED });
    if (i < pipeline.length - 1) arrow(s, `Flux fleche ${i}`, x + 2.33, PIPE_Y + PIPE_H / 2, 0.34, 0);
  }

  // Diffusion vers les 5 canaux
  const channels = [
    ['FaWhatsapp', 'WhatsApp', 'Chaîne publique'],
    ['FaTelegram', 'Telegram', 'Canal (bot)'],
    ['LuMessageSquareText', 'SMS', 'Astreinte interne'],
    ['FaFacebookMessenger', 'Messenger', 'Équipe d\'exploitation'],
    ['FaLinkedin', 'LinkedIn', 'Page entreprise']
  ];
  const fromX = 8.55;
  const fromY = PIPE_Y + PIPE_H / 2;
  const CHIP_X = 9.15;
  for (const [i, [ic, name, target]] of channels.entries()) {
    const y = 1.95 + i * 0.5;
    const mid = y + 0.21;
    const dy = mid - fromY;
    s.addShape(pres.shapes.LINE, {
      objectName: `Diffusion ${name}`, x: fromX, y: Math.min(fromY, mid), w: CHIP_X - fromX - 0.05, h: Math.abs(dy) || 0,
      flipV: dy < 0, line: { color: LINE, width: 1.5, endArrowType: 'triangle' }
    });
    card(s, `Canal ${name}`, CHIP_X, y, 3.55, 0.42, RAISED);
    s.addImage({ objectName: `Canal ${name} (icone)`, data: await icon(ic, HEX.accent1), x: CHIP_X + 0.13, y: y + 0.08, w: 0.26, h: 0.26, altText: name });
    text(s, `Canal ${name} nom`, name, { x: CHIP_X + 0.52, y, w: 1.15, h: 0.42, fontSize: 13, bold: true, valign: 'middle' });
    text(s, `Canal ${name} cible`, target, { x: CHIP_X + 1.65, y, w: 1.82, h: 0.42, fontSize: 11, color: MUTED, valign: 'middle' });
  }

  // Garanties
  const guarantees = [
    ['LuShieldCheck', 'Vie privée garantie', 'Modèles fixes : nom, téléphone, adresse et GPS ne sont jamais lus.'],
    ['LuTimer', 'Pannes isolées', 'Un canal en panne ne bloque ni les autres, ni la livraison.'],
    ['LuGitBranch', 'Extensible', 'Un nouveau canal = un fichier ; contrôleurs inchangés.']
  ];
  for (const [i, [ic, title, body]] of guarantees.entries()) {
    const x = 0.6 + i * 2.62;
    card(s, `Garantie ${title}`, x, 4.75, 2.47, 2.0);
    await iconCircle(s, `Garantie ${title}`, ic, x + 0.22, 4.93, 0.55);
    text(s, `Garantie ${title} titre`, title, { x: x + 0.92, y: 4.93, w: 1.5, h: 0.55, fontSize: 15, bold: true, valign: 'middle' });
    text(s, `Garantie ${title} texte`, body, { x: x + 0.22, y: 5.62, w: 2.05, h: 1.0, fontSize: 13, color: MUTED });
  }

  // Bilan global des tests
  const stats = [
    [String(TESTS_UNITAIRES), 'tests unitaires (5 canaux)'],
    [String(TESTS_BOUT_EN_BOUT), 'tests de bout en bout'],
    [`${TESTS_UNITAIRES + TESTS_BOUT_EN_BOUT}/${TESTS_UNITAIRES + TESTS_BOUT_EN_BOUT}`, 'tests réussis'],
    ['0', 'donnée personnelle exposée']
  ];
  for (const [i, [value, label]] of stats.entries()) {
    const x = 8.7 + (i % 2) * 2.03;
    const y = 4.75 + Math.floor(i / 2) * 1.05;
    card(s, `Stat ${label}`, x, y, 1.97, 0.95);
    text(s, `Stat ${label} valeur`, value, { x, y: y + 0.06, w: 1.97, h: 0.5, fontSize: 24, bold: true, color: ORANGE, align: 'center', valign: 'middle', fontFace: THEME.headFontFace });
    text(s, `Stat ${label} libelle`, label, { x: x + 0.05, y: y + 0.56, w: 1.87, h: 0.32, fontSize: 10, color: MUTED, align: 'center' });
  }
  s.addNotes(`≈ 3 min. Un même événement métier (commande validée, colis livré, échec) est diffusé en parallèle sur cinq plateformes : WhatsApp (chaîne publique), Telegram (canal), SMS (astreinte interne), Messenger (équipe d'exploitation), LinkedIn (page entreprise). Point clé : les canaux ne rédigent pas leurs messages ; ils reçoivent un texte déjà anonymisé par un module commun, à partir d'un numéro de commande et d'un statut. Filtrer des données n'est pas la même chose que ne jamais les lire. Les destinataires viennent de la configuration, jamais d'une commande, et les jetons d'accès ne sont jamais journalisés. Extensibilité démontrée : Messenger et LinkedIn ont été ajoutés sans modifier les contrôleurs ni le bus. Bilan : ${TESTS_UNITAIRES} tests unitaires et ${TESTS_BOUT_EN_BOUT} tests de bout en bout réussis. Être transparent : tous les canaux sont désactivés par défaut et testés contre un faux fournisseur ; les essais réels demandent les jetons de chaque plateforme.`);
};

// ---------- Slide 6 : Demonstration et conclusion ----------
const slide6 = async () => {
  pres.addSection({ title: 'Conclusion' });
  const s = pres.addSlide({ masterName: 'CONTENU', sectionTitle: 'Conclusion' });
  s.addText('Démonstration, bilan et perspectives', { placeholder: 'title' });
  s.addText('Un scénario de 3 minutes, de la commande à la notification', { placeholder: 'accroche' });

  const demo = [
    'Le marchand se connecte et crée une course',
    'L\'administrateur assigne un livreur',
    'Le livreur passe le colis « en transit » puis « livré »',
    'Le marchand suit la livraison en direct sur la carte',
    'Le message apparaît sur la chaîne WhatsApp'
  ];
  for (const [i, label] of demo.entries()) {
    const y = 2.05 + i * 0.93;
    card(s, `Demo etape ${i + 1}`, 0.6, y, 6.1, 0.78);
    s.addShape(pres.shapes.OVAL, { objectName: `Demo etape ${i + 1} (numero)`, x: 0.8, y: y + 0.14, w: 0.5, h: 0.5, fill: { color: ORANGE }, line: { color: ORANGE } });
    text(s, `Demo etape ${i + 1} chiffre`, String(i + 1), { x: 0.8, y: y + 0.14, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: BG, align: 'center', valign: 'middle' });
    text(s, `Demo etape ${i + 1} texte`, label, { x: 1.5, y, w: 5.05, h: 0.78, fontSize: 15, valign: 'middle' });
  }

  card(s, 'Bilan', 7.15, 2.05, 5.55, 1.75);
  await iconCircle(s, 'Bilan', 'LuCircleCheck', 7.4, 2.3, 0.6, { circle: ORANGE, iconHex: HEX.dk1 });
  text(s, 'Bilan titre', 'Bilan', { x: 8.2, y: 2.3, w: 4.3, h: 0.6, fontSize: 18, bold: true, valign: 'middle' });
  text(s, 'Bilan texte', 'Visibilité et automatisation atteintes : suivi en temps réel, paiement en ligne, notifications sécurisées.', { x: 7.4, y: 3.0, w: 5.1, h: 0.7, fontSize: 14, color: MUTED });

  text(s, 'Perspectives titre', 'Perspectives', { x: 7.15, y: 4.0, w: 5.5, h: 0.4, fontSize: 18, bold: true });
  const next = [
    ['LuDatabase', 'File d\'envoi persistante'],
    ['LuNavigation', 'Optimisation des tournées'],
    ['LuClock', 'Heure d\'arrivée estimée'],
    ['LuChartLine', 'Statistiques administrateur'],
    ['LuRadio', 'Essais réels des 5 canaux']
  ];
  for (const [i, [ic, label]] of next.entries()) {
    const x = 7.15 + (i % 2) * 2.825;
    const y = 4.5 + Math.floor(i / 2) * 0.62;
    card(s, `Perspective ${label}`, x, y, 2.7, 0.5, RAISED);
    s.addImage({ objectName: `Perspective ${label} (icone)`, data: await icon(ic, HEX.accent1), x: x + 0.15, y: y + 0.12, w: 0.26, h: 0.26, altText: label });
    text(s, `Perspective ${label} texte`, label, { x: x + 0.52, y, w: 2.13, h: 0.5, fontSize: 13, valign: 'middle' });
  }
  text(s, 'Merci', [
    { text: 'Merci de votre attention', options: { breakLine: true } },
    { text: 'Questions ?' }
  ], { x: 9.975, y: 5.74, w: 2.7, h: 0.5, fontSize: 14, bold: true, color: ORANGE, valign: 'middle', align: 'center' });
  s.addNotes('≈ 3 min + questions. Préparer trois comptes de démonstration (marchand, livreur, admin) avec des données fictives, ouverts dans trois fenêtres côte à côte. Garder les captures du guide en secours si la démonstration en direct échoue. Remercier le jury et ouvrir les questions.');
};

(async () => {
  await slide1();
  await slide2();
  await slide3();
  await slide4();
  await slide5();
  await slide6();
  await pres.writeFile({ fileName: OUTPUT });
  await applyTheme(OUTPUT, THEME);
  console.log(`Presentation generee : ${OUTPUT}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
