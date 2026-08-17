// src/App.jsx
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import usePushNotifications from "./hooks/usePushNotifications";
import { useAuth } from "./context/AuthContext";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import { setLastModalClick } from "./utils/modalOrigin";


// Toastify
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Dashboard = lazy(() => import("./pages/admin/dashboard/Dashboard"));
const Missions = lazy(() => import("./pages/admin/Missions/Missions"));
const Operators = lazy(() => import("./pages/admin/Operators"));
const Clients = lazy(() => import("./pages/admin/Clients"));
const Transactions = lazy(() => import("./pages/admin/Transactions"));
const Withdrawals = lazy(() => import("./pages/admin/Withdrawals"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const SiteVitrine = lazy(() => import("./pages/admin/SiteVitrine"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));

function PageLoader() {
  return (
    <div className="flex min-h-64 items-center justify-center" role="status" aria-live="polite">
      <div className="text-center" style={{ color: "var(--muted)" }}>
        <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-slate-300 border-t-red-600" />
        <p className="font-medium">Chargement de la page…</p>
      </div>
    </div>
  );
}

function PrivateRoute({ children }) {
  
  const { status, token, user } = useAuth();
  const location = useLocation();

  if (status === "checking") {
    return (
      <div
        className="flex justify-center items-center h-screen text-lg"
        style={{ color: "var(--muted)" }}
      >
        Chargement...
      </div>
    );
  }
  if (status !== "authenticated" || !token) {
    return <Navigate to="/login" replace />;
  }

  const needsPasswordChange = !!user?.must_change_password;
  const isOnChangePassword = location.pathname === "/change-password";

  if (needsPasswordChange && !isOnChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  if (!needsPasswordChange && isOnChangePassword) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function Layout() {
  const { supported, permission, requestPermission, sendNotification } = usePushNotifications();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [requestedOilMissionId, setRequestedOilMissionId] = useState(null);
  const welcomeNotifiedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (supported && permission === "default") requestPermission();
  }, [supported, permission, requestPermission]);

  useEffect(() => {
    const handlePointer = (event) => setLastModalClick(event);
    document.addEventListener("pointerdown", handlePointer, true);
    return () => document.removeEventListener("pointerdown", handlePointer, true);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("sidebar-open", sidebarOpen);
    return () => document.body.classList.remove("sidebar-open");
  }, [sidebarOpen]);

  useEffect(() => {
    if (permission !== "granted") return;
    const flagKey = "ttm_welcome_notified";
    try {
      if (sessionStorage.getItem(flagKey)) return;
      sessionStorage.setItem(flagKey, "1");
    } catch {
      if (welcomeNotifiedRef.current) return;
      welcomeNotifiedRef.current = true;
    }
    sendNotification(" Tow Truck Mali", {
      body: "Bienvenue, administrateur ! Votre tableau de bord est bien opérationnel.",
      icon: "/logoApp.png",
    });
  }, [permission, sendNotification]);

  const handleOpenOilMissionDetail = (missionId) => {
    const id = Number(missionId);
    if (!Number.isFinite(id) || id <= 0) return;
    setRequestedOilMissionId(id);
    navigate("/dashboard");
  };

  return (
    <div
      className="layout-shell flex min-h-screen transition-all"
      style={{
        background: "var(--bg-main)",
        color: "var(--text-color)",
      }}
    >
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div
          className="sidebar-backdrop lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onOpenOilMissionDetail={handleOpenOilMissionDetail}
        />
        <main
          className="flex-1 p-6 overflow-y-auto transition-all"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-color)",
          }}
        >
          <Suspense fallback={<PageLoader />}>
            <Outlet
              context={{
                requestedOilMissionId,
                clearRequestedOilMission: () => setRequestedOilMissionId(null),
              }}
            />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />

        {/* Privé */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="missions" element={<Missions />} />
          <Route path="admins" element={<AdminUsers />} />   {/* ← relatif ! */}
          <Route path="operators" element={<Operators />} />
          <Route path="clients" element={<Clients />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="withdrawals" element={<Withdrawals />} />
          <Route path="settings" element={<Settings />} />
          <Route path="site-vitrine" element={<SiteVitrine />} />
        </Route>

        {/* Par défaut */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        pauseOnHover
        draggable
        theme="dark"
      />
    </Router>
  );
}
