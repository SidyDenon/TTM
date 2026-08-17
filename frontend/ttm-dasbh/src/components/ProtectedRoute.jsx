import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { can, isSuper } from "../utils/rbac";

/**
 * Usage :
 * <ProtectedRoute perm="requests_view"> <RequestsPage /> </ProtectedRoute>
 * ou
 * <ProtectedRoute permAny={["withdrawals_view","transactions_view"]}> … </ProtectedRoute>
 */
export default function ProtectedRoute({ children, perm, permAny, superOnly }) {
  const { user } = useAuth();

  //  Pas connecté
  if (!user) return <Navigate to="/login" replace />;

  // 🦸 Super admin : passe partout
  if (isSuper(user)) return children;

  // 🔒 Page réservée uniquement aux super-admins
  if (superOnly) return <Navigate to="/403" replace />;

  //  Permission unique
  if (perm && !can(user, perm)) return <Navigate to="/403" replace />;

  //  Une parmi plusieurs permissions possibles
  if (permAny && !permAny.some((key) => can(user, key))) return <Navigate to="/403" replace />;

  //  Autorisé
  return children;
}
