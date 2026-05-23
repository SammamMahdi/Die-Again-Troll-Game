import React, { useEffect, useState } from 'react';
import './AdminBadge.css';

function AdminBadge({ currentScreen, onDisable }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      // Backtick toggles the visibility of the badge
      if (e.key === '`' || e.key === '~') setCollapsed(prev => !prev);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const levelLabel = currentScreen?.startsWith('level')
    ? `On: ${currentScreen.toUpperCase()}`
    : `On: ${currentScreen ?? '—'}`;

  return (
    <div className={`admin-badge ${collapsed ? 'admin-badge-collapsed' : ''}`}>
      <div className="admin-badge-row">
        <span className="admin-badge-dot" />
        <span className="admin-badge-title">ADMIN</span>
      </div>
      {!collapsed && (
        <>
          <div className="admin-badge-row admin-badge-info">{levelLabel}</div>
          <div className="admin-badge-keys">
            <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>
            <span className="admin-badge-keys-label">jump level</span>
          </div>
          <div className="admin-badge-row">
            <kbd>`</kbd>
            <span className="admin-badge-keys-label">hide badge</span>
          </div>
          <button className="admin-badge-disable" onClick={onDisable}>Exit admin</button>
        </>
      )}
    </div>
  );
}

export default AdminBadge;
