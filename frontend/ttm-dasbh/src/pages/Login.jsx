import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import towtow from "../assets/towtow.png";
import wallpaper from "../assets/wallpaper.jpg";

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
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 md:p-10 bg-center bg-cover bg-no-repeat"
      style={{ backgroundImage: `url(${wallpaper})` }}
    >
      <div className="w-full max-w-[1320px] min-h-[620px] rounded-2xl border border-white/30 bg-gradient-to-r from-fuchsia-500/55 via-purple-500/50 to-cyan-400/40 shadow-2xl backdrop-blur-md overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 h-[620px]">
          <div className=" flex flex-col justify-center items-center lg:items-center">
            <h1 className="text-4xl xl:text-[32px] font-black text-white text-center lg:text-left tracking-tight leading-none">
              Connexion Admin
            </h1>

            {error && (
              <div className="mt-6 rounded-xl bg-red-500/20 border border-red-200/60 text-white px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5 max-w-[400px] w-full">
              <div>
                <label className="block text-lg sm:text-xl lg:text-[14px] text-white/75 mb-2 leading-none">
                  Email ou téléphone
                </label>
                <input
                  className="w-full h-14 rounded-2xl border-[3px] border-white/80 focus:border-white px-5 bg-transparent text-white text-lg lg:text-[22px] outline-none"
                  placeholder=""
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-lg sm:text-xl lg:text-[14px] text-white/75 mb-2 leading-none">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    className="w-full h-14 rounded-2xl border-[3px] border-white/80 focus:border-white px-5 pr-14 bg-transparent text-white text-lg lg:text-[22px] outline-none"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder=""
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white"
                    aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/change-password")}
                className="w-full text-right text-white font-semibold text-2xl lg:text-[15px] leading-none hover:opacity-90"
              >
                Mot de passe oublié ?
              </button>

              <button
                type="submit"
                disabled={loading}
                className={`w-full h-14 rounded-2xl bg-white text-black text-2xl lg:text-[18px] font-extrabold transition ${
                  loading ? "opacity-70 cursor-not-allowed" : "hover:bg-white/90"
                }`}
              >
                {loading ? "Connexion..." : "Se Connecter"}
              </button>
            </form>
          </div>
          <div className="hidden lg:flex flex-col items-center justify-left p-8  ">
            <h2 className="text-white text-[32px] font-extrabold text-center leading-tight px-6 py-0 mt-25  rounded-3xl relative left-[-100px] tracking-wide" >
              Bienvenue
              <br />
              Tow Truck Mali
            </h2>

            <div className="flex justify-center alignItems-center mt-5 relative">
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
