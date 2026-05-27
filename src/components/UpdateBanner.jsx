import React, { useEffect, useState } from 'react';
import {
  checkForUpdate, dismissUpdate, openReleasePage,
} from '../utils/updateCheck';
import './UpdateBanner.css';

// Top-of-screen banner that appears on the desktop app when a newer
// GitHub Release is available. Click → opens the release page in the
// default browser. Dismiss → hides for THIS version (next version still
// triggers it). Web users get updates automatically via Vercel so the
// banner is intentionally a no-op there.
function UpdateBanner() {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Tiny delay so the banner doesn't race the rest of the app's
    // first render — players see the start screen first, then the
    // banner fades in if applicable.
    const t = setTimeout(() => {
      checkForUpdate().then((result) => {
        if (!cancelled && result) setInfo(result);
      });
    }, 800);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  if (!info) return null;

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try { await openReleasePage(info.htmlUrl); }
    finally { setBusy(false); }
  };

  const handleDismiss = () => {
    dismissUpdate(info.latestTag);
    setInfo(null);
  };

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span className="update-banner-icon" aria-hidden="true">✨</span>
      <span className="update-banner-text">
        <strong>{info.latestTag}</strong> is available.
      </span>
      <button className="update-banner-btn" onClick={handleDownload} disabled={busy}>
        {busy ? 'Opening…' : 'Download update'}
      </button>
      <button className="update-banner-dismiss" onClick={handleDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

export default UpdateBanner;
