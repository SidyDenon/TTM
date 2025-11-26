// src/App.jsx
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import usePushNotifications from "./hooks/usePushNotifications";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";

import Dashboard from "./pages/admin/dashboard/Dashboard";
import Missions from "./pages/admin/Missions/Missions";
import Operators from "./pages/admin/Operators";
import Clients from "./pages/admin/Clients";
import Transactions from "./pages/admin/Transactions";
import Withdrawals from "./pages/admin/Withdrawals";
import Settings from "./pages/admin/Settings";
import AdminUsers from "./pages/admin/AdminUsers";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";

// Toastify
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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

  useEffect(() => {
    if (supported && permission === "default") requestPermission();
  }, [supported, permission, requestPermission]);

  useEffect(() => {
    if (permission === "granted") {
      sendNotification("🚀 Tow Truck Mali", {
        body: "Bienvenue, administrateur ! Votre tableau de bord est bien opérationnel.",
        icon: "/vite.svg",
      });
    }
  }, [permission, sendNotification]);

  return (
    <div
      className="flex min-h-screen transition-all"
      style={{
        background: "var(--bg-main)",
        color: "var(--text-color)",
      }}
    >
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main
          className="flex-1 p-6 overflow-y-auto transition-all"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-color)",
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
