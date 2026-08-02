import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function useRequireAuth(requiredRole) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return; // attendre fin du chargement

    if (!user) {
      // 🧭 mémorise la route courante pour redirection post-login
      navigate("/login", { state: { from: location.pathname } });
    } else if (requiredRole && user.role !== requiredRole) {
      navigate("/"); // mauvais rôle → retour accueil
    }
  }, [user, loading, requiredRole, navigate, location]);

  //  renvoie null tant qu’on charge (évite les rendus fantômes)
  if (loading) return null;

  return user;
}
