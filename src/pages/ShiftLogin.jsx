import shiftLogo from '../assets/shift.ico';
import React, { useState, useContext } from "react";
import { ShiftAuthContext } from "@/lib/useShiftAuth";
import { User, Lock, Loader2, X, Copy, Check, KeyRound, ArrowLeft, Eye, EyeOff } from "lucide-react";

// Champ mot de passe avec bouton oeil pour afficher/masquer la saisie.
// L'état "visible" est local à chaque instance, donc chaque champ (mot de
// passe, confirmation...) a son propre bouton indépendant.
function PasswordInput({ value, onChange, placeholder, required, autoFocus }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-[var(--bg-tertiary)] text-white pl-10 pr-10 py-3 rounded-lg border border-transparent focus:border-[#5865f2] focus:outline-none transition text-sm"
        required={required}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white transition"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function ShiftLogin() {
  const {
    checkAccountExists,
    registerAccount,
    completeSignup,
    loginWithPassword,
    resetPasswordWithCode,
  } = useContext(ShiftAuthContext);

  // "username" | "password" (returning user) | "forgotCode" (reset via code) |
  // "resetSuccess" (new code shown after a successful reset) |
  // "setPassword" (new user) | "recoveryCode" (new user, code shown once) |
  // "displayName" (new user)
  const [step, setStep] = useState("username");
  const [username, setUsername] = useState("");
  const [password, setPasswordValue] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Code de récupération affiché une seule fois à l'inscription.
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState("");
  const [recoveryCodeSaved, setRecoveryCodeSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Formulaire "mot de passe oublié".
  const [recoveryCodeInput, setRecoveryCodeInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  // Nouveau code renvoyé après un reset réussi (l'ancien est invalidé).
  const [freshRecoveryCode, setFreshRecoveryCode] = useState("");

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
      const { recoveryCode } = await registerAccount(username, password);
      setGeneratedRecoveryCode(recoveryCode || "");
      setStep("recoveryCode");
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

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== newPasswordConfirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const { newRecoveryCode } = await resetPasswordWithCode(username, recoveryCodeInput, newPassword);
      setFreshRecoveryCode(newRecoveryCode || "");
      setStep("resetSuccess");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyRecoveryCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("ShiftLogin: échec de la copie du code", err);
    }
  };

  const restart = () => {
    setStep("username");
    setPasswordValue("");
    setPasswordConfirm("");
    setDisplayName("");
    setError("");
    setGeneratedRecoveryCode("");
    setRecoveryCodeSaved(false);
    setRecoveryCodeInput("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setFreshRecoveryCode("");
  };

  const goToForgotPassword = () => {
    setError("");
    setRecoveryCodeInput("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setStep("forgotCode");
  };

  const backToPasswordAfterReset = () => {
    setPasswordValue("");
    setError("");
    setStep("password");
  };

  const titles = {
    username: "Bon retour !",
    password: "Entre ton mot de passe",
    forgotCode: "Réinitialiser ton mot de passe",
    resetSuccess: "Mot de passe changé !",
    setPassword: "Choisis un mot de passe",
    recoveryCode: "Garde bien ce code",
    displayName: "Choisis ton nom",
  };

  const subtitles = {
    username: "Connecte-toi ou inscris-toi avec un nom d'utilisateur",
    password: `Connecte-toi en tant que ${username}`,
    forgotCode: `Entre le code de récupération de ${username} et un nouveau mot de passe`,
    resetSuccess: "Ton nouveau code de récupération est ci-dessous",
    setPassword: "Ce mot de passe te servira pour tes prochaines connexions",
    recoveryCode: "C'est le seul moyen de récupérer ton compte si tu oublies ton mot de passe. Il ne sera plus jamais affiché.",
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
              <PasswordInput
                value={password}
                onChange={(e) => setPasswordValue(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
              />
              <div className="text-right mt-2">
                <button
                  type="button"
                  onClick={goToForgotPassword}
                  className="text-xs text-[var(--text-muted)] hover:text-[#5865f2] transition"
                >
                  Mot de passe oublié ?
                </button>
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

        {step === "forgotCode" && (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wide mb-2">
                Code de récupération
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={recoveryCodeInput}
                  onChange={(e) => setRecoveryCodeInput(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="w-full bg-[var(--bg-tertiary)] text-white pl-10 pr-4 py-3 rounded-lg border border-transparent focus:border-[#5865f2] focus:outline-none transition text-sm font-mono tracking-wide"
                  required
                  autoFocus
                />
              </div>
              <p className="text-[var(--text-muted)] text-xs mt-1.5">
                Le code qu'on t'a donné à l'inscription. Sans lui, impossible de récupérer le compte.
              </p>
            </div>

            <div>
              <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wide mb-2">
                Nouveau mot de passe
              </label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Au moins 6 caractères"
                required
              />
            </div>
            <div>
              <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wide mb-2">
                Confirme le nouveau mot de passe
              </label>
              <PasswordInput
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                placeholder="Retape le mot de passe"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || newPassword.length < 6 || !newPasswordConfirm || recoveryCodeInput.length < 8}
              className="w-full bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Réinitialisation...
                </>
              ) : (
                "Réinitialiser le mot de passe"
              )}
            </button>

            <button
              type="button"
              onClick={() => { setError(""); setStep("password"); }}
              className="w-full text-[var(--text-muted)] hover:text-white text-sm text-center transition flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Retour
            </button>
          </form>
        )}

        {step === "resetSuccess" && (
          <div className="space-y-4">
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-[#5865f2]/40">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-white text-base tracking-wide break-all">
                  {freshRecoveryCode}
                </span>
                <button
                  type="button"
                  onClick={() => copyRecoveryCode(freshRecoveryCode)}
                  title="Copier"
                  className="p-2 rounded-md hover:bg-white/10 transition flex-shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-[var(--text-muted)]" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-[var(--text-muted)] text-xs text-center">
              L'ancien code ne fonctionne plus. Note bien celui-ci quelque part de sûr.
            </p>

            <button
              type="button"
              onClick={backToPasswordAfterReset}
              className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold py-3 rounded-lg transition mt-2"
            >
              Se connecter
            </button>
          </div>
        )}

        {step === "setPassword" && (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wide mb-2">
                Mot de passe
              </label>
              <PasswordInput
                value={password}
                onChange={(e) => setPasswordValue(e.target.value)}
                placeholder="Au moins 6 caractères"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wide mb-2">
                Confirme le mot de passe
              </label>
              <PasswordInput
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="Retape le mot de passe"
                required
              />
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

        {step === "recoveryCode" && (
          <div className="space-y-4">
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-[#5865f2]/40">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-white text-base tracking-wide break-all">
                  {generatedRecoveryCode}
                </span>
                <button
                  type="button"
                  onClick={() => copyRecoveryCode(generatedRecoveryCode)}
                  title="Copier"
                  className="p-2 rounded-md hover:bg-white/10 transition flex-shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-[var(--text-muted)]" />
                  )}
                </button>
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={recoveryCodeSaved}
                onChange={(e) => setRecoveryCodeSaved(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#5865f2]"
              />
              J'ai noté mon code de récupération quelque part de sûr.
            </label>

            <button
              type="button"
              onClick={() => setStep("displayName")}
              disabled={!recoveryCodeSaved}
              className="w-full bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition mt-2"
            >
              Continuer
            </button>
          </div>
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
