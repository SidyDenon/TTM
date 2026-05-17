import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config/urls";
import towtow from "../assets/towtow.png";
import wallpaper from "../assets/wallpaper.jpg";

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
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 md:p-10 bg-center bg-cover bg-no-repeat"
      style={{ backgroundImage: `url(${wallpaper})` }}
    >
      <div className="w-full max-w-[1320px] min-h-[620px] rounded-2xl border border-white/30 bg-gradient-to-r from-fuchsia-500/55 via-purple-500/50 to-cyan-400/40 shadow-2xl backdrop-blur-md overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 h-[620px]">
          <div className="flex flex-col justify-center items-center lg:items-center px-7 sm:px-10 lg:px-12">
            <h1 className="text-4xl xl:text-[32px] font-black text-white text-center tracking-tight leading-none">
              {step === 1 ? "Mot de passe oublié" : "Nouveau mot de passe"}
            </h1>

            <p className="mt-3 text-white/80 text-sm lg:text-[14px] text-center max-w-[520px]">
              {step === 1
                ? "Entrez votre email ou téléphone pour recevoir un code de réinitialisation"
                : "Renseignez le code reçu et définissez votre nouveau mot de passe"}
            </p>

            {message && (
              <div
                className={`mt-5 w-full max-w-[400px] rounded-xl px-4 py-3 text-sm border ${
                  message.startsWith("✅")
                    ? "bg-green-500/20 border-green-200/50 text-white"
                    : "bg-red-500/20 border-red-200/50 text-white"
                }`}
              >
                {message}
              </div>
            )}

            {step === 1 && (
              <div className="mt-8 space-y-5 max-w-[400px] w-full">
                <div>
                  <label className="block text-lg sm:text-xl lg:text-[14px] text-white/75 mb-2 leading-none">
                    Email ou téléphone
                  </label>
                  <input
                    className="w-full h-14 rounded-2xl border-[3px] border-white/80 focus:border-white px-5 bg-transparent text-white text-lg lg:text-[22px] outline-none"
                    placeholder=""
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>

                <button
                  onClick={requestCode}
                  disabled={loading}
                  className={`w-full h-14 rounded-2xl bg-white text-black text-2xl lg:text-[18px] font-extrabold transition ${
                    loading ? "opacity-70 cursor-not-allowed" : "hover:bg-white/90"
                  }`}
                >
                  {loading ? "Envoi..." : "Envoyer le code"}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="w-full text-right text-white/90 font-semibold text-2xl lg:text-[15px] leading-none hover:opacity-90"
                >
                  Retour connexion
                </button>
              </div>
            )}

            {step === 2 && (
              <form onSubmit={submitReset} className="mt-8 space-y-5 max-w-[400px] w-full">
                <div>
                  <label className="block text-lg sm:text-xl lg:text-[14px] text-white/75 mb-2 leading-none">
                    Code reçu
                  </label>
                  <input
                    className="w-full h-14 rounded-2xl border-[3px] border-white/80 focus:border-white px-5 bg-transparent text-white text-lg lg:text-[22px] outline-none"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder=""
                    required
                  />
                </div>

                <div>
                  <label className="block text-lg sm:text-xl lg:text-[14px] text-white/75 mb-2 leading-none">
                    Nouveau mot de passe
                  </label>
                  <input
                    className="w-full h-14 rounded-2xl border-[3px] border-white/80 focus:border-white px-5 bg-transparent text-white text-lg lg:text-[22px] outline-none"
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder=""
                    required
                  />
                </div>

                <div>
                  <label className="block text-lg sm:text-xl lg:text-[14px] text-white/75 mb-2 leading-none">
                    Confirmer le mot de passe
                  </label>
                  <input
                    className="w-full h-14 rounded-2xl border-[3px] border-white/80 focus:border-white px-5 bg-transparent text-white text-lg lg:text-[22px] outline-none"
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder=""
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full h-14 rounded-2xl bg-white text-black text-2xl lg:text-[18px] font-extrabold transition ${
                    loading ? "opacity-70 cursor-not-allowed" : "hover:bg-white/90"
                  }`}
                >
                  {loading ? "Mise à jour..." : "Changer le mot de passe"}
                </button>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="text-white/90 font-semibold text-2xl lg:text-[15px] leading-none hover:opacity-90"
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

                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="text-white/90 font-semibold text-2xl lg:text-[15px] leading-none hover:opacity-90"
                  >
                    Retour connexion
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="hidden lg:flex flex-col items-center justify-left p-8  ">
            <h2 className="text-white text-[32px] font-extrabold text-center leading-tight px-6 py-0 mt-25  rounded-3xl relative left-[-100px] tracking-wide" >
              Bienvenue
              <br />
              Tow Truck Mali
            </h2>

            <div className="flex justify-center mt-5 relative">
               <div className=" w-[330px] h-[330px] rounded-full bg-white/35 absolute t-10 left-10 ">
              </div>
              <img
                src={towtow}
                alt="Tow Truck"
                className="w-[580px] max-w-none object-contain z-10 rotate-[-5deg] right-[-20px] relative"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
