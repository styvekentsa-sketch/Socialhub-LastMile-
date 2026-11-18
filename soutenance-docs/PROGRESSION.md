# Journal de progression : Last-Mile

Une entrée par grande étape validée, la plus récente en haut.
Chaque entrée indique : ce qui a été fait, les fichiers touchés, comment cela a été vérifié et ce qui reste à faire.

---

## 2026-11-18 : Canaux Messenger et LinkedIn, PowerPoint final, base de démonstration propre

**Statut** : ✅ validée (Messenger et LinkedIn testés contre un faux fournisseur uniquement)

**Réalisé**
- `messengerService.js` : alerte vers un membre de l'équipe d'exploitation via l'API Graph de Meta (`/me/messages`). Le jeton est envoyé dans un en-tête, jamais dans l'URL. Par défaut : échecs de livraison et annulations.
- `linkedinService.js` : publication sur la page entreprise via l'API UGC Posts (`/v2/ugcPosts`). L'auteur ne peut être qu'une page (`urn:li:organization:…`). Par défaut : colis livrés uniquement.
- Les deux canaux sont enregistrés dans le registre ; contrôleurs, bus et canaux existants inchangés. Variables `MESSENGER_*` et `LINKEDIN_*` dans `.env.example`, désactivées par défaut.
- PowerPoint : diapositive 5 refaite (architecture des 5 canaux et bilan des tests). Diapositive 1 : pilier « Notifications » mis à jour. Diapositive 6 : la perspective « Notifications SMS », désormais réalisée, est remplacée par « Essais réels des 5 canaux ».
- Rapport (section 2.6, chronologie, sécurité) et plan de soutenance mis à jour.
- Base de démonstration remise à l'état initial (`npm run seed:demo`).

**Vérification**
- `npm run test:notifications` : 16/16. Couvre les 5 canaux : format des requêtes, aucune donnée personnelle, aucun jeton dans les journaux, refus des destinataires interdits, réponses « 200 mais échec » de Telegram et Messenger, refus, délais dépassés, coupures réseau, isolation des pannes.
- `npm run test:whatsapp-e2e` : 17/17, aucune régression. **Total : 33/33.**
- PowerPoint regénéré et ouvert dans PowerPoint : 6 diapositives ; diapositives 1, 5 et 6 relues visuellement.

**Reste à faire**
- Essais réels avec les jetons de chaque plateforme. Messenger impose une fenêtre de 24 h après le dernier message du destinataire. LinkedIn exige la permission `w_organization_social`.
- Migration LinkedIn vers l'API Posts (`/rest/posts`), recommandée par LinkedIn.
- Renseigner le nom de l'encadrant.

---

## 2026-11-18 : Architecture de notification multi-canaux (WhatsApp, Telegram, SMS)

**Statut** : ✅ validée (canaux Telegram et SMS testés contre un faux fournisseur uniquement)

**Réalisé**
- Nouveau dossier `src/services/notifications/` :
  - un module commun de messages anonymisés (`messageTemplates.js`) ;
  - une fabrique de canal qui porte le comportement commun (`createNotificationChannel.js`) ;
  - trois canaux : `whatsappService.js` (ancien `whatsappChannelService.js`, comportement inchangé), `telegramService.js`, `smsService.js` ;
  - un registre (`index.js`).
- Le SMS est un canal de secours vers les numéros de l'équipe d'exploitation, jamais vers les clients. Par défaut, il n'envoie que les échecs de livraison.
- `.env.example` : variables `TELEGRAM_*` et `SMS_*`, désactivées par défaut.
- Rapport : nouvelle section 2.6 « Architecture multi-canaux de notification ».

**Vérification**
- `npm run test:notifications` : 12/12. Couvre le format des requêtes des 3 canaux, l'absence de donnée personnelle dans les requêtes et les journaux, l'absence de jeton dans les journaux, les refus, délais dépassés et coupures réseau, et l'isolation d'un canal en panne.
- `npm run test:whatsapp-e2e` : 17/17, aucune régression après le déplacement du service WhatsApp.

**Reste à faire**
- Essais réels : jeton de bot Telegram, compte chez une passerelle SMS (et adaptateur dédié si son API diffère du format générique).
- Facebook Messenger : non implémenté. L'architecture le permet (un fichier et une ligne dans le registre), mais l'envoi Messenger exige une page Facebook et des règles d'opt-in propres à Meta.

