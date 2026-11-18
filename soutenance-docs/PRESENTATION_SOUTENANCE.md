# Plan de la soutenance : Last-Mile

Durée visée : environ 15 minutes de présentation + démonstration.
Chaque diapositive indique : le titre, le contenu affiché, le visuel conseillé et les notes de l'orateur.
Règle générale : peu de texte à l'écran (5 points maximum), le détail est dans les notes.

---

## Slide 1 : Introduction / Présentation du projet

**Titre** : Last-Mile : la livraison du dernier kilomètre, suivie en temps réel

**À l'écran**
- Nom du projet et logo
- **Présenté par** : Styve Kentsa
- **Établissement** : Vocational & Technical Institute Bureau (VTIB)
- **Encadrant / superviseur** : *à compléter*
- Soutenance de fin d'études · Novembre 2026
- Une phrase : « Une plateforme qui relie commerçants, livreurs et clients, du paiement jusqu'à la livraison. »
- Quatre pictogrammes : Flotte · Suivi temps réel · Boutiques · Notifications WhatsApp

**Visuel** : capture de la page de connexion (`images-guide/01-public-connexion.png`) ou maquette téléphone + ordinateur.

**Notes de l'orateur (≈ 1 min)**
- Se présenter, présenter le cadre du projet.
- Annoncer le plan : problème → solution → architecture → sécurité → innovation → démonstration.

---

## Slide 2 : Problématique et objectifs

**Titre** : Le dernier kilomètre, maillon le plus coûteux et le moins visible

**À l'écran**
- **Constat** : coordination par appels et messages, aucune visibilité sur le colis, client non informé.
- **Problématique** : comment donner une visibilité en temps réel et automatiser l'information, sans exposer les données des clients ?
- **Objectifs** :
  1. Centraliser commandes, livreurs et paiements dans un seul outil
  2. Suivre chaque colis et chaque livreur en temps réel
  3. Permettre aux commerçants de vendre en ligne (boutique + Mobile Money)
  4. Automatiser les notifications, en respectant la vie privée

**Visuel** : schéma « Commerçant → Livreur → Client » avec un point d'interrogation sur le trajet.

**Notes de l'orateur (≈ 2 min)**
- Donner un exemple concret : un commerçant qui vend sur les réseaux sociaux et appelle ses livreurs un par un.
- Insister sur les deux mots-clés : visibilité et automatisation.

---

## Slide 3 : Architecture technique et choix de stack

**Titre** : Une architecture modulaire, temps réel, sans dépendance superflue

**À l'écran**
- Schéma d'architecture (reprendre la section 2.1 de `RAPPORT_PROJET.md`) :
  Frontend React (PWA) ⇄ API Express + Socket.IO → MySQL ; services externes Flutterwave et WhatsApp
- Pourquoi ces choix :
  - **Node.js / Express** : non bloquant, adapté aux nombreuses connexions simultanées des livreurs
  - **MySQL sans ORM** : données relationnelles, transactions maîtrisées, requêtes lisibles et paramétrées
  - **Socket.IO** : diffusion instantanée, salons par rôle
  - **Bus d'événements** : la logique métier ne dépend pas des services externes

**Visuel** : le schéma d'architecture, en couleur, avec les flux REST et WebSocket distingués.

**Notes de l'orateur (≈ 3 min)**
- Parcourir le chemin d'une requête : route → contrôleur → modèle SQL → événement → service.
- Justifier l'absence d'ORM : contrôle des transactions (changement de statut + historique en une seule transaction).
- Mentionner les migrations SQL rejouables.

---

## Slide 4 : Fonctionnalités clés et sécurité

**Titre** : Quatre rôles, des droits stricts, des données protégées

**À l'écran**
- **Rôles** : Client (sans compte) · Marchand · Livreur · Administrateur
- **Fonctionnalités** : création de courses, assignation, carte en temps réel, boutique et paiement Mobile Money, PWA bilingue
- **Sécurité** :
  - JWT + mots de passe hachés (`bcrypt`)
  - Contrôle d'accès par rôle sur chaque route ; un livreur ne voit que ses colis
  - Blocage après 3 tentatives d'accès non autorisées
  - Webhook de paiement signé (HMAC SHA-256)
  - Positions GPS imprécises rejetées

