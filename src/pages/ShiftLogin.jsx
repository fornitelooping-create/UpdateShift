import shiftLogo from '../assets/shift.ico';
import React, { useState, useContext } from "react";
import { ShiftAuthContext } from "@/lib/useShiftAuth";
import { User, Lock, Loader2, X } from "lucide-react";

export default function ShiftLogin() {
  const {
    checkAccountExists,
    registerAccount,
    completeSignup,
    loginWithPassword,
  } = useContext(ShiftAuthContext);

  // "username" | "password" (returning user) | "setPassword" (new user) | "displayName" (new user)
  const [step, setStep] = useState("username");
  const [username, setUsername] = useState("");
  const [password, setPasswordValue] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const exists = await checkAccountExists(username);
      setStep(exists ? "password" : "setPassword");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginWithPassword(username, password);
      // Success: App will re-render once `user` is set by the context.
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== passwordConfirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await registerAccount(username, password);
      setStep("displayName");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSignup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await completeSignup(username, displayName);
      // Success: App will re-render once `user` is set by the context.
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const restart = () => {
    setStep("username");
    setPasswordValue("");
    setPasswordConfirm("");
    setDisplayName("");
    setError("");
  };

  const titles = {
    username: "Bon retour !",
    password: "Entre ton mot de passe",
    setPassword: "Choisis un mot de passe",
    displayName: "Choisis ton nom",
  };

  const subtitles = {
    username: "Connecte-toi ou inscris-toi avec un nom d'utilisateur",
    password: `Connecte-toi en tant que ${username}`,
    setPassword: "Ce mot de passe te servira pour tes prochaines connexions",
    displayName: "Dernière étape avant de rejoindre Shift",
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[var(--border-default)] rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src={shiftLogo}
            alt="Shift"
            className="w-16 h-16 mb-3 object-contain"
          />
          <h1 className="text-white text-2xl font-bold">{titles[step]}</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1 text-center">{subtitles[step]}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm border border-red-500/30 flex items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              title="Fermer"
              className="p-0.5 rounded hover:bg-red-500/20 transition flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === "username" && (
          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <div>
              <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wide mb-2">
                Nom d'utilisateur
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="tonpseudo"
                  className="w-full bg-[var(--bg-tertiary)] text-white pl-10 pr-4 py-3 rounded-lg border border-transparent focus:border-[#5865f2] focus:outline-none transition text-sm"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || username.length < 3}
              className="w-full bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Vérification...
                </>
              ) : (
                "Continuer"
              )}
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wide mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[var(--bg-tertiary)] text-white pl-10 pr-4 py-3 rounded-lg border border-transparent focus:border-[#5865f2] focus:outline-none transition text-sm"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </button>

            <button
              type="button"
              onClick={restart}
              className="w-full text-[var(--text-muted)] hover:text-white text-sm text-center transition"
            >
              Changer de nom d'utilisateur
            </button>
          </form>
        )}

        {step === "setPassword" && (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wide mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  placeholder="Au moins 6 caractères"
                  className="w-full bg-[var(--bg-tertiary)] text-white pl-10 pr-4 py-3 rounded-lg border border-transparent focus:border-[#5865f2] focus:outline-none transition text-sm"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wide mb-2">
                Confirme le mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Retape le mot de passe"
                  className="w-full bg-[var(--bg-tertiary)] text-white pl-10 pr-4 py-3 rounded-lg border border-transparent focus:border-[#5865f2] focus:outline-none transition text-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || password.length < 6 || !passwordConfirm}
              className="w-full bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création...
                </>
              ) : (
                "Continuer"
              )}
            </button>

            <button
              type="button"
              onClick={restart}
              className="w-full text-[var(--text-muted)] hover:text-white text-sm text-center transition"
            >
              Changer de nom d'utilisateur
            </button>
          </form>
        )}

        {step === "displayName" && (
          <form onSubmit={handleCompleteSignup} className="space-y-4">
            <div>
              <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wide mb-2">
                Nom d'affichage
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Comment on t'appelle ?"
                  className="w-full bg-[var(--bg-tertiary)] text-white pl-10 pr-4 py-3 rounded-lg border border-transparent focus:border-[#5865f2] focus:outline-none transition text-sm"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création...
                </>
              ) : (
                "Rejoindre Shift"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
