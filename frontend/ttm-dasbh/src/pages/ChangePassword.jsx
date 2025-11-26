import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config/urls";

export default function ChangePassword() {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const requestCode = async () => {
    if (!identifier.trim()) {
      setMessage("❌ Merci d'indiquer un email ou un téléphone.");
      return;
    }
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Erreur serveur");
      setMessage("✅ Code envoyé ! Consultez votre boite mail/SMS.");
      setStep(2);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setMessage("❌ Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          code: code.trim(),
          newPassword: newPwd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Erreur serveur");
      setMessage("✅ Mot de passe mis à jour ! Redirection en cours...");
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md border border-gray-200">
        <h1 className="text-2xl font-bold text-center text-red-600 mb-2">
          Réinitialiser le mot de passe
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Entrez votre email ou votre téléphone pour recevoir un code de réinitialisation.
        </p>

        {message && (
          <div
            className={`p-2 text-sm mb-4 rounded ${
              message.startsWith("✅")
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        {step === 1 && (
          <>
            <label className="block text-sm text-gray-600 mb-1">Email ou téléphone</label>
            <input
              className="w-full border rounded px-3 py-2 mb-4 focus:outline-red-600"
              placeholder="ex. admin@site.com ou +223xxxxxxx"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
            <button
              onClick={requestCode}
              disabled={loading}
              className={`w-full py-2 rounded text-white transition ${
                loading ? "bg-red-400" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {loading ? "Envoi..." : "Envoyer le code"}
            </button>
          </>
        )}

        {step === 2 && (
          <form onSubmit={submitReset} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Code reçu</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code de 6 chiffres"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nouveau mot de passe</label>
              <input
                className="w-full border rounded px-3 py-2"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Confirmer le mot de passe</label>
              <input
                className="w-full border rounded px-3 py-2"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 rounded text-white transition ${
                loading ? "bg-red-400" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {loading ? "Mise à jour..." : "Changer le mot de passe"}
            </button>
          </form>
        )}

        {step === 2 && (
          <button
            type="button"
            className="text-xs text-red-600 underline mt-4"
            onClick={() => {
              setStep(1);
              setCode("");
              setNewPwd("");
              setConfirmPwd("");
              setMessage("");
            }}
          >
            Réenvoyer un code
          </button>
        )}
      </div>
    </div>
  );
}