**Visuel** : tableau Rôle × Droits, ou captures du tableau de bord marchand et de l'écran livreur.

**Notes de l'orateur (≈ 3 min)**
- Montrer le cycle de vie d'un colis : en attente → assigné → en route → en transit → livré / échoué.
- Expliquer que les transitions sont contrôlées côté serveur (un livreur ne peut pas sauter d'étape).

---

## Slide 5 : Innovation / cas d'usage : notifications multi-canaux

**Titre** : Innovation : notifications multi-canaux
**Accroche** : Cinq plateformes, une seule règle : aucune donnée personnelle publiée

**À l'écran**
- Parcours d'un événement : Contrôleur → bus `orderEvents` → anonymisation (modèles fixes communs) → diffusion en parallèle vers 5 canaux :
  WhatsApp (chaîne publique) · Telegram (canal) · SMS (astreinte interne) · Messenger (équipe d'exploitation) · LinkedIn (page entreprise)
- Trois garanties :
  1. **Vie privée garantie** : nom, téléphone, adresse et GPS ne sont jamais lus, sur aucun canal
  2. **Pannes isolées** : un canal en panne ne bloque ni les autres, ni la livraison
  3. **Extensible** : un nouveau canal = un fichier ; contrôleurs inchangés
- Bilan des tests : 16 tests unitaires (5 canaux) + 17 tests de bout en bout = 33/33 réussis ; 0 donnée personnelle exposée

**Visuel** : le schéma de diffusion vers les 5 logos de plateformes ; capture de la chaîne WhatsApp si disponible (`images-guide/14-whatsapp-chaine.png`).

**Notes de l'orateur (≈ 3 min)**
- Les canaux ne rédigent pas leurs messages : ils reçoivent un texte déjà anonymisé par un module commun. Filtrer des données n'est pas la même chose que ne jamais les lire.
- Les destinataires viennent de la configuration, jamais d'une commande, et les jetons d'accès ne sont jamais journalisés.
- Extensibilité démontrée : Messenger et LinkedIn ont été ajoutés sans modifier les contrôleurs ni le bus.
- Expliquer l'anti-doublon : une commande de boutique n'est publiée qu'une fois payée, et un paiement ne peut être confirmé qu'une fois.
- Être transparent : tous les canaux sont désactivés par défaut et testés contre un faux fournisseur ; les essais réels demandent les jetons de chaque plateforme.

---

## Slide 6 : Démonstration, conclusion et perspectives

**Titre** : Démonstration et suite du projet

**À l'écran**
- **Démonstration** (scénario de 3 minutes) :
  1. Le marchand se connecte et crée une course
  2. L'administrateur assigne un livreur
  3. Le livreur passe le colis « en transit » puis « livré »
  4. Le marchand voit la mise à jour instantanément sur la carte
  5. (Si activé) le message apparaît sur la chaîne WhatsApp
- **Bilan** : objectifs de visibilité et d'automatisation atteints
- **Perspectives** : file d'envoi persistante (outbox), optimisation des tournées, estimation de l'heure d'arrivée, statistiques administrateur, notifications SMS

**Visuel** : captures du guide en secours si la démonstration en direct échoue.

**Notes de l'orateur (≈ 3 min + questions)**
- Préparer trois comptes de démonstration (marchand, livreur, admin) et des données fictives.
- Ouvrir les trois rôles dans trois fenêtres de navigateur côte à côte avant la soutenance.
- Remercier le jury et ouvrir les questions.

---

## Questions probables du jury (préparation)

| Question | Éléments de réponse |
|---|---|
| Pourquoi pas d'ORM ? | Contrôle des transactions et des performances, requêtes paramétrées, pas de couche cachée. |
| Que se passe-t-il si WhatsApp est indisponible ? | Envoi en arrière-plan avec délai maximal ; l'erreur est journalisée, la livraison continue. |
| Comment garantir qu'aucune donnée personnelle n'est publiée ? | Le service ne lit que le numéro de commande et un statut d'une liste fermée ; vérifié par test. |
| Un livreur peut-il modifier la commande d'un autre ? | Non : vérification de l'assignation côté serveur, blocage après 3 tentatives. |
| Comment passer à l'échelle ? | Pool de connexions MySQL, salons Socket.IO ; à terme, adaptateur Redis pour Socket.IO et file d'attente persistante. |
