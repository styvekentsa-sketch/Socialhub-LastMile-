# Rapport de projet : Last-Mile

> Document de travail servant de base au mémoire et à la soutenance.
>
> - **Présenté par** : Styve Kentsa
> - **Établissement** : Vocational & Technical Institute Bureau (VTIB)
> - **Encadrant / superviseur** : *à compléter*
>
> Dernière mise à jour : 18 novembre 2026 (branchement des événements WhatsApp).
> Le suivi détaillé des étapes validées se trouve dans [PROGRESSION.md](PROGRESSION.md).

---

## 1. Introduction

### 1.1 Contexte

La « livraison du dernier kilomètre » désigne l'étape finale d'un envoi : le trajet entre le commerçant
(ou l'entrepôt) et le client. C'est l'étape la plus coûteuse et la moins visible de la chaîne logistique.
Le commerçant ne sait pas toujours où se trouve son colis, le client n'est pas informé, et la coordination
des livreurs se fait souvent par appels téléphoniques ou messages manuels.

Last-Mile répond à ce problème pour des commerçants qui vendent en ligne et sur les réseaux sociaux,
avec un paiement par Mobile Money (Orange Money, MTN MoMo) ou carte.

### 1.2 Présentation du projet

Last-Mile est une application web (installable comme application mobile, PWA) qui réunit dans un même
outil :

- **la gestion de flotte** : un administrateur assigne les commandes aux livreurs disponibles ;
- **le suivi en temps réel** : la position GPS du livreur et le statut de chaque colis sont transmis
  instantanément au commerçant et à l'administrateur ;
- **les boutiques en ligne** : chaque commerçant dispose d'une boutique publique (`/shop/<slug>`)
  avec catalogue, panier et paiement en ligne ;
- **le portail public (marketplace)** : sans créer de compte, un visiteur parcourt les produits de toutes
  les boutiques, commande, puis suit son colis avec un code de suivi anonyme (section 2.7) ;
- **les notifications automatiques** : les étapes clés (commande validée, colis livré, échec de livraison)
  sont diffusées sur cinq plateformes (WhatsApp, Telegram, SMS, Messenger, LinkedIn), sans exposer de
  données personnelles.

### 1.3 Acteurs

| Rôle | Ce qu'il fait dans l'application |
|---|---|
| **Client (public)** | Parcourt la marketplace, commande et paie sans créer de compte, puis suit son colis avec un code. |
| **Marchand** | Gère son catalogue et son stock, crée des courses de livraison, suit ses commandes. |
| **Livreur** | Voit les livraisons qui lui sont assignées, partage sa position, met à jour le statut du colis. |
| **Administrateur** | Supervise toutes les commandes, assigne les livreurs, débloque un livreur suspendu. |

---

## 2. Architecture technique

### 2.1 Vue d'ensemble

```
┌──────────────────────────┐        HTTPS (REST)        ┌──────────────────────────────┐
│  Frontend (PWA)          │ ─────────────────────────▶ │  Backend Node.js / Express   │
│  React 19 + Vite         │                            │                              │
│  Tailwind CSS, Leaflet   │ ◀──── WebSocket ─────────▶ │  Socket.IO (temps réel)      │
└──────────────────────────┘     (Socket.IO)            │                              │
                                                        │  routes → contrôleurs        │
                                                        │        → modèles (SQL)       │
                                                        │        → services            │
                                                        │  bus d'événements métier     │
                                                        └──────┬──────────┬────────────┘
                                                               │          │
                                                 mysql2 (pool) │          │ fetch (HTTPS)
                                                               ▼          ▼
                                                        ┌──────────┐  ┌──────────────────────┐
                                                        │  MySQL   │  │ Flutterwave (paiement)│
                                                        └──────────┘  │ WhatsApp (chaîne)     │
                                                                      └──────────────────────┘
```

Le dépôt est un monorepo contenant deux applications indépendantes :

- `last-mile-backend/` : l'API REST et le serveur temps réel ;
- `last-mile-frontend/` : l'interface web (PWA).

### 2.2 Backend

| Élément | Technologie | Rôle |
|---|---|---|
| Environnement | Node.js 22, modules ES | Exécution du serveur |
| Framework HTTP | Express 4 | Routage de l'API REST |
| Base de données | MySQL, pilote `mysql2/promise` | Stockage ; **requêtes SQL écrites à la main, sans ORM** |
| Temps réel | Socket.IO 4 | Positions GPS, changements de statut, confirmations de paiement |
| Authentification | JWT (24 h) + `bcrypt` | Sessions sans état, mots de passe hachés |
| Sécurité HTTP | `helmet`, `cors` | En-têtes de sécurité, origines autorisées |
| Fichiers | `multer` | Avatars et images de produits |
| Paiement | Flutterwave (via `fetch` natif) | Mobile Money (Orange, MTN) et carte |

**Organisation du code** (`last-mile-backend/src/`) :

| Dossier | Responsabilité |
|---|---|
| `routes/` | Déclare les URL et applique les contrôles d'accès (`protect`, `authorizeRoles`). |
| `controllers/` | Valide les entrées, applique les règles métier, renvoie la réponse HTTP. |
| `models/` | Contient toutes les requêtes SQL (transactions comprises). |
| `services/` | Intégrations externes : paiement (`flutterwaveService`, `paymentService`) et, dans `services/notifications/`, les canaux de notification (WhatsApp, Telegram, SMS, Messenger, LinkedIn). |
| `events/` | Bus d'événements métier (`orderEvents`) qui découple les contrôleurs des intégrations. |
| `config/` | Connexion MySQL, Socket.IO, CORS, téléversement de fichiers. |
| `middlewares/` | Authentification et gestion centralisée des erreurs. |

**Architecture par services et événements.** Les contrôleurs ne connaissent pas les services externes
de notification. Ils émettent un événement métier (`order.created`, `order.status_changed`,
`payment.confirmed`) sur un bus interne basé sur l'`EventEmitter` natif de Node.js. Les services
intéressés s'y abonnent. Ajouter un nouveau canal (SMS, email…) ne demande donc aucune modification
des contrôleurs (voir section 2.6).

### 2.3 Base de données

Principales tables :

| Table | Contenu |
|---|---|
| `users` | Comptes (rôle `merchant`, `driver` ou `admin`), avatar, `shop_slug` pour la boutique du marchand. |
| `orders` | Commandes : client, adresse, coordonnées, statut logistique, statut et méthode de paiement, code de suivi public (`tracking_code`). |
| `delivery_logs` | Historique de chaque changement de statut (qui, quand, quel statut). |
| `driver_positions` | Positions GPS des livreurs (précision, cap, vitesse, horodatage). |
| `products` | Catalogue des marchands : nom, description, catégorie, prix, image, stock. |
| `order_items` | Lignes de commande des achats en boutique. |

**Cycle de vie d'une livraison** (`orders.status`) :

```
pending → assigned → picking → in_transit → delivered
                                         ↘ failed
(cancelled possible avant la livraison)
```

Côté livreur, seules les transitions autorisées sont acceptées (par exemple, impossible de passer
directement de `assigned` à `delivered`).

Le schéma évolue par des scripts de migration SQL numérotés (`database/migrations/`), écrits pour pouvoir
être rejoués sans erreur.

### 2.4 Frontend

| Élément | Technologie |
|---|---|
| Interface | React 19, React Router 7 |
| Outil de build | Vite 8 |
| Style | Tailwind CSS 4, animations Framer Motion |
| Cartographie | Leaflet / React-Leaflet, fond de carte OpenStreetMap |
| Temps réel | `socket.io-client` |
| Expérience | PWA installable, bilingue (français / anglais), thème clair / sombre |
| Portail public | Module séparé `src/marketplace/`, chargé à la demande (section 2.7) |

### 2.5 Choix techniques justifiés

| Choix | Justification |
|---|---|
| **Node.js + Express** | Modèle non bloquant adapté à de nombreuses connexions simultanées (livreurs qui envoient leur position). Même langage (JavaScript) côté client et serveur. |
| **MySQL sans ORM** | Données fortement relationnelles (commandes, livreurs, historique). Le SQL écrit à la main donne un contrôle total sur les transactions et les performances, et rend chaque requête lisible et auditable. Requêtes paramétrées contre l'injection SQL. |
| **Socket.IO** | Diffusion instantanée des positions et statuts, avec des « salons » par rôle (`admins`, `merchant_<id>`, `driver_<id>`) pour n'envoyer chaque information qu'à ceux qui y ont droit. |
| **Bus d'événements** | Découple la logique métier des intégrations externes ; une panne d'un service tiers n'affecte pas la livraison. |
| **`fetch` natif** | Aucune dépendance HTTP supplémentaire ; délais maîtrisés par `AbortSignal.timeout`. |

### 2.6 Architecture multi-canaux de notification

Les alertes logistiques (commande validée, colis livré, échec de livraison…) peuvent être diffusées
sur plusieurs plateformes à la fois. L'architecture a été pensée pour qu'**ajouter une plateforme ne
touche ni aux contrôleurs, ni au bus d'événements, ni aux autres canaux**.

```text
 Contrôleurs / services métier
 (création, statut, paiement)
            │  emitOrderEvent(...)
            ▼
 ┌──────────────────────────┐
 │ Bus d'événements         │  order.created · order.status_changed · payment.confirmed
 │ (EventEmitter natif)     │
 └────────────┬─────────────┘
              │  diffusion en parallèle, sans attente
              ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │ Registre des canaux  (services/notifications/index.js)                  │
 │                                                                         │
 │  messageTemplates.js          → messages anonymisés (règle commune)     │
 │  createNotificationChannel.js → comportement commun                     │
 │                                                                         │
 │  whatsappService  telegramService  smsService  messengerService         │
 │  linkedinService                                                        │
 └────┬─────────────┬──────────────┬───────────────┬──────────────┬────────┘
      ▼             ▼              ▼               ▼              ▼
  WhatsApp      Telegram        SMS             Messenger       LinkedIn
  chaîne        canal (bot)     astreinte       équipe          page
  publique                      interne         d'exploitation  entreprise
```

**Organisation du code** (`last-mile-backend/src/services/notifications/`) :

| Fichier | Rôle |
|---|---|
| `messageTemplates.js` | Seul endroit où les messages publics sont rédigés. Partagé par tous les canaux. |
| `createNotificationChannel.js` | Comportement commun à tous les canaux : activation, choix des messages, délai maximal, journalisation, aucune exception. |
| `whatsappService.js` | Chaîne WhatsApp (`…@newsletter`) via une passerelle (adaptateur Whapi). |
| `telegramService.js` | Canal ou groupe Telegram via un bot (`sendMessage` de l'API Bot officielle). |
| `smsService.js` | SMS de secours vers une liste fixe de numéros internes (astreinte), via une passerelle HTTP. |
| `messengerService.js` | Alerte Facebook Messenger vers un membre de l'équipe d'exploitation (API Graph de Meta, `/me/messages`). |
| `linkedinService.js` | Publication sur la page entreprise LinkedIn (API UGC Posts, `/v2/ugcPosts`). |
| `index.js` | Registre des canaux, abonné une seule fois au bus. |

**Canaux disponibles** — tous désactivés par défaut :

| Canal | Activation | Destinataire | Messages publiés par défaut |
|---|---|---|---|
| WhatsApp | `WHATSAPP_CHANNEL_ENABLED=true` | Une chaîne publique (`@newsletter`), jamais un particulier | commande validée, paiement confirmé, colis livré |
| Telegram | `TELEGRAM_ENABLED=true` | Un canal ou groupe (`@nom` ou `-100…`) | commande validée, paiement confirmé, colis livré |
| SMS | `SMS_ENABLED=true` | Les numéros de l'équipe (`SMS_RECIPIENTS`), jamais les clients | échec de livraison uniquement (un SMS est payant) |
| Messenger | `MESSENGER_ENABLED=true` | Un membre de l'équipe, identifié par la page (PSID) | échec de livraison, annulation |
| LinkedIn | `LINKEDIN_ENABLED=true` | La page entreprise (`urn:li:organization:…`), jamais un profil personnel | colis livré uniquement (éviter de saturer le fil) |

Chaque canal choisit ses messages par variable d'environnement (`*_EVENTS`).

**Contraintes des plateformes, à connaître avant activation :**

- *Messenger* : l'API d'envoi n'écrit pas dans un groupe, mais à une personne qui a déjà écrit à la page.
  Hors des 24 h qui suivent son dernier message, Meta refuse l'envoi ; le canal journalise ce refus sans
  rien bloquer. La version de l'API Graph est réglable (`MESSENGER_GRAPH_VERSION`), car Meta retire les
  anciennes versions au bout d'environ deux ans.
- *LinkedIn* : il faut un jeton avec la permission `w_organization_social`, accordée par LinkedIn dans le
  cadre de son programme Community Management. `/v2/ugcPosts` est l'API historique ; LinkedIn recommande
  désormais l'API Posts (`/rest/posts`). La migration ne touche que la fonction qui construit la requête
  dans `linkedinService.js`.

**Confidentialité, identique sur tous les canaux.** Les canaux ne rédigent pas leurs messages : ils
reçoivent un texte déjà construit par `messageTemplates.js`, à partir d'un modèle fixe, d'un numéro de
commande et d'un statut pris dans une liste fermée. Le nom, le téléphone, l'email, l'adresse et les
coordonnées GPS du client ne sont jamais lus. Un nouveau canal hérite donc de cette garantie
automatiquement. Les destinataires (chaîne, canal, numéros d'astreinte, membre de l'équipe, page
entreprise) viennent de la configuration, jamais des données d'une commande. Chaque canal refuse en plus
un destinataire qui serait un particulier : numéro WhatsApp personnel, profil LinkedIn personnel. Les
jetons et clés d'API ne sont jamais écrits dans les journaux, même pour Telegram où le jeton fait partie
de l'URL ; Messenger envoie le sien dans un en-tête, jamais dans l'URL.

**Extensibilité, démontrée.** Ajouter une plateforme se fait en deux étapes :

1. créer son fichier en appelant `createNotificationChannel()` avec sa configuration et la forme de sa
   requête HTTP (20 à 50 lignes) ;
2. l'ajouter à la liste du registre `index.js`.

C'est exactement ainsi que Messenger et LinkedIn ont été ajoutés après les trois premiers canaux : les
contrôleurs, le bus et les canaux existants n'ont pas été modifiés.

**Scalabilité et interopérabilité.**

- *Isolation des pannes* : chaque canal publie en parallèle et indépendamment ; un canal en panne ou lent
  (délai maximal de 1 à 30 s) n'affecte ni les autres canaux, ni la requête de l'utilisateur.
- *Fournisseurs interchangeables* : chaque canal sépare sa logique de l'API du fournisseur (« adaptateur »).
  Changer de passerelle WhatsApp ou SMS (Orange, MTN, Twilio…) revient à ajouter un adaptateur, sans
  toucher au reste.
- *Standards ouverts* : toutes les intégrations passent par HTTP/JSON avec `fetch`, sans SDK propriétaire.
- *Configuration sans redéploiement de code* : activer, désactiver ou filtrer un canal se fait par variables
  d'environnement.
- *Limite actuelle* : le bus est en mémoire. Pour un volume élevé ou plusieurs serveurs, l'étape suivante
  est une file persistante (table « outbox » ou Redis) entre le bus et les canaux, sans changer leur code.

**Validation** : 16 tests automatisés (`npm run test:notifications`) contre un faux fournisseur HTTP. Ils
vérifient notamment :

- le format de requête de chacun des 5 canaux ;
- l'absence de toute donnée personnelle dans les requêtes et les journaux, sur les 5 canaux ;
- l'absence de tout jeton ou clé dans les journaux ;
- le refus des destinataires interdits (particulier WhatsApp, profil LinkedIn personnel…) ;
- la résistance aux refus, aux délais dépassés et aux coupures réseau, y compris les réponses
  « HTTP 200 mais échec » de Telegram et Messenger ;
- l'isolation d'un canal en panne.

Le test de bout en bout WhatsApp (17 tests, sur le vrai serveur et la vraie base) passe toujours :
**33 tests sur 33** au total.

> Telegram, SMS, Messenger et LinkedIn ont été testés contre un faux fournisseur, pas contre les vrais
> services. Les essais réels demandent les jetons de chaque plateforme (bot Telegram, passerelle SMS,
> page Facebook, page LinkedIn approuvée).

### 2.7 Portail public : marketplace et suivi de colis

Le portail public ouvre Last-Mile aux acheteurs : sans compte, ils parcourent les produits de toutes les
boutiques, commandent et suivent leur colis. Il est branché sur le système existant (mêmes boutiques,
même paiement, mêmes statuts de livraison) sans modifier aucun tableau de bord.

**Pages** (`last-mile-frontend/src/marketplace/`) :

| Adresse | Page |
|---|---|
| `/` | Accueil : recherche, chiffres clés réels, catégories, nouveautés en stock, boutiques actives, appel aux partenaires |
| `/catalogue` | Catalogue : recherche, filtres (catégorie, prix, stock), 4 tris, pagination ; tout l'état est dans l'URL (lien partageable) |
| `/produits/:id` | Fiche produit : photo, prix, description, boutique (sans coordonnées), quantité, « Commander », produits du même vendeur |
| `/boutiques` | Annuaire des boutiques, avec recherche et nombre de produits disponibles |
| `/suivi`, `/suivi/:code` | Suivi de colis par code, actualisé toutes les 30 s tant que la livraison n'est pas terminée |
| `/devenir-partenaire`, `/devenir-vendeur`, `/devenir-livreur` | Présentation des offres partenaires, inscription avec rôle présélectionné (`/register?role=…`) |
| toute autre adresse | Page 404 publique |

**API publique** (`last-mile-backend`, sans authentification) :

| Route | Rôle |
|---|---|
| `GET /api/public/marketplace` | Données de l'accueil |
| `GET /api/public/products` | Catalogue : recherche, filtres, tris, pagination (48 résultats maximum) |
| `GET /api/public/products/:id` | Fiche produit et produits du même vendeur |
| `GET /api/public/shops` | Annuaire des boutiques |
| `GET /api/public/tracking/:code` | Suivi public anonymisé |

Aucune de ces routes ne renvoie le téléphone ou l'email d'un marchand : chaque réponse est construite à
partir d'une liste fermée de champs.

**Suivi de colis public, sécurisé par conception :**

- *Code non devinable* : chaque commande reçoit à sa création un code `LM-XXXX-XXXX`, tiré au hasard
  par un générateur cryptographique dans un alphabet sans caractères ambigus (ni 0/O, ni 1/I/L), soit
  environ 8,5 × 10¹¹ combinaisons. Le numéro interne de commande, séquentiel, n'est jamais utilisé
  publiquement : il suffirait de l'incrémenter pour consulter les commandes des autres.
- *Réponse anonymisée* : statut, étapes, historique horodaté et nom de la boutique uniquement. Ni nom,
  ni téléphone, ni adresse (même pas le quartier), ni identité ou position GPS du livreur.
- *Code remis au bon moment* : il n'est communiqué qu'après le paiement, sur l'écran de confirmation ;
  une commande de boutique non payée n'est pas suivable (même réponse qu'un code inconnu).
- *Limitation de débit* : 20 consultations par minute et par adresse IP (réponse 429 au-delà), contre
  l'essai de codes au hasard. La recherche produits est limitée à 60 requêtes par minute. Le limiteur
  est écrit en interne, sans dépendance externe.

**Parcours d'achat.** Le panier reste propre à chaque boutique, comme le paiement existant. Depuis la
fiche produit, « Commander » ouvre la boutique avec le produit et la quantité déjà dans le panier
(`/shop/:slug?produit=…&quantite=…`) : le tunnel de paiement existant (Mobile Money, carte, confirmation
en temps réel) est réutilisé tel quel, sans duplication.

**Isolation de l'espace privé :**

- le portail a sa propre mise en page et son propre conteneur de défilement ; il est chargé à la demande,
  dans ses propres fichiers JavaScript et CSS, et n'alourdit pas les tableaux de bord ;
- toutes ses règles CSS sont préfixées (`.mk-root`, `.mk-…`) et rangées dans une couche CSS
  (`@layer components`) : un style du portail ne peut pas atteindre l'espace privé ;
- ses textes FR/EN sont dans un fichier séparé ; les fichiers partagés (`index.css`, `translations.js`)
  n'ont pas été modifiés ;
- l'ancienne entrée `/` de l'espace privé devient `/espace`, et l'application installée (PWA) s'ouvre
  désormais sur `/espace` : marchands et livreurs retrouvent directement leur tableau de bord.

**Direction visuelle** : palette de l'application (fond `#09090b`, bordures zinc, accent `#f59e0b`,
police Inter), grille de 1200 px, espacements en multiples de 8 px, bordures de 1 px, deux graisses de
police, icônes `lucide-react`, sans dégradé ni effet décoratif.

