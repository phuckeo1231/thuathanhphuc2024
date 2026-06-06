import { useState } from 'react';

export default function AlertBanner({ alert }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const time = new Date(alert.timestamp).toLocaleTimeString('vi-VN');

  return (
    <div className={`alert-banner alert-${alert.level}`}>
      <div className="alert-content">
        <strong>{alert.walletLabel || `${alert.walletAddr?.slice(0, 8)}…`}</strong>
        {' — '}
        {alert.token && <span className="alert-token">{alert.token} </span>}
        {alert.message}
        <span className="alert-time">{time}</span>
      </div>
      <button className="alert-dismiss" onClick={() => setDismissed(true)} aria-label="Đóng">×</button>
    </div>
  );
}
