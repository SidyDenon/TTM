import { NavLink } from "react-router-dom";
import {
  ArrowRightOnRectangleIcon,
  ChartBarIcon,
  ClockIcon,
  TruckIcon,
  UsersIcon,
  BanknotesIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { ADMIN_API, DASHBOARD_ROUTES } from "../config/urls";
import { socket } from "../utils/socket";
import { can, canAny, isSuper } from "../utils/rbac";

function NavLinkItem({ to, icon, label, badge = 0 }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center justify-between p-2 rounded transition
        ${
          isActive
            ? "bg-[var(--bg-card)] text-[var(--accent)] font-medium"
            : "text-[var(--text-color)] hover:bg-[var(--border-color)]/20 hover:text-[var(--accent-hover)]"
        }`
      }
    >
      <div className="flex items-center gap-3">
        {icon} {label}
      </div>
      {badge > 0 && (
        <span className="bg-red-600 text-white text-xs font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, logout, token } = useAuth();

  // 💸 seulement les retraits en attente
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);

  const isSuperAdmin = isSuper(user);

  const missionViewPerms = [
    "requests_view",
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
  const canSeeFinance = canViewWithdrawals;
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
        to: DASHBOARD_ROUTES.operators,
        label: "Opérateurs",
        icon: <TruckIcon className="w-5 h-5" />,
        show: () => isSuperAdmin || can(user, "operators_view"),
      },
      {
        to: DASHBOARD_ROUTES.clients,
        label: "Clients",
        icon: <UsersIcon className="w-5 h-5" />,
        show: () => isSuperAdmin || can(user, "clients_view"),
      },
      // 🔹 Transactions (sans badge)
      {
        to: DASHBOARD_ROUTES.transactions,
        label: "Transactions",
        icon: <BanknotesIcon className="w-5 h-5" />,
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
        show: () => isSuperAdmin || can(user, "settings_view"),
      },
      {
        to: DASHBOARD_ROUTES.admins,
        label: "Admins & Rôles",
        icon: <UsersIcon className="w-5 h-5" />,
        show: () =>
          isSuperAdmin ||
          can(user, "admins_view") ||
          can(user, "roles_view") ||
          can(user, "rbac_assign_role") ||
          can(user, "rbac_grant_permission") ||
          can(user, "rbac_revoke_permission"),
      },
    ],
    [user, isSuperAdmin, pendingWithdrawals, canViewWithdrawals, canViewTransactions, canViewMissions]
  );

  // 🔁 Chargement + live des retraits uniquement
  useEffect(() => {
    if (!token || !canSeeFinance) return;

    let mounted = true;

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
        const count = Array.isArray(data?.data) ? data.data.length : 0;
        setPendingWithdrawals(count);
      } catch (e) {
        if (!mounted) return;
        console.error("Erreur fetch withdrawals:", e);
        setPendingWithdrawals(0);
      }
    };

    // initial
    fetchWithdrawalsCount();

    // refetch périodique
    const interval = setInterval(() => {
      fetchWithdrawalsCount();
    }, 30000);

    // socket events
    const onWithdrawalCreated = () => fetchWithdrawalsCount();
    const onWithdrawalUpdated = () => fetchWithdrawalsCount(); // ex: confirmation

    if (canViewWithdrawals) {
      socket.on("withdrawal_created", onWithdrawalCreated);
      socket.on("withdrawal_updated_admin", onWithdrawalUpdated);
    }

    return () => {
      mounted = false;
      clearInterval(interval);
      if (canViewWithdrawals) {
        socket.off("withdrawal_created", onWithdrawalCreated);
        socket.off("withdrawal_updated_admin", onWithdrawalUpdated);
      }
    };
  }, [token, canSeeFinance, canViewWithdrawals]);

  return (
    <aside className="sidebar w-64 p-6 flex flex-col border-r border-[var(--border-color)]">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <img src="/vite.svg" alt="Logo" className="w-8 h-8" />
        <h1 className="font-bold text-lg text-[var(--accent)]">TOW TRUCK MALI</h1>
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
            />
          ))}
      </nav>

      {/* Déconnexion */}
      <button
        onClick={logout}
        className="mt-auto flex items-center gap-3 p-2 rounded transition hover:bg-red-800 text-red-400"
      >
        <ArrowRightOnRectangleIcon className="w-5 h-5" /> Déconnexion
      </button>
    </aside>
  );
}
