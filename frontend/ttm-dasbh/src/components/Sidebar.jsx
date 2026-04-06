import { NavLink } from "react-router-dom";
import {
  ArrowRightOnRectangleIcon,
  ChartBarIcon,
  ClockIcon,
  UsersIcon,
  BanknotesIcon,
  Cog6ToothIcon,
  XMarkIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { ADMIN_API, DASHBOARD_ROUTES } from "../config/urls";
import { getSocketInstance } from "../utils/socket";
import { can, canAny, isSuper } from "../utils/rbac";

function NavLinkItem({ to, icon, label, badge = 0, onClick }) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 p-2 rounded transition
        ${
          isActive
            ? "bg-[var(--bg-card)] text-[var(--accent)] font-medium"
            : "text-[var(--text-color)] hover:bg-[var(--border-color)]/20 hover:text-[var(--accent-hover)]"
        }`
      }
    >
      {icon}
      <span className="flex items-center gap-2">
        {label}
        {badge > 0 && (
          <span className="bg-red-600 text-white text-xs font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full">
            {badge}
          </span>
        )}
      </span>
    </NavLink>
  );
}

export default function Sidebar({ open = false, onClose }) {
  const { user, logout, token } = useAuth();

  // 💸 seulement les retraits en attente
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [pendingTransactions, setPendingTransactions] = useState(0);

  const isSuperAdmin = isSuper(user);

  const missionViewPerms = [
    "requests_view",
    "requests_manage",
    "requests_publish",
    "requests_assign",
    "requests_cancel",
    "requests_complete",
    "requests_delete",
  ];

  const canViewWithdrawals =
    isSuperAdmin ||
    can(user, "withdrawals_view") ||
    can(user, "withdrawals_approve") ||
    can(user, "withdrawals_manage");

  const canViewTransactions =
    isSuperAdmin || can(user, "transactions_view") || can(user, "transactions_manage");

  // Pour le fetch on ne s'intéresse qu'aux retraits
  const canSeeFinance = canViewWithdrawals || canViewTransactions;
  const canViewMissions = isSuperAdmin || canAny(user, missionViewPerms);

  // ✅ règles d’accès
  const menu = useMemo(
    () => [
      {
        to: DASHBOARD_ROUTES.dashboard,
        label: "Dashboard",
        icon: <ChartBarIcon className="w-5 h-5" />,
        show: () => isSuperAdmin || can(user, "dashboard_view"),
      },
      {
        to: DASHBOARD_ROUTES.missions,
        label: "Missions",
        icon: <ClockIcon className="w-5 h-5" />,
        show: () => canViewMissions,
      },
      {
        to: DASHBOARD_ROUTES.clients,
        label: "Clients",
        icon: <UsersIcon className="w-5 h-5" />,
        show: () => isSuperAdmin || can(user, "clients_view"),
      },
      {
        to: DASHBOARD_ROUTES.operators,
        label: "Opérateurs",
        icon: <WrenchScrewdriverIcon className="w-5 h-5" />,
        show: () => isSuperAdmin || can(user, "operators_view"),
      },
      {
        to: DASHBOARD_ROUTES.admins,
        label: "Admins & Rôles",
        icon: <UsersIcon className="w-5 h-5" />,
        show: () =>
          isSuperAdmin ||
          can(user, "rbac_users_view") ||
          can(user, "rbac_users_manage") ||
          can(user, "rbac_roles_view") ||
          can(user, "rbac_roles_manage") ||
          can(user, "admins_view") ||
          can(user, "roles_view") ||
          can(user, "rbac_assign_role") ||
          can(user, "rbac_grant_permission") ||
          can(user, "rbac_revoke_permission"),
      },
      // 🔹 Transactions (avec badge)
      {
        to: DASHBOARD_ROUTES.transactions,
        label: "Transactions",
        icon: <BanknotesIcon className="w-5 h-5" />,
        badge: canViewTransactions ? pendingTransactions : 0,
        show: () => canViewTransactions,
      },
      // 🔹 Retraits avec badge
      {
        to: DASHBOARD_ROUTES.withdrawals,
        label: "Retraits",
        icon: <BanknotesIcon className="w-5 h-5" />,
        badge: canViewWithdrawals ? pendingWithdrawals : 0,
        show: () => canViewWithdrawals,
      },
      {
        to: DASHBOARD_ROUTES.settings,
        label: "Paramètres",
        icon: <Cog6ToothIcon className="w-5 h-5" />,
        show: () =>
          isSuperAdmin || can(user, "settings_view"),
      },
      {
        to: DASHBOARD_ROUTES.siteVitrine,
        label: "Site vitrine",
        icon: <Cog6ToothIcon className="w-5 h-5" />,
        show: () =>
          isSuperAdmin || can(user, "site_view") || can(user, "site_manage"),
      },
    ],
    [
      user,
      isSuperAdmin,
      pendingWithdrawals,
      pendingTransactions,
      canViewWithdrawals,
      canViewTransactions,
      canViewMissions,
    ]
  );

  useEffect(() => {
    if (!token || !canSeeFinance) return;

    let mounted = true;

    const fetchPendingTransactions = async () => {
      if (!canViewTransactions) {
        setPendingTransactions(0);
        return;
      }
      try {
        const res = await fetch(ADMIN_API.transactions("en_attente") + "&limit=all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!mounted) return;
        const rows = Array.isArray(data?.data) ? data.data : [];
        const listCount = rows.filter((t) => {
          const s = String(t.status || "").trim().toLowerCase().replace(/\s+/g, "_");
          return s === "en_attente" || s === "pending" || s === "en_attente_admin";
        }).length;
        setPendingTransactions(listCount);
      } catch (e) {
        console.error("Erreur fetch transactions:", e);
        if (mounted) setPendingTransactions(0);
      }
    };

    const fetchWithdrawalsCount = async () => {
      if (!canViewWithdrawals) {
        setPendingWithdrawals(0);
        return;
      }
      try {
        const res = await fetch(ADMIN_API.withdrawals("en_attente"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!mounted) return;
        const rows = Array.isArray(data?.data) ? data.data : [];
        const count = rows.filter((w) => {
          const s = String(w.status || "").trim().toLowerCase().replace(/\s+/g, "_");
          return s === "en_attente" || s === "en_attente_admin" || s === "en";
        }).length;
        setPendingWithdrawals(count);
      } catch (e) {
        if (!mounted) return;
        console.error("Erreur fetch withdrawals:", e);
        setPendingWithdrawals(0);
      }
    };

    // initial
    fetchWithdrawalsCount();
    fetchPendingTransactions();

    // refetch périodique
    const interval = setInterval(() => {
      fetchWithdrawalsCount();
      fetchPendingTransactions();
    }, 30000);

    // socket events
    const onWithdrawalCreated = () => fetchWithdrawalsCount();
    const onWithdrawalUpdated = () => fetchWithdrawalsCount(); // ex: confirmation
    const onTxEvent = () => fetchPendingTransactions();
    const socket = getSocketInstance();

    if (socket && canViewWithdrawals) {
      socket.on("withdrawal_created", onWithdrawalCreated);
      socket.on("withdrawal_updated_admin", onWithdrawalUpdated);
    }
    if (socket && canViewTransactions) {
      socket.on("transaction_created", onTxEvent);
      socket.on("transaction_updated", onTxEvent);
      socket.on("transaction_confirmed", onTxEvent);
    }

    return () => {
      mounted = false;
      clearInterval(interval);
      if (socket && canViewWithdrawals) {
        socket.off("withdrawal_created", onWithdrawalCreated);
        socket.off("withdrawal_updated_admin", onWithdrawalUpdated);
      }
      if (socket && canViewTransactions) {
        socket.off("transaction_created", onTxEvent);
        socket.off("transaction_updated", onTxEvent);
        socket.off("transaction_confirmed", onTxEvent);
      }
    };
  }, [token, canSeeFinance, canViewWithdrawals, canViewTransactions]);

  const handleNavClick = () => {
    onClose?.();
  };

  return (
    <aside
      className={`sidebar w-64 p-6 flex flex-col border-r border-[var(--border-color)] ${
        open ? "sidebar-open" : ""
      }`}
    >
      {/* Logo + close mobile */}
      <div className="flex items-center justify-between gap-2 mb-10">
        <div className="flex items-center gap-2">
          <img src="/logoApp.png" alt="Logo" className="w-10 h-10 object-contain" />
          <h1 className="font-bold text-lg text-[var(--accent)] whitespace-nowrap">
            TOW TRUCK MALI
          </h1>
        </div>
        <button
          className="lg:hidden p-2 rounded-md border border-[var(--border-color)] text-[var(--text-color)]"
          onClick={() => onClose?.()}
          aria-label="Fermer le menu"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

    {/* Navigation */}
    <nav className="flex-1 space-y-2">
      {menu
        .filter((it) => it.show())
        .map((it) => (
            <NavLinkItem
              key={it.to}
              to={it.to}
              icon={it.icon}
              label={it.label}
              badge={it.badge}
              onClick={handleNavClick}
            />
          ))}
      </nav>

    {/* Déconnexion */}
    <button
      onClick={() => {
        handleNavClick();
        logout();
      }}
      className="mt-auto flex items-center gap-3 p-2 rounded transition hover:bg-red-800 text-red-400"
    >
      <ArrowRightOnRectangleIcon className="w-5 h-5" /> Déconnexion
    </button>
  </aside>
  );
}
