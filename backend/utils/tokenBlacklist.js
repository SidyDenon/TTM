// utils/tokenBlacklist.js
// Blacklist JWT en mémoire (suffit pour serveur unique)
// Les tokens expirés sont nettoyés automatiquement par le cron existant
const blacklisted = new Set();

export function blacklistToken(token) {
  if (token) blacklisted.add(token);
}

export function isTokenBlacklisted(token) {
  return blacklisted.has(token);
}
