# Guide illustré : captures d'écran

Ce dossier contient les captures d'écran du guide d'utilisation pas à pas de Last-Mile.
Elles servent au rapport écrit (`../RAPPORT_PROJET.md`) et aux diapositives (`../PRESENTATION_SOUTENANCE.md`).

## Convention de nommage

`NN-role-etape.png`, par exemple `03-marchand-creation-course.png`.

- `NN` : numéro d'ordre dans le parcours (01, 02…).
- `role` : `public`, `marchand`, `livreur` ou `admin`.
- `etape` : action montrée, en minuscules et séparée par des tirets.

Format des captures générées : PNG en 1440×900 (bureau), interface en français. Utiliser des données fictives
uniquement : aucun vrai nom, numéro de téléphone ni adresse de client sur les captures.

## Regénérer les captures

1. Lancer le backend (port 3000) et le frontend (port 5173).
2. Depuis `soutenance-docs/outils/` : `node capturer-ecrans.mjs`.

Le script relance d'abord le seed de démonstration (`last-mile-backend/scripts/seed-demo.js`),
puis se connecte avec chaque profil de démonstration dans un Chrome sans fenêtre et écrase les images ci-dessous.

Les cartes (captures 10 et 12) utilisent les tuiles publiques OpenStreetMap ; une connexion Internet est
nécessaire pendant la capture.

## Captures prévues

| Fichier | Rôle | Écran / action | Fait |
|---|---|---|---|
| `01-public-connexion.png` | Public | Page de connexion (choix Marchand / Livreur / Admin, EN/FR, thème) | ✅ |
| `02-public-inscription.png` | Public | Création de compte | ✅ |
| `03-marchand-tableau-de-bord.png` | Marchand | Liste des commandes et statuts | ✅ |
| `04-marchand-creation-course.png` | Marchand | Formulaire de création d'une course (adresse, position) | ✅ |
| `05-marchand-catalogue.png` | Marchand | Catalogue produits et gestion du stock | ✅ |
| `06-public-boutique.png` | Public | Boutique publique `/shop/<slug>` et panier | ✅ |
| `07-public-paiement.png` | Public | Paiement Mobile Money / carte et confirmation | ✅ |
| `08-admin-assignation.png` | Admin | Assignation d'un livreur à une commande | ✅ |
| `09-livreur-livraisons.png` | Livreur | Liste des livraisons assignées | ✅ |
| `10-livreur-carte.png` | Livreur | Carte interactive et partage de position GPS | ✅ |
| `11-livreur-changement-statut.png` | Livreur | Passage « en route » → « en transit » → « livré » | ✅ |
| `12-suivi-temps-reel.png` | Marchand / Admin | Suivi de la livraison sur la carte en temps réel | ✅ |
| `13-notification-statut.png` | Tous | Notification instantanée (toast) de changement de statut | ✅ |
| `14-whatsapp-chaine.png` | Public | Message publié sur la chaîne WhatsApp (après activation) | ☐ à faire à la main, une fois le service activé |
