# Tow Truck Mali Monorepo

Ce dépôt regroupe trois projets JavaScript/TypeScript complémentaires :

| Dossier          | Description                                     |
|------------------|-------------------------------------------------|
| `backend/`       | API Express + Socket.IO (Node.js)               |
| `frontend/`      | Interface web (dashboard admin + landing)       |
| `User-App/`      | Application mobile (Expo / React Native)        |

## Prérequis

- Node.js 20+ (recommandé) et npm/pnpm/yarn
- MySQL accessible pour l’API (`backend/.env` à configurer)
- Expo CLI pour lancer l’application mobile

## Démarrage rapide

```bash
# Backend
cd backend
cp .env.example .env     # compléter les variables
npm install
npm run start

# Dashboard (frontend/ttm-dasbh)
cd ../frontend/ttm-dasbh
cp .env.example .env.local    # renseigner VITE_API_URL
npm install
npm run dev

# Application mobile
cd ../../User-App
npm install
npm run start
```

> Les projets `frontend/TTM` (site marketing) et `frontend/ttm-dasbh` (dashboard) possèdent chacun leur configuration Vite. Adapter les variables d’environnement au besoin.

## Structure

- `backend/routes/*` : routes REST (clients, opérateurs, admins).
- `frontend/ttm-dasbh/src/config/urls.js` : point central pour les URLs/API du dashboard.
- `User-App/config/urls.ts` : configuration des endpoints pour l’app mobile.

## Tests

Chaque projet conserve ses scripts (`npm test`, `npm run lint`, etc.). Se référer aux `package.json` respectifs.

## Contribution

1. Créer une branche (`git checkout -b feature/...`).
2. Implémenter et tester.
3. Ouvrir une MR/PR décrivant les changements.
