import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useMonitor } from '../context/MonitorContext.jsx';

const BUCKET_MS = 60 * 60 * 1000;  // 1 giờ / cột
const N_BUCKETS = 24;               // 24 cột = 24 giờ

/* ── Helpers ─────────────────────────────────────────────── */
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10)   return 'vừa nay';
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}ph`;
  return `${Math.floor(s / 3600)}h`;
}

/* ── Popup thông tin ví ──────────────────────────────────── */
function WalletInfoModal({ walletAddr, walletLabel, wallets, balances, recentChanges, onClose }) {
  const wallet = wallets.find(w => w.address === walletAddr);
  const label  = wallet?.label || walletLabel || `${walletAddr?.slice(0, 8)}…`;

  const walletBalances = useMemo(() =>
    Object.entries(balances)
      .filter(([key]) => key.startsWith(walletAddr + ':'))
      .map(([key, val]) => ({ token: key.split(':')[1], amount: parseFloat(val) || 0 }))
      .filter(b => b.amount > 0)
      .sort((a, b) => b.amount - a.amount),
  [balances, walletAddr]);

  const recentActivity = useMemo(() =>
    recentChanges.filter(c => c.wallet?.address === walletAddr).slice(0, 5),
  [recentChanges, walletAddr]);

  const shortAddr = walletAddr ? `${walletAddr.slice(0, 6)}…${walletAddr.slice(-4)}` : '?';

  const [copied, setCopied] = useState(false);
  const copyAddr = () => {
    if (!walletAddr) return;
    navigator.clipboard.writeText(walletAddr).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="wi-overlay" onClick={onClose}>
      <div className="wi-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="wi-header">
          {wallet?.logo && <span className="wi-logo">{wallet.logo}</span>}
          <div className="wi-title-group">
            <span className="wi-label">{label}</span>
            {wallet?.category && <span className="wi-category">{wallet.category}</span>}
          </div>
          <button className="wi-close" onClick={onClose}>✕</button>
        </div>

        {/* Địa chỉ */}
        <div className="wi-address-row">
          <span className="wi-addr">{shortAddr}</span>
          <button className="wi-copy" onClick={copyAddr} title="Sao chép địa chỉ">
            {copied ? '✓' : '⧉'}
          </button>
          <a className="wi-bscscan"
             href={`https://bscscan.com/address/${walletAddr}`}
             target="_blank" rel="noreferrer">
            BSCScan ↗
          </a>
        </div>

        {wallet?.description && <p className="wi-desc">{wallet.description}</p>}
        {wallet?.website && (
          <a className="wi-website" href={wallet.website} target="_blank" rel="noreferrer">
            {wallet.website}
          </a>
        )}

        {/* Số dư */}
        <div className="wi-section-title">Số dư hiện tại</div>
        {walletBalances.length === 0 ? (
          <div className="wi-empty">Chưa có dữ liệu số dư</div>
        ) : (
          <ul className="wi-balances">
            {walletBalances.slice(0, 8).map(b => (
              <li key={b.token} className="wi-balance-row">
                <span className="wi-bal-token">{b.token}</span>
                <span className="wi-bal-amount">
                  {b.amount.toLocaleString('vi-VN', { maximumFractionDigits: 4 })}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Hoạt động gần đây */}
        {recentActivity.length > 0 && (
          <>
            <div className="wi-section-title">Hoạt động gần đây</div>
            <ul className="wi-activity">
              {recentActivity.map((c, i) => {
                const delta = parseFloat(c.current) - parseFloat(c.previous);
                const isUp  = delta > 0;
                return (
                  <li key={i} className="wi-act-row">
                    <span className={`wi-act-arrow wi-act-arrow--${isUp ? 'up' : 'down'}`}>
                      {isUp ? '▲' : '▼'}
                    </span>
                    <span className="wi-act-token">{c.token?.symbol}</span>
                    <span className="wi-act-delta">
                      {isUp ? '+' : ''}{delta.toFixed(4)}
                    </span>
                    <span className="wi-act-time">{timeAgo(c.timestamp)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Biểu đồ cột: lịch sử cảnh báo 60 phút ─────────────── */
function AlertChart({ alerts }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5 * 60_000); // cập nhật mỗi 5 phút
    return () => clearInterval(id);
  }, []);

  const buckets = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: N_BUCKETS }, (_, i) => {
      const start = now - (N_BUCKETS - i) * BUCKET_MS;
      const end   = start + BUCKET_MS;
      const items = alerts.filter(a => a.timestamp >= start && a.timestamp < end);
      return {
        count:     items.length,
        hasHigh:   items.some(a => a.level === 'high'),
        hasMedium: items.some(a => a.level === 'medium'),
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, tick]);

  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const W = 200, H = 52, GAP = 3;
  const barW = (W - GAP * (N_BUCKETS - 1)) / N_BUCKETS;

  const levelTotal = {
    high:   alerts.filter(a => a.level === 'high').length,
    medium: alerts.filter(a => a.level === 'medium').length,
    low:    alerts.filter(a => a.level === 'low').length,
  };

  return (
    <div className="al-chart-wrap">
      <div className="al-chart-header">
        <span className="al-chart-title">LỊCH SỬ 24 GIỜ</span>
        <div className="al-chart-legend">
          {levelTotal.high   > 0 && <span className="al-leg al-leg--high">●  Cao {levelTotal.high}</span>}
          {levelTotal.medium > 0 && <span className="al-leg al-leg--med">● Vừa {levelTotal.medium}</span>}
          {levelTotal.low    > 0 && <span className="al-leg al-leg--low">●  Thấp {levelTotal.low}</span>}
        </div>
      </div>

      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
           className="al-chart-svg" preserveAspectRatio="none">
        {buckets.map((b, i) => {
          const h    = b.count === 0 ? 3 : Math.max(6, (b.count / maxCount) * (H - 6));
          const x    = i * (barW + GAP);
          const fill = b.count === 0
            ? 'rgba(255,255,255,.07)'
            : b.hasHigh   ? 'var(--red)'
            : b.hasMedium ? 'var(--orange)'
            : 'var(--blue)';
          return (
            <rect key={i} x={x} y={H - h} width={barW} height={h}
                  fill={fill} rx={2} opacity={b.count === 0 ? 1 : 0.85} />
          );
        })}
      </svg>

      <div className="al-chart-xaxis">
        <span>24h</span>
        <span>12h</span>
        <span>Nay</span>
      </div>
    </div>
  );
}

/* ── Ví bị cảnh báo ─────────────────────────────────────── */
function AlertedWallets({ alerts, onSelect }) {
  const list = useMemo(() => {
    const map = new Map();
    for (const a of alerts) {
      const addr = a.walletAddr;
      if (!addr) continue;
      if (!map.has(addr)) {
        map.set(addr, {
          addr,
          label:   a.walletLabel || `${addr.slice(0, 8)}…`,
          count:   0,
          highest: 'low',
          lastTs:  0,
          tokens:  new Set(),
        });
      }
      const e = map.get(addr);
      e.count++;
      if (a.timestamp > e.lastTs) e.lastTs = a.timestamp;
      if (a.token) e.tokens.add(a.token);
      const lvlOrder = { high: 3, medium: 2, low: 1 };
      if ((lvlOrder[a.level] ?? 0) > (lvlOrder[e.highest] ?? 0)) e.highest = a.level;
    }
    return [...map.values()].sort((a, b) => b.lastTs - a.lastTs);
  }, [alerts]);

  const lvlColor = { high: 'var(--red)', medium: 'var(--orange)', low: 'var(--blue)' };

  return (
    <div className="al-wallets">
      <div className="al-wallets-header">
        <span className="al-section-title">VÍ BỊ CẢNH BÁO</span>
        <span className="al-wallets-count">{list.length} ví</span>
      </div>

      {list.length === 0 ? (
        <div className="al-wallets-empty">Chưa có ví nào bị cảnh báo</div>
      ) : (
        <ul className="al-wallets-list">
          {list.map((w, i) => (
            <li key={w.addr} className="al-wallet-row">
              <span className="al-wallet-rank">#{i + 1}</span>
              <span className="al-wallet-dot" style={{ background: lvlColor[w.highest] }} />
              <button
                className="al-wallet-link"
                title={w.addr}
                onClick={() => onSelect({ addr: w.addr, label: w.label })}
              >{w.label}</button>
              <span className="al-wallet-token">{[...w.tokens].slice(0, 2).join(' ')}</span>
              <div className="al-wallet-right">
                <span className="al-wallet-time">{timeAgo(w.lastTs)}</span>
                <span className={`al-wallet-count al-wallet-count--${w.highest}`}>{w.count}×</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Ví đang hoạt động ───────────────────────────────────── */
function ActiveWallets({ recentChanges, onSelect }) {
  const active = useMemo(() => {
    const map = new Map();
    for (const c of recentChanges) {
      const addr = c.wallet?.address;
      if (!addr) continue;
      if (!map.has(addr)) {
        map.set(addr, {
          label:     c.wallet?.label || addr,
          address:   addr,
          lastToken: c.token?.symbol ?? '?',
          lastTs:    c.timestamp ?? Date.now(),
          count:     0,
        });
      }
      const e = map.get(addr);
      e.count++;
      if ((c.timestamp ?? 0) > e.lastTs) {
        e.lastTs    = c.timestamp;
        e.lastToken = c.token?.symbol ?? '?';
      }
    }
    return [...map.values()]
      .sort((a, b) => b.lastTs - a.lastTs)
      .slice(0, 8);
  }, [recentChanges]);

  return (
    <div className="al-wallets">
      <div className="al-wallets-header">
        <span className="al-section-title">VÍ ĐANG HOẠT ĐỘNG</span>
        <span className="al-wallets-count">{active.length} ví</span>
      </div>

      {active.length === 0 ? (
        <div className="al-wallets-empty">Chưa có thay đổi số dư</div>
      ) : (
        <ul className="al-wallets-list">
          {active.map((w, i) => (
            <li key={w.address} className="al-wallet-row">
              <span className="al-wallet-rank">#{i + 1}</span>
              <span className="al-wallet-dot" />
              <button
                className="al-wallet-link"
                title={w.address}
                onClick={() => onSelect({ addr: w.address, label: w.label })}
              >{w.label}</button>
              <span className="al-wallet-token">{w.lastToken}</span>
              <div className="al-wallet-right">
                <span className="al-wallet-time">{timeAgo(w.lastTs)}</span>
                <span className="al-wallet-count">{w.count}×</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Panel chính ─────────────────────────────────────────── */
export default function AlertsPanel({ alerts, onClearAll }) {
  const { recentChanges, wallets, balances } = useMonitor();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null); // { addr, label }
  const listRef = useRef(null);

  const openWallet = useCallback((info) => setSelectedWallet(info), []);
  const closeWallet = useCallback(() => setSelectedWallet(null), []);

  /* Cuộn về đầu khi có cảnh báo mới */
  useEffect(() => {
    if (alerts.length > 0 && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [alerts.length]);

  const hasHigh = alerts.some(a => a.level === 'high');

  return (
    <div className={`alerts-panel ${hasHigh ? 'alerts-panel--urgent' : ''}`}>

      {/* ── Header ──────────────────────────────────────── */}
      <div className="ap-header" onClick={() => setCollapsed(c => !c)} style={{ cursor: 'pointer' }}>
        <div className="ap-title-group">
          <span className={`ap-live-dot ${alerts.length > 0 ? 'ap-live-dot--on' : ''}`} />
          <span className="ap-title">CẢNH BÁO THỜI GIAN THỰC</span>
          {alerts.length > 0 && (
            <span className="ap-count-badge">{alerts.length}</span>
          )}
          <span className="ap-chevron">{collapsed ? '▸' : '▾'}</span>
        </div>

        {alerts.length > 0 && (
          <button
            className="ap-clear-btn"
            onClick={e => { e.stopPropagation(); onClearAll(); }}
          >
            Xóa tất cả
          </button>
        )}
      </div>

      {/* ── Body: 3 cột ─────────────────────────────────── */}
      {!collapsed && (
        <div className="ap-body">

          {/* Cột 1: Danh sách cảnh báo */}
          <div className="ap-col ap-col--alerts">
            {alerts.length === 0 ? (
              <div className="ap-empty">
                <span className="ap-empty-icon">🛡️</span>
                <span>Hệ thống đang theo dõi — chưa có cảnh báo</span>
              </div>
            ) : (
              <ul className="ap-list" ref={listRef}>
                {alerts.slice(0, 12).map((a, i) => {
                  const time = new Date(a.timestamp).toLocaleTimeString('vi-VN');
                  return (
                    <li key={`${a.timestamp}-${i}`} className={`ap-item ap-item--${a.level ?? 'low'}`}>
                      <span className="ap-item-dot" />
                      <div className="ap-item-body">
                        <span className="ap-item-label">
                          <button
                            className="ap-item-wallet-link"
                            onClick={e => { e.stopPropagation(); openWallet({ addr: a.walletAddr, label: a.walletLabel }); }}
                          >
                            {a.walletLabel || `${a.walletAddr?.slice(0, 8)}…`}
                          </button>
                          {' · '}
                          <span className="ap-item-token">{a.token}</span>
                        </span>
                        <span className="ap-item-msg">{a.message}</span>
                      </div>
                      <span className="ap-item-time">{time}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Cột 2: Ví bị cảnh báo */}
          <div className="ap-col ap-col--alerted">
            <AlertedWallets alerts={alerts} onSelect={openWallet} />
          </div>

          {/* Cột 3: Biểu đồ */}
          <div className="ap-col ap-col--chart">
            <AlertChart alerts={alerts} />
          </div>

          {/* Cột 4: Ví hoạt động */}
          <div className="ap-col ap-col--wallets">
            <ActiveWallets recentChanges={recentChanges} onSelect={openWallet} />
          </div>

        </div>
      )}

      {/* Popup thông tin ví */}
      {selectedWallet && (
        <WalletInfoModal
          walletAddr={selectedWallet.addr}
          walletLabel={selectedWallet.label}
          wallets={wallets}
          balances={balances}
          recentChanges={recentChanges}
          onClose={closeWallet}
        />
      )}
    </div>
  );
}