---

## 2026-11-18 : Fond de carte OpenStreetMap et informations administratives

**Statut** : ✅ validée

**Réalisé**
- Fond de carte : remplacement des tuiles CARTO (devenues payantes, « API KEY REQUIRED ») par les tuiles publiques OpenStreetMap (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`), attribution « © OpenStreetMap contributors ».
- Les 13 captures du guide ont été regénérées (seed de démonstration relancé) : les cartes 10 et 12 affichent désormais les rues de Douala.
- Diapositive 1 du PowerPoint et documents de soutenance : ajout du présentateur, de l'établissement et de l'encadrant.

**Fichiers**
- `last-mile-frontend/src/components/map/TrackingMap.jsx`, `DriverInteractiveMap.jsx`
- `soutenance-docs/outils/generer-presentation.js`, `Presentation_Last_Mile.pptx`, `RAPPORT_PROJET.md`, `PRESENTATION_SOUTENANCE.md`

**Reste à faire**
- Renseigner le nom de l'encadrant (constante `ENCADRANT` du générateur, puis `npm run presentation`).
- En production à fort trafic, prévoir un fournisseur de tuiles dédié : les serveurs publics d'OpenStreetMap ont une politique d'usage limitée.

---

## 2026-11-18 : Données de démonstration et captures du guide

**Statut** : ✅ validée (fond de carte corrigé depuis, voir entrée ci-dessus)

**Réalisé**
- Script `last-mile-backend/scripts/seed-demo.js` (`npm run seed:demo`) : 3 comptes de démonstration (admin, marchand avec boutique `/shop/boutique-demo`, livreur), 6 produits, 6 commandes (en attente, assignée, en livraison, 2 livrées, 1 commande boutique payée), historique des statuts et position GPS du livreur. Données fictives, relançable, refuse de tourner en production, ne touche pas aux autres comptes.
- Script `soutenance-docs/outils/capturer-ecrans.mjs` : 13 captures du guide générées automatiquement en français, une session isolée par profil.
- Le support PowerPoint a été généré en parallèle (`soutenance-docs/Presentation_Last_Mile.pptx`).

**Vérification**
- Seed exécuté plusieurs fois : comptes et produits mis à jour sans doublon, commandes recréées.
- Connexion réussie avec les 3 comptes de démonstration ; boutique publique avec 6 produits.
- Les 13 captures ont été relues une à une.

**Problème découvert**
- Le fond de carte (CARTO) affiche « API KEY REQUIRED » : le fournisseur exige désormais une clé. Cela touche les vrais utilisateurs, pas seulement les captures. Fichiers concernés : `TrackingMap.jsx`, `DriverInteractiveMap.jsx`.

**Reste à faire**
- Corriger le fournisseur de tuiles, puis regénérer les captures 10 et 12.
- Capture 14 (chaîne WhatsApp) : à faire une fois le service activé avec un vrai jeton.

---

## 2026-11-18 : Branchement des événements métier (intégration WhatsApp complète côté backend)

**Statut** : ✅ validée

**Réalisé**
- `order.created` émis à la création d'une commande par un marchand (`orderController.createOrder`).
- `order.status_changed` émis à chaque changement de statut accepté (`trackingController.updateOrderStatus`, seule route active pour les statuts).
- `payment.confirmed` émis quand un paiement de boutique est confirmé (`paymentService.emitPaymentConfirmed`, utilisé à la fois par le webhook Flutterwave et par la confirmation directe).
- Le code mort `orderController.updateOrderStatus` et `publicController.checkout` n'ont volontairement pas été modifiés.

**Prévention des doublons**
- Une commande de boutique publique n'émet jamais `order.created` : elle n'est publiée qu'une fois payée, via `payment.confirmed`.
- Un même paiement ne peut pas être publié deux fois : `confirmPayment` ne fait la transition `pending → paid` que si la commande est encore en attente, et ne renvoie la commande qu'à un seul appelant. Le webhook et la confirmation directe sont donc exclusifs.
- Une transition de statut refusée (HTTP 409) n'émet aucun événement, car l'émission a lieu après l'enregistrement en base.

**Fichiers**
- `last-mile-backend/src/controllers/orderController.js`
- `last-mile-backend/src/controllers/trackingController.js`
- `last-mile-backend/src/services/paymentService.js`

**Vérification** : test de bout en bout, 17/17 réussis, sur le vrai serveur avec de vraies requêtes HTTP et la base MySQL locale
- Phase 1, service désactivé : création marchand, assignation, statuts `picking` → `in_transit` → `delivered`, achat en boutique payé. Exactement 5 messages journalisés, dans le bon ordre. Aucun `order.created` pour la commande de boutique. Aucun message pour la transition interdite. Aucune donnée personnelle dans les logs.
- Phase 2, service activé face à un faux fournisseur qui met 4 s à répondre (délai maximal 2 s) : toutes les requêtes HTTP réussissent en 27 ms au plus. Les 5 délais dépassés sont journalisés sans erreur. Les corps reçus par le fournisseur ne contiennent que l'identifiant de chaîne et le texte du message.
- Les données de test ont été supprimées et le stock restauré après le test.

**Reste à faire**
- Vérifier le format de l'API du fournisseur (Whapi) puis activer le service en production avec un vrai jeton.
- L'assignation d'un livreur (`assignDriver`) n'émet pas d'événement : le message « pris en charge par un livreur » n'est donc jamais publié. À brancher si on le souhaite.

---

## 2026-11-18 : Infrastructure de notification sur chaîne WhatsApp

**Statut** : ✅ validée

**Réalisé**
- Bus d'événements métier basé sur l'`EventEmitter` natif : `order.created`, `order.status_changed`, `payment.confirmed`.
- Service `whatsappChannelService` abonné au bus : envoi non bloquant, délai maximal, journalisation des erreurs, mode désactivé par défaut.
- Messages construits uniquement à partir de modèles fixes : aucune donnée personnelle ne peut être publiée.
- Initialisation du service au démarrage du serveur.
- Documentation des variables d'environnement (`WHATSAPP_CHANNEL_*`, `FLW_LOCAL_FALLBACK`).

**Fichiers**
- `last-mile-backend/src/events/orderEvents.js` (nouveau)
- `last-mile-backend/src/services/whatsappChannelService.js` (nouveau)
- `last-mile-backend/src/app.js` (initialisation du service)
- `last-mile-backend/.env.example` (nouvelles variables)

**Vérification**
- 11/11 tests réussis contre un faux fournisseur HTTP : requête correcte, aucune donnée personnelle transmise, mode désactivé, filtrage des événements, configuration invalide, refus HTTP 401, délai dépassé, panne réseau, émission non bloquante, robustesse du bus.
- Démarrage réel du serveur : service initialisé, connexion MySQL réussie, `/api/health` répond OK.

**Suite** : branchement dans les contrôleurs réalisé (entrée ci-dessus).

---

## 2026-11-18 : Analyse technique du backend

**Statut** : ✅ validée

**Réalisé**
- Inventaire de la stack (Express, MySQL sans ORM, Socket.IO, aucune file d'attente).
- Repérage de tous les endroits où les statuts de commande et de paiement sont modifiés.
- Choix de l'emplacement du futur service WhatsApp et des variables d'environnement.

**Points relevés**
- `orderController.updateOrderStatus` n'est relié à aucune route (code mort).
- Les tables de base n'ont pas de script de création dans le dépôt.

---

## 2026-11-05 : Lancement local du projet

**Statut** : ✅ validée

**Réalisé**
- Backend (port 3000) et frontend (port 5173) lancés et vérifiés, connexion MySQL réussie.
- Installation du binaire Windows manquant `lightningcss-win32-x64-msvc`, nécessaire à Tailwind.
- Vérification de la page d'accueil publique : redirection vers `/login`, aucune erreur dans la console.

---

## 2026-07-03 : Infrastructure de production

**Statut** : ✅ (antérieur à ce journal)

Commit « feat: infrastructure de production prête » : paiements Flutterwave de production, webhook signé, configuration par variables d'environnement.

---

## Modèle pour une nouvelle entrée

```markdown
## AAAA-MM-JJ : Titre de l'étape

**Statut** : ✅ validée / ⏳ en cours

**Réalisé**
- …

**Fichiers**
- …

**Vérification**
- …

**Reste à faire**
- …
```
