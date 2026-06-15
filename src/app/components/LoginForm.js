"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuthStore } from "../stores/useAuthStore";
import "../../styles/login.css";

export default function LoginForm() {
  // *** VARIABLES ***
  const router = useRouter();

  const signup = useAuthStore((state) => state.signup);
  const login = useAuthStore((state) => state.login);
  const requestPasswordReset = useAuthStore(
    (state) => state.requestPasswordReset,
  );
  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const updatePassword = useAuthStore((state) => state.updatePassword);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("login");

  // *** FUNCTIONS/HANDLERS ***
  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signup({ email, password, name });
      toast.success("Wir haben dir einen Bestätigungscode geschickt");
      setCode("");
      setView("verify-signup");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await verifyOtp({ email, token: code.trim(), type: "signup" });
      toast.success("E-Mail bestätigt – du wirst angemeldet");
      router.push("/workspace");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login({ email, password });
      toast.success("Erfolgreich angemeldet");
      router.push("/workspace");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await requestPasswordReset(email);
      toast.success("Wenn ein Konto existiert, wurde ein Code gesendet");
      setCode("");
      setNewPassword("");
      setView("verify-reset");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyReset = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await verifyOtp({ email, token: code.trim(), type: "recovery" });
      await updatePassword(newPassword);
      toast.success("Passwort erfolgreich aktualisiert");
      router.push("/workspace");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container card">
        <h1 className="login-title">Protokoll App</h1>

        {view === "login" && (
          <form className="login-form" onSubmit={handleLogin}>
            <div className="login-field">
              <label htmlFor="email">E-Mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@beispiel.ch"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Passwort</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passwort eingeben"
                required
              />
            </div>

            <button
              type="submit"
              className="primary login-submit"
              disabled={loading}
            >
              {loading ? "Anmelden..." : "Anmelden"}
            </button>

            <div className="login-links">
              <button
                type="button"
                className="login-link-button"
                onClick={() => setView("reset")}
              >
                Passwort vergessen?
              </button>
              <button
                type="button"
                className="login-link-button"
                onClick={() => setView("signup")}
              >
                Konto erstellen
              </button>
            </div>
          </form>
        )}

        {view === "signup" && (
          <form className="login-form" onSubmit={handleSignup}>
            <div className="login-field">
              <label htmlFor="signup-name">Name</label>
              <input
                id="signup-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vor- und Nachname"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="signup-email">E-Mail</label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@beispiel.ch"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="signup-password">Passwort</label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                minLength={8}
                required
              />
            </div>

            <button
              type="submit"
              className="primary login-submit"
              disabled={loading}
            >
              {loading ? "Wird erstellt..." : "Konto erstellen"}
            </button>

            <button
              type="button"
              className="login-link-button"
              onClick={() => setView("login")}
            >
              Bereits ein Konto? Anmelden
            </button>
          </form>
        )}

        {view === "verify-signup" && (
          <form className="login-form" onSubmit={handleVerifySignup}>
            <p className="login-description">
              Gib den 6-stelligen Code ein, den wir an {email} gesendet haben.
            </p>

            <div className="login-field">
              <label htmlFor="signup-code">Bestätigungscode</label>
              <input
                id="signup-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                required
              />
            </div>

            <button
              type="submit"
              className="primary login-submit"
              disabled={loading}
            >
              {loading ? "Wird geprüft..." : "Bestätigen"}
            </button>

            <button
              type="button"
              className="login-link-button"
              onClick={() => setView("login")}
            >
              Zurück zur Anmeldung
            </button>
          </form>
        )}

        {view === "reset" && (
          <form className="login-form" onSubmit={handleResetRequest}>
            <p className="login-description">
              Gib deine E-Mail-Adresse ein, um einen Code zu erhalten.
            </p>

            <div className="login-field">
              <label htmlFor="reset-email">E-Mail</label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@beispiel.ch"
                required
              />
            </div>

            <button
              type="submit"
              className="primary login-submit"
              disabled={loading}
            >
              {loading ? "Wird gesendet..." : "Code senden"}
            </button>

            <button
              type="button"
              className="login-link-button"
              onClick={() => setView("login")}
            >
              Zurück zur Anmeldung
            </button>
          </form>
        )}

        {view === "verify-reset" && (
          <form className="login-form" onSubmit={handleVerifyReset}>
            <p className="login-description">
              Gib den Code aus der E-Mail und dein neues Passwort ein.
            </p>

            <div className="login-field">
              <label htmlFor="reset-code">Code</label>
              <input
                id="reset-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="reset-new-password">Neues Passwort</label>
              <input
                id="reset-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                minLength={8}
                required
              />
            </div>

            <button
              type="submit"
              className="primary login-submit"
              disabled={loading}
            >
              {loading ? "Wird gespeichert..." : "Passwort speichern"}
            </button>

            <button
              type="button"
              className="login-link-button"
              onClick={() => setView("login")}
            >
              Zurück zur Anmeldung
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
