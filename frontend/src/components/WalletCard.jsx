import { memo, useEffect, useState, useMemo } from 'react';
import { useMonitor } from '../context/MonitorContext.jsx';
import BalanceChart from './BalanceChart.jsx';
import WalletAlertSettingsModal from './WalletAlertSettingsModal.jsx';

/* ── Format helpers ─────────────────────────────────────── */
function fmtAmount(raw) {
  const n = parseFloat(raw);
  if (isNaN(n) || raw === '—') return raw;
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 10_000)        return (n / 1_000).toFixed(1) + 'K';
  if (n >= 1)             return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n > 0)              return n.toPrecision(4);
  return '0';
}

function short(addr) {
  if (!addr) return '—';
  return addr.slice(0, 8) + '…' + addr.slice(-4);
}

function timeAgoMs(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10)    return 'vừa nay';
  if (s < 60)    return `${s}s trước`;
  if (s < 3600)  return `${Math.floor(s / 60)}ph trước`;
  if (s < 86400) return `${Math.floor(s / 3600)}h trước`;
  return `${Math.floor(s / 86400)}d trước`;
}

function timeAgoSec(ts) {
  return timeAgoMs(ts * 1000);
}

/* ── Category ───────────────────────────────────────────── */
const CATEGORY_META = {
  exchange: { label: 'Sàn giao dịch', color: '#3498db', bg: 'rgba(52,152,219,.15)' },
  defi:     { label: 'DeFi Protocol', color: '#9b59b6', bg: 'rgba(155,89,182,.15)' },
  whale:    { label: 'Cá voi',        color: '#00b894', bg: 'rgba(0,184,148,.15)'  },
  bridge:   { label: 'Bridge',        color: '#e67e22', bg: 'rgba(230,126,34,.15)' },
  other:    { label: 'Khác',          color: '#636e72', bg: 'rgba(99,110,114,.15)' },
};

function CategoryBadge({ category }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.other;
  return (
    <span className="wc-badge" style={{ color: meta.color, background: meta.bg }}>
      {meta.label}
    </span>
  );
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button className="wc-copy-btn" onClick={copy} title="Sao chép địa chỉ">
      {copied ? '✓' : '⎘'}
    </button>
  );
}

