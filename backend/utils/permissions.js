// utils/permissions.js — source unique des alias de permissions
export const PERM_ALIASES = {
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
  transactions_confirm: "transactions_manage",
  withdrawals_approve: "withdrawals_manage",
  withdrawals_reject: "withdrawals_manage",
  clients_create: "clients_manage",
  clients_update: "clients_manage",
  clients_delete: "clients_manage",
  clients_reset_password: "clients_manage",
  operators_create: "operators_manage",
  operators_update: "operators_manage",
  operators_delete: "operators_manage",
  operators_reset_password: "operators_manage",
};

export const canon = (p) => PERM_ALIASES[p] || p;
