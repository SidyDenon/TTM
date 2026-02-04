// src/utils/rbac.js

/** Vérifie si l'utilisateur est super admin */
export function isSuper(me) {
  return !!me?.is_super;
}

// Alias tolérants pour aligner front/back
const PERM_ALIASES = {
  can_view_dashboard: "dashboard_view",
  demandes_view: "requests_view",
  demandes_manage: "requests_manage",
  can_view_services: "services_view",
  can_manage_services: "services_manage",
  can_view_config: "config_view",
  can_manage_config: "config_manage",
  stats_view: "chart_view",
  requests_publish: "requests_manage",
  requests_assign: "requests_manage",
  requests_cancel: "requests_manage",
  requests_complete: "requests_manage",
  requests_delete: "requests_manage",
  // harmonisation transactions/retraits
  transactions_confirm: "transactions_manage",
  withdrawals_approve: "withdrawals_manage",
  withdrawals_reject: "withdrawals_manage",
  // clients
  clients_create: "clients_manage",
  clients_update: "clients_manage",
  clients_delete: "clients_manage",
  clients_reset_password: "clients_manage",
  // opérateurs
  operators_create: "operators_manage",
  operators_update: "operators_manage",
  operators_delete: "operators_manage",
  operators_reset_password: "operators_manage",
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