**Validation** :

- 21 tests réels des routes publiques (`npm run test:marketplace`) : filtres, tris, pagination, absence de
  données de contact, codes générés à la création des commandes, anonymisation du suivi, limitation de
  débit, non-régression de la boutique existante ;
- 23 vérifications dans le navigateur (fiche produit → paiement pré-rempli, suivi, 404, inscription
  présélectionnée, liens de navigation), sur ordinateur et sur mobile, sans aucune erreur JavaScript ;
- les 13 captures de l'espace privé ont été regénérées sans erreur après l'ajout du portail.

---

## 3. Sécurité et protection des données

- **Authentification** : jeton JWT valable 24 h ; mots de passe hachés avec `bcrypt`.
- **Contrôle d'accès par rôle** : chaque route sensible vérifie le rôle (`authorizeRoles`). Un livreur
  ne peut modifier que les colis qui lui sont assignés.
- **Protection contre les abus** : après 3 tentatives d'accès à un colis non assigné, le livreur est
  temporairement bloqué ; seul un administrateur peut le débloquer.
- **Temps réel sécurisé** : la connexion Socket.IO exige le jeton JWT ; chaque utilisateur ne rejoint que
  ses propres salons.
- **Paiements** : la signature des notifications Flutterwave est vérifiée (HMAC SHA-256, comparaison
  à temps constant) avant toute confirmation.