/* ── Panel chi tiết ─────────────────────────────────────── */
function WalletDetailPanel({ wallet, recentChanges, history }) {
  const { transfers } = useMonitor();
  const [tab, setTab] = useState('txs');

  /* Giao dịch liên quan ví này */
  const walletTxs = useMemo(() =>
    transfers
      .filter(tx => tx.from === wallet.address || tx.to === wallet.address)
      .slice(0, 20),
    [transfers, wallet.address]
  );

  /* Biến động số dư của ví này */
  const walletChanges = useMemo(() =>
    recentChanges
      .filter(c => c.wallet?.address === wallet.address)
      .slice(0, 30),
    [recentChanges, wallet.address]
  );

  /* Thống kê tổng hợp */
  const stats = useMemo(() => {
    const tokenMap = new Map();
    for (const c of walletChanges) {
      const sym   = c.token?.symbol ?? '?';
      const delta = parseFloat(c.current) - parseFloat(c.previous);
      if (!tokenMap.has(sym)) tokenMap.set(sym, { sym, inAmt: 0, outAmt: 0, count: 0, lastTs: 0 });
      const e = tokenMap.get(sym);
      if (delta > 0) e.inAmt  += delta;
      else           e.outAmt += Math.abs(delta);
      e.count++;
      if (c.timestamp > e.lastTs) e.lastTs = c.timestamp;
    }
    return [...tokenMap.values()].sort((a, b) => b.lastTs - a.lastTs);
  }, [walletChanges]);

  const totalChanges = walletChanges.length;

  return (
    <div className="wd-panel">

      {/* Tabs */}
      <div className="wd-tabs">
        <button
          className={`wd-tab ${tab === 'txs' ? 'wd-tab--on' : ''}`}
          onClick={() => setTab('txs')}
        >
          Giao dịch
          {walletTxs.length > 0 && <span className="wd-tab-count">{walletTxs.length}</span>}
        </button>
        <button
          className={`wd-tab ${tab === 'changes' ? 'wd-tab--on' : ''}`}
          onClick={() => setTab('changes')}
        >
          Biến động
          {totalChanges > 0 && <span className="wd-tab-count">{totalChanges}</span>}
        </button>
      </div>

      {/* ── Tab: Giao dịch ── */}
      {tab === 'txs' && (
        <div className="wd-content">
          {walletTxs.length === 0 ? (
            <div className="wd-empty">Chưa có giao dịch nào được ghi nhận trong phiên này</div>
          ) : (
            <ul className="wd-tx-list">
              {walletTxs.map((tx, i) => {
                const isIn       = tx.to === wallet.address;
                const party      = isIn
                  ? (tx.fromLabel || short(tx.from))
                  : (tx.toLabel   || short(tx.to));
                const usd        = tx.usd != null ? `$${Number(tx.usd).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null;
                return (
                  <li key={`${tx.hash}:${i}`} className="wd-tx-row">
                    <span className={`wd-tx-dir ${isIn ? 'wd-tx-dir--in' : 'wd-tx-dir--out'}`}>
                      {isIn ? '↓ VÀO' : '↑ RA'}
                    </span>
                    <span className="wd-tx-party" title={isIn ? tx.from : tx.to}>{party}</span>
                    <div className="wd-tx-value">
                      <span className="wd-tx-amount">{tx.valueFormatted}</span>
                      <span className="wd-tx-sym">{tx.tokenSymbol}</span>
                      {usd && <span className="wd-tx-usd">{usd}</span>}
                    </div>
                    <span className="wd-tx-time">{timeAgoSec(tx.timeStamp)}</span>
                    <a
                      className="wd-tx-link"
                      href={`https://bscscan.com/tx/${tx.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Xem trên BSCScan"
                    >↗</a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Tab: Biến động ── */}
      {tab === 'changes' && (
        <div className="wd-content">

          {/* Thống kê theo token */}
          {stats.length > 0 && (
            <div className="wd-stats-grid">
              {stats.map(s => (
                <div key={s.sym} className="wd-stat-card">
                  <span className="wd-stat-sym">{s.sym}</span>
                  <div className="wd-stat-row">
                    {s.inAmt > 0 && (
                      <span className="wd-stat-in">+{fmtAmount(s.inAmt.toFixed(4))}</span>
                    )}
                    {s.outAmt > 0 && (
                      <span className="wd-stat-out">-{fmtAmount(s.outAmt.toFixed(4))}</span>
                    )}
                  </div>
                  <span className="wd-stat-cnt">{s.count} lần</span>
                </div>
              ))}
            </div>
          )}

          {walletChanges.length === 0 ? (
            <div className="wd-empty">Chưa có thay đổi số dư nào trong phiên này</div>
          ) : (
            <ul className="wd-change-list">
              {walletChanges.map((c, i) => {
                const prev      = parseFloat(c.previous);
                const curr      = parseFloat(c.current);
                const delta     = curr - prev;
                const pctRaw    = prev > 0 ? (delta / prev) * 100 : null;
                const pct       = pctRaw !== null ? (Math.abs(pctRaw) >= 0.01 ? pctRaw.toFixed(2) : '<0.01') : null;
                const chartData = history.get(c.wallet.address, c.token?.symbol ?? '');
                const isPos     = delta >= 0;
                return (
                  <li key={i} className="wd-change-row">
                    <span className="wd-chg-sym">{c.token?.symbol}</span>
                    <div className="wd-chg-flow">
                      <span className="wd-chg-prev">{fmtAmount(c.previous)}</span>
                      <span className="wd-chg-arr">→</span>
                      <span className="wd-chg-curr">{fmtAmount(c.current)}</span>
                    </div>
                    <span className={`wd-chg-delta ${isPos ? 'delta-up' : 'delta-down'}`}>
                      {isPos ? '+' : ''}{fmtAmount(String(Math.abs(delta).toFixed(4)))}
                      {pct && <span className="wd-chg-pct"> ({pct}%)</span>}
                    </span>
                    {chartData.length >= 2 && (
                      <BalanceChart data={chartData} width={56} height={20} />
                    )}
                    <span className="wd-chg-time">{timeAgoMs(c.timestamp)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ── WalletCard chính ───────────────────────────────────── */
function WalletCard({ wallet, tokens, balances, recentChanges, history, balancesLoaded = false, scannedWallets, onRemove, pinned = false, onPin }) {
  const [flashing,       setFlashing]       = useState({});
  const [expanded,       setExpanded]       = useState(false);
  const [alertSettings,  setAlertSettings]  = useState(false);

  useEffect(() => {
    const latest = recentChanges.find(c => c.wallet?.address === wallet.address);
    if (!latest) return;
    const sym = latest.token?.symbol;
    setFlashing(f => ({ ...f, [sym]: true }));
    const t = setTimeout(() => setFlashing(f => ({ ...f, [sym]: false })), 800);
    return () => clearTimeout(t);
  }, [recentChanges.length, wallet.address]);

  const walletTokens = tokens.filter(t => {
    const key = `${wallet.address}:${t.symbol}`;
    return balances[key] && balances[key] !== '—' && parseFloat(balances[key]) > 0;
  });
  // Ví này "đã tải xong" khi: snapshot hoàn chỉnh, hoặc server báo wallet_scanned, hoặc đã có balance key
  const walletDataReceived = balancesLoaded ||
    !!scannedWallets?.[wallet.address] ||
    Object.keys(balances).some(k => k.startsWith(`${wallet.address}:`));

  /* Đếm giao dịch / biến động để hiển thị badge trên nút toggle */
  const changeCount = recentChanges.filter(c => c.wallet?.address === wallet.address).length;

  const shortAddr = `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`;
  const bscLink   = `https://bscscan.com/address/${wallet.address}`;

  return (
    <div className={`wallet-card ${expanded ? 'wallet-card--expanded' : ''} ${pinned ? 'wallet-card--pinned' : ''}`}>

      {/* ── Header ──────────────────────────────────────── */}
      <div className="wallet-header">
        <div className="wc-title-row">
          <span className="wc-logo">{wallet.logo || '💼'}</span>
          <span className="wallet-label">{wallet.label}</span>
          <CategoryBadge category={wallet.category} />
        </div>
        <div className="wc-actions">
          {wallet.website && (
            <a className="wc-icon-btn" href={wallet.website} target="_blank" rel="noreferrer" title={`Website: ${wallet.website}`}>
              🌐
            </a>
          )}
          <a className="wc-icon-btn" href={bscLink} target="_blank" rel="noreferrer" title="Xem trên BSCScan">
            🔍
          </a>
          {onPin && (
            <button
              className={`wc-icon-btn wc-pin-btn${pinned ? ' wc-pin-btn--active' : ''}`}
              title={pinned ? 'Bỏ ghim' : 'Ghim ví này lên đầu'}
              onClick={e => { e.stopPropagation(); onPin(); }}
            >📌</button>
          )}
          <button
            className="wc-icon-btn"
            title="Cài đặt ngưỡng cảnh báo"
            onClick={e => { e.stopPropagation(); setAlertSettings(true); }}
          >🔔</button>
          <button className="wallet-remove-btn" title="Xóa ví" onClick={onRemove}>✕</button>
        </div>
      </div>

      {/* ── Địa chỉ + mô tả ─────────────────────────────── */}
      <div className="wc-meta">
        <div className="wc-addr-row">
          <span className="wallet-address">{shortAddr}</span>
          <CopyBtn text={wallet.address} />
        </div>
        {wallet.description && (
          <p className="wc-description">{wallet.description}</p>
        )}
      </div>

      {/* ── Danh sách token ─────────────────────────────── */}
      <div className="token-list">
        {walletTokens.length === 0 ? (
          <div className="wc-empty">
            {walletDataReceived
              ? 'Không có số dư token được theo dõi'
              : 'Đang tải số dư...'}
          </div>
        ) : (
          walletTokens.map((token) => {
            const key        = `${wallet.address}:${token.symbol}`;
            const balance    = balances[key] ?? '—';
            const chartData  = history.get(wallet.address, token.symbol);
            const lastChange = recentChanges.find(
              c => c.wallet?.address === wallet.address && c.token?.symbol === token.symbol
            );
            const delta    = lastChange
              ? (parseFloat(lastChange.current) - parseFloat(lastChange.previous)).toFixed(4)
              : null;
            const deltaNum = delta !== null ? parseFloat(delta) : null;

            return (
              <div key={token.symbol} className={`token-row ${flashing[token.symbol] ? 'flash' : ''}`}>
                <div className="token-info">
                  <span className="token-symbol">{token.symbol}</span>
                  <span className="token-name">{token.name || ''}</span>
                  <span className="token-balance">{fmtAmount(balance)}</span>
                  {deltaNum !== null && deltaNum !== 0 && (
                    <span className={`token-delta ${deltaNum >= 0 ? 'delta-up' : 'delta-down'}`}>
                      {deltaNum >= 0 ? '+' : ''}{fmtAmount(String(Math.abs(deltaNum)))}
                    </span>
                  )}
                </div>
                <BalanceChart data={chartData} />
              </div>
            );
          })
        )}
      </div>

      {/* ── Nút toggle chi tiết ─────────────────────────── */}
      <button
        className={`wd-toggle ${expanded ? 'wd-toggle--open' : ''}`}
        onClick={() => setExpanded(e => !e)}
      >
        <span className="wd-toggle-icon">{expanded ? '▲' : '▼'}</span>
        <span>{expanded ? 'Thu gọn' : 'Giao dịch & Biến động'}</span>
        {!expanded && changeCount > 0 && (
          <span className="wd-toggle-badge">{changeCount} thay đổi</span>
        )}
      </button>

      {/* ── Panel chi tiết ──────────────────────────────── */}
      {expanded && (
        <WalletDetailPanel
          wallet={wallet}
          recentChanges={recentChanges}
          history={history}
        />
      )}

      {/* ── Modal cài đặt ngưỡng cảnh báo ──────────────── */}
      {alertSettings && (
        <WalletAlertSettingsModal
          wallet={wallet}
          onClose={() => setAlertSettings(false)}
        />
      )}
    </div>
  );
}

export default memo(WalletCard);
