import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { initApiBase } from "./config/urls";
import "./index.css";
import AppErrorBoundary from "./components/AppErrorBoundary";

// Initialise l’API avant de monter React
(async () => {
  try {
    await initApiBase();
  } catch (err) {
    console.warn(" initApiBase a échoué, fallback PROD :", err);
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <AuthProvider>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </AuthProvider>
    </React.StrictMode>
  );
})();
