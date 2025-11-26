import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(identifier.trim(), password);
      if (result?.must_change_password) {
        navigate("/change-password", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Impossible de se connecter");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white shadow-xl rounded-2xl p-8">
          <h1 className="text-3xl font-extrabold text-center text-red-600 tracking-tight">
            Connexion Admin
          </h1>
          <p className="text-center text-gray-500 mt-1 mb-6">
            Entrez vos identifiants pour accéder au panneau d’administration
          </p>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Email ou téléphone
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 px-3 py-2 bg-gray-50"
                placeholder="ex. admin@site.com ou +223xxxxxxxx"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  className="w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 px-3 py-2 pr-10 bg-gray-50"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                  aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-lg bg-red-600 text-white py-2.5 font-medium flex items-center justify-center gap-2 transition 
                ${loading ? "opacity-70 cursor-not-allowed" : "hover:bg-red-700"}`}
            >
              <LogIn size={18} />
              {loading ? "Connexion..." : "Se connecter"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/change-password")}
              className="text-sm text-red-600 hover:text-red-700 underline w-full text-center"
            >
              Mot de passe oublié ?
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-500">
            En cas d’oubli de mot de passe, contactez un super administrateur.
          </p>
        </div>
      </div>
    </div>
  );
}
