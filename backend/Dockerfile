# -------------------------
# Backend TTM – Dockerfile
# -------------------------

# 1. Base Node.js
FROM node:18

# 2. Dossier de travail
WORKDIR /app

# 3. Copier uniquement package.json pour installer dépendances
COPY package.json package-lock.json* yarn.lock* ./

# 4. Installer les dépendances
RUN npm install

# 5. Copier tout le code du backend
COPY . .

# 6. Exposer le port utilisé par Render
EXPOSE 5000

# 7. Commande de démarrage
CMD ["npm", "start"]
