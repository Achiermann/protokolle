'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import '../../styles/login.css';

export default function LoginForm() {
  // *** VARIABLES ***
  const router = useRouter();
  const searchParams = useSearchParams();
  const isResetMode = searchParams.get('reset') === 'true';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState(isResetMode ? 'update-password' : 'login');

  // *** FUNCTIONS/HANDLERS ***
  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Registrierung fehlgeschlagen');
      }

      // If email confirmation is required, Supabase won't auto-login
      if (data.user?.identities?.length === 0) {
        toast.error('Ein Konto mit dieser E-Mail existiert bereits');
        return;
      }

      if (data.user?.confirmed_at || data.user?.email_confirmed_at) {
        toast.success('Konto erstellt – du wirst angemeldet');
        router.push('/workspace');
      } else {
        toast.success('Bestätigungslink wurde an deine E-Mail gesendet');
        setView('login');
      }
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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Anmeldung fehlgeschlagen');
      }

      toast.success('Erfolgreich angemeldet');
      router.push('/workspace');
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
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Passwort-Reset fehlgeschlagen');
      }

      toast.success('Reset-Link wurde an deine E-Mail gesendet');
      setView('login');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Passwort-Update fehlgeschlagen');
      }

      toast.success('Passwort erfolgreich aktualisiert');
      router.push('/workspace');
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

        {view === 'login' && (
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

            <button type="submit" className="primary login-submit" disabled={loading}>
              {loading ? 'Anmelden...' : 'Anmelden'}
            </button>

            <div className="login-links">
              <button
                type="button"
                className="login-link-button"
                onClick={() => setView('reset')}
              >
                Passwort vergessen?
              </button>
              <button
                type="button"
                className="login-link-button"
                onClick={() => setView('signup')}
              >
                Konto erstellen
              </button>
            </div>
          </form>
        )}

        {view === 'signup' && (
          <form className="login-form" onSubmit={handleSignup}>
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

            <button type="submit" className="primary login-submit" disabled={loading}>
              {loading ? 'Wird erstellt...' : 'Konto erstellen'}
            </button>

            <button
              type="button"
              className="login-link-button"
              onClick={() => setView('login')}
            >
              Bereits ein Konto? Anmelden
            </button>
          </form>
        )}

        {view === 'reset' && (
          <form className="login-form" onSubmit={handleResetRequest}>
            <p className="login-description">
              Gib deine E-Mail-Adresse ein, um einen Reset-Link zu erhalten.
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

            <button type="submit" className="primary login-submit" disabled={loading}>
              {loading ? 'Wird gesendet...' : 'Reset-Link senden'}
            </button>

            <button
              type="button"
              className="login-link-button"
              onClick={() => setView('login')}
            >
              Zurück zur Anmeldung
            </button>
          </form>
        )}

        {view === 'update-password' && (
          <form className="login-form" onSubmit={handleUpdatePassword}>
            <p className="login-description">
              Gib dein neues Passwort ein.
            </p>

            <div className="login-field">
              <label htmlFor="new-password">Neues Passwort</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                minLength={8}
                required
              />
            </div>

            <button type="submit" className="primary login-submit" disabled={loading}>
              {loading ? 'Wird gespeichert...' : 'Passwort speichern'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
