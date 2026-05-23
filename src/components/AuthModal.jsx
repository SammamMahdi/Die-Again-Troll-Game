import React, { useState } from 'react';
import { isCloudEnabled, registerUser, signInUser, signInWithGoogle } from '../firebase';
import './AuthModal.css';

function AuthModal({ initialMode = 'signin', onClose, onSuccess }) {
  const [mode, setMode] = useState(initialMode);  // 'signin' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cloud = isCloudEnabled();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!cloud) {
      setError('Cloud not configured. Paste your Firebase config in src/firebase/config.js.');
      return;
    }
    if (!email || !password || (mode === 'register' && !username.trim())) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      const user = mode === 'register'
        ? await registerUser({ email: email.trim(), password, username: username.trim() })
        : await signInUser({ email: email.trim(), password });
      onSuccess?.(user);
    } catch (err) {
      setError(prettyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const signInGoogle = async () => {
    setError('');
    if (!cloud) {
      setError('Cloud not configured. Paste your Firebase config in src/firebase/config.js.');
      return;
    }
    setBusy(true);
    try {
      const user = await signInWithGoogle();
      onSuccess?.(user);
    } catch (err) {
      setError(prettyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="auth-title">
          {mode === 'register' ? 'CREATE ACCOUNT' : 'SIGN IN'}
        </h2>

        {!cloud && (
          <div className="auth-warning">
            ⚠ Cloud accounts not configured. See <code>src/firebase/config.js</code>.
          </div>
        )}

        <button
          type="button"
          className="auth-google-btn"
          onClick={signInGoogle}
          disabled={busy || !cloud}
        >
          <svg className="auth-google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="#4285f4" d="M21.6 12.227c0-.709-.063-1.39-.18-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.23c1.89-1.74 2.983-4.305 2.983-7.351z"/>
            <path fill="#34a853" d="M12 22c2.7 0 4.964-.895 6.617-2.422l-3.23-2.51c-.895.6-2.04.955-3.387.955-2.605 0-4.81-1.76-5.598-4.123H3.077v2.59A9.997 9.997 0 0 0 12 22z"/>
            <path fill="#fbbc04" d="M6.402 13.9a6.005 6.005 0 0 1 0-3.8V7.51H3.077a10.003 10.003 0 0 0 0 8.98l3.325-2.59z"/>
            <path fill="#ea4335" d="M12 5.977c1.468 0 2.786.504 3.823 1.495l2.867-2.867C16.96 2.99 14.696 2 12 2 8.073 2 4.67 4.27 3.077 7.51l3.325 2.59C7.19 7.737 9.395 5.977 12 5.977z"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider"><span>or</span></div>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <label className="auth-field">
              <span>Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={busy || !cloud}
                placeholder="e.g. PhantomRunner"
                maxLength={24}
                autoComplete="username"
              />
            </label>
          )}
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy || !cloud}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy || !cloud}
              placeholder="at least 6 characters"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={busy || !cloud}>
            {busy ? 'Please wait…' : mode === 'register' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'register' ? (
            <>Already have an account? <button type="button" onClick={() => setMode('signin')}>Sign in</button></>
          ) : (
            <>New here? <button type="button" onClick={() => setMode('register')}>Create one</button></>
          )}
        </div>
      </div>
    </div>
  );
}

function prettyAuthError(err) {
  const code = err?.code || '';
  if (code === 'auth/invalid-email') return 'That email address looks invalid.';
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential')
    return 'Email or password is incorrect.';
  if (code === 'auth/operation-not-allowed')
    return 'This sign-in method is disabled. Enable it in the Firebase console.';
  if (code === 'auth/popup-closed-by-user') return 'Sign-in cancelled.';
  if (code === 'auth/popup-blocked')
    return 'Your browser blocked the sign-in popup. Allow popups and try again.';
  if (code === 'auth/unauthorized-domain')
    return 'This domain is not authorized for sign-in. Add it in Firebase → Authentication → Settings → Authorized domains.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection.';
  return err?.message || 'Something went wrong. Try again.';
}

export default AuthModal;