- **Qualité des données GPS** : les positions trop imprécises (au-delà d'un seuil configurable, 100 m
  par défaut) sont rejetées.
- **Données personnelles et notifications** (WhatsApp, Telegram, SMS, Messenger, LinkedIn) : les messages sont construits
  uniquement à partir de modèles fixes, d'un numéro de commande et d'un statut, par un module commun à
  tous les canaux. Le nom, le téléphone, l'email, l'adresse et les coordonnées GPS du client ne sont
  jamais lus, donc ne peuvent pas être publiés (voir section 2.6).
- **Portail public** : aucune donnée de contact des marchands dans les routes de la marketplace ; suivi
  de colis par code aléatoire non séquentiel, réponse anonymisée, code remis seulement après paiement ;
  limitation de débit sur le suivi et la recherche (voir section 2.7).
- **Configuration** : tous les secrets sont dans des variables d'environnement (`.env`, non versionné) ;
  un modèle documenté est fourni (`.env.example`).

---

## 4. Chronologie des fonctionnalités

L'historique Git ne contient que des commits de synchronisation automatique ; l'ordre ci-dessous
s'appuie sur la numérotation des migrations de base de données et sur l'état du code.

| Étape | Fonctionnalité | Trace dans le code |
|---|---|---|
| 1 | Socle : comptes et rôles, commandes, assignation des livreurs, historique des statuts, positions GPS | Tables `users`, `orders`, `delivery_logs`, `driver_positions` |
| 2 | Photo de profil (avatar) | Migration `001_add_users_avatar.sql` |
| 3 | Statuts logistiques détaillés (`picking`, `in_transit`, `picked_up`…) | Migration `002_expand_logistics_statuses.sql` |
| 4 | Description libre de la commande | Migration `003_add_order_description.sql` |
| 5 | Boutiques publiques, catalogue produits, paiement Mobile Money | Migration `004_socialhub_checkout.sql` |
| 6 | Paiements asynchrones multi-opérateurs, ajout de la carte bancaire | Migration `005_async_multi_operator_payments.sql` |
| 7 | Paiements de production (Flutterwave, lignes de commande, webhook signé) | Migration `006_production_payments.sql` ; commit « infrastructure de production prête » (3 juillet 2026) |
| 8 | Métadonnées GPS (précision, cap, vitesse) et filtrage des positions imprécises | Migration `008_add_driver_position_metadata.sql` |
| 9 | **Infrastructure de notification WhatsApp** (bus d'événements + service sécurisé) | `src/events/orderEvents.js`, service WhatsApp (18 novembre 2026) |
| 10 | **Branchement des événements métier** : création, changement de statut, paiement confirmé | `orderController`, `trackingController`, `paymentService` (18 novembre 2026) |
| 11 | **Architecture multi-canaux** : WhatsApp, Telegram, SMS sur un socle commun | `src/services/notifications/` (18 novembre 2026) |
| 12 | **Canaux Messenger et LinkedIn** : 5 canaux, ajoutés sans toucher aux contrôleurs | `messengerService.js`, `linkedinService.js` (18 novembre 2026) |
| 13 | **Portail public** : marketplace, catalogue, fiche produit, annuaire, suivi de colis par code, pages partenaires | Migration `009_marketplace_and_tracking.sql`, `src/marketplace/` (18 novembre 2026) |

---

## 5. État d'avancement

### 5.1 Fonctionnalités opérationnelles

- Inscription, connexion et espaces séparés Marchand / Livreur / Administrateur.
- Création de courses par le marchand et assignation d'un livreur par l'administrateur.
- Suivi en temps réel : position du livreur sur la carte et notification instantanée des changements de statut.
- Boutique publique par marchand, catalogue avec gestion du stock, panier et paiement en ligne.
- Portail public : accueil, catalogue multi-boutiques avec recherche et filtres, fiches produits, annuaire
  des boutiques, suivi de colis par code, pages « Devenir vendeur / livreur ».
- Application installable (PWA), bilingue, thème clair / sombre.

### 5.2 Module de notification WhatsApp : intégration backend complète (18 novembre 2026)

**Objectif** : publier automatiquement les étapes clés sur une chaîne WhatsApp publique
(identifiant `…@newsletter`), par exemple « Nouvelle commande #42 validée » ou
« Colis #42 livré avec succès ».

**Conception** :

1. **Bus d'événements** (`src/events/orderEvents.js`) : trois événements métier
   (`order.created`, `order.status_changed`, `payment.confirmed`). L'émission ne fait jamais échouer
   le code qui l'appelle.
2. **Service** (`src/services/notifications/whatsappService.js`, depuis la réorganisation multi-canaux
   décrite en section 2.6) : s'abonne au bus et publie le message.
   - envoi en arrière-plan (*fire-and-forget*) : la requête de l'utilisateur n'attend pas WhatsApp ;
   - délai maximal configurable, borné entre 1 et 30 secondes ;
   - aucune exception ne remonte : panne réseau, délai dépassé ou refus du fournisseur sont journalisés ;
   - désactivé par défaut (`WHATSAPP_CHANNEL_ENABLED=false`) : le service journalise alors le message
     qu'il aurait envoyé, sans appel réseau ;
   - choix des messages publiés par variable d'environnement (`WHATSAPP_CHANNEL_EVENTS`) ;
   - fournisseur interchangeable (adaptateur `whapi` fourni).
3. **Protection des données** : voir section 3.
4. **Déclencheurs branchés** dans le code métier :

   | Événement | Émis par | Quand |
   |---|---|---|
   | `order.created` | `orderController.createOrder` | Un marchand crée une course |
   | `order.status_changed` | `trackingController.updateOrderStatus` | Un livreur ou un admin change le statut (après enregistrement en base) |
   | `payment.confirmed` | `paymentService.emitPaymentConfirmed` | Le paiement d'une commande de boutique est confirmé (webhook ou confirmation directe) |

**Prévention des doublons** :
- Une commande de boutique publique n'est publiée qu'une fois payée (`payment.confirmed`), jamais à sa création.
- Un paiement ne peut être confirmé, et donc publié, qu'une seule fois : la base n'accepte la transition
  `pending → paid` qu'une fois, ce qui rend le webhook et la confirmation directe exclusifs.
- Une transition de statut refusée n'émet aucun événement.

**Validation** :
- 11 tests unitaires du service, exécutés contre un faux fournisseur HTTP local : absence de donnée personnelle,
  mode désactivé, délai dépassé, panne réseau, refus du fournisseur, émission non bloquante.
- 17 tests de bout en bout sur le vrai serveur, avec de vraies requêtes HTTP et la base MySQL :
  - parcours complet (course marchand → assignation → statuts → livraison, et achat en boutique payé) :
    exactement les 5 messages attendus, sans doublon ;
  - avec un fournisseur qui met 4 s à répondre, aucune requête de l'application n'est ralentie
    (27 ms au plus) et les échecs sont simplement journalisés.

**Reste à faire** : vérifier le format exact de l'API du fournisseur, puis activer le service en
production (`WHATSAPP_CHANNEL_ENABLED=true` et un vrai jeton). En option, publier l'assignation d'un
livreur, qui n'émet pas encore d'événement.

### 5.3 Limites connues et perspectives

- Le bus d'événements est en mémoire : un message en cours d'envoi est perdu si le serveur redémarre.
  Évolution prévue : une table « outbox » et un mécanisme de renvoi automatique.
- Les tables de base (`users`, `orders`, `delivery_logs`, `driver_positions`) n'ont pas encore de script
  de création dans le dépôt ; seules les migrations ultérieures y figurent.
- Pas de suite de tests automatisés complète : trois scripts versionnés couvrent les notifications
  (`test:notifications`), la marketplace (`test:marketplace`) et WhatsApp de bout en bout
  (`test:whatsapp-e2e`) ; les tableaux de bord n'ont pas de tests automatisés.
- Le limiteur de débit garde ses compteurs en mémoire, propres à chaque serveur : avec plusieurs serveurs,
  il faudra un stockage partagé (Redis par exemple). Derrière un réseau partagé (wifi d'un campus),
  plusieurs visiteurs partagent la même adresse IP et donc le même quota.
- Le nom d'une boutique est le nom du compte marchand ; un champ « nom de boutique » distinct serait plus
  adapté. Les commandes créées par un marchand ont un code de suivi, mais il n'est pas encore affiché dans
  son tableau de bord (choix de ne pas modifier l'espace privé dans cette version).
- Le fond de carte utilise les serveurs publics d'OpenStreetMap, dont la politique d'usage est limitée ;
  un fournisseur de tuiles dédié sera nécessaire en production.
- Perspectives : essais réels des 5 canaux de notification, optimisation des tournées, estimation de l'heure d'arrivée,
  tableau de bord statistique pour l'administrateur.

---

## 6. Annexes

- Guide d'utilisation illustré : [images-guide/](images-guide/README.md)
- Journal de progression : [PROGRESSION.md](PROGRESSION.md)
- Plan de la soutenance : [PRESENTATION_SOUTENANCE.md](PRESENTATION_SOUTENANCE.md)
