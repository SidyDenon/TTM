// src/utils/rbac.js

/** Vérifie si l'utilisateur est super admin */
export function isSuper(me) {
  return !!me?.is_super;
}

// Alias tolérants pour aligner front/back
const PERM_ALIASES = {
  dashboard_view: "can_view_dashboard",
  demandes_view: "requests_view",
  demandes_manage: "requests_manage",
  // harmonisation transactions/retraits
  transactions_confirm: "transactions_manage",
  withdrawals_approve: "withdrawals_manage",
  withdrawals_reject: "withdrawals_manage",
};
const canon = (p) => PERM_ALIASES[p] || p;

function asArray(perms) {
  if (!perms) return [];
  if (Array.isArray(perms)) return perms;
  if (typeof perms === "object") return Object.keys(perms).filter((k) => !!perms[k]);
  return [];
}

/** Vérifie une seule permission */
export function can(me, key) {
  if (isSuper(me)) return true; // super-admin voit tout
  const list = asArray(me?.permissions).map(canon);
  const k = canon(key);
  return list.includes(k);
}

/** Vérifie que l’utilisateur possède *toutes* les permissions de la liste */
export function canAll(me, keys = []) {
  if (isSuper(me)) return true;
  const list = asArray(me?.permissions).map(canon);
  const wanted = (keys || []).map(canon);
  return wanted.every((k) => list.includes(k));
}

/** Vérifie que l’utilisateur possède *au moins une* des permissions */
export function canAny(me, keys = []) {
  if (isSuper(me)) return true;
  const list = asArray(me?.permissions).map(canon);
  const wanted = (keys || []).map(canon);
  return wanted.some((k) => list.includes(k));
}
