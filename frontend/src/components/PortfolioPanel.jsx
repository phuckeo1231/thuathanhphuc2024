import { useState, useMemo } from 'react';
import { useMonitor } from '../context/MonitorContext.jsx';
import usePrices      from '../hooks/usePrices.js';

/* ── Hằng số ─────────────────────────────────────────────────── */
const TOKEN_COLORS = {
  BNB:  '#f0b90b', CAKE: '#1fc7d4',
  USDT: '#26a17b', USDC: '#2775ca',
  BAKE: '#e97b2e', ETH:  '#627eea',
  BTC:  '#f7931a',
};

const SUB_TABS = [
  { id: 'portfolio', label: 'DANH MỤC ĐẦU TƯ' },
  { id: 'by-chain',  label: 'TÀI SẢN THEO CHUỖI' },
  { id: 'bal-hist',  label: 'LỊCH SỬ SỐ DƯ' },
  { id: 'tok-hist',  label: 'LỊCH SỬ SỐ DƯ TOKEN' },
  { id: 'pnl',       label: 'LỢI NHUẬN & THUA LỖ' },
];

const TIME_FILTERS = [
  { id: '1W', label: '1W' },
  { id: '1M', label: '1T' },
  { id: '3M', label: '3T' },
  { id: 'ALL', label: 'TẤT CẢ' },
];

/* ── Helpers ─────────────────────────────────────────────────── */
function fmtUSD(v) {
  if (!v || isNaN(v)) return '$0.00';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtBal(v) {
  if (!v || isNaN(v)) return '0';
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  if (v >= 1)   return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return v.toFixed(6);
}

function fmtPrice(p) {
  if (!p || isNaN(p)) return '—';
  return p >= 1
    ? `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${p.toFixed(6)}`;
}

function relTime(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60)  return `${Math.floor(diff)}s trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)}p trước`;
  return `${Math.floor(diff / 3600)}h trước`;
}

/* ── TokenIcon ───────────────────────────────────────────────── */
function TokenIcon({ symbol, size = 28 }) {
  const color = TOKEN_COLORS[symbol] ?? '#64748b';
  return (
    <span
      className="pfp-token-icon"
      style={{ background: color + '20', color, width: size, height: size, fontSize: size * 0.38 }}
    >
      {symbol?.slice(0, 3) ?? '?'}
    </span>
  );
}

/* ── EmptyState ─────────────────────────────────────────────── */
function EmptyState({ msg = 'Chưa có dữ liệu', sub }) {
  return (
    <div className="pfp-empty">
      <span className="pfp-empty-icon">◈</span>
      <p>{msg}</p>
      {sub && <small>{sub}</small>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-tab 1 — DANH MỤC ĐẦU TƯ
═══════════════════════════════════════════════════════════════ */
function PortfolioTab({ items, totalValue }) {
  if (items.length === 0) {
    return <EmptyState msg="Chưa có tài sản" sub="Kết nối ví và chờ dữ liệu blockchain" />;
  }
  return (
    <div className="pfp-table-wrap">
      <table className="pfp-table">
        <thead>
          <tr>
            <th>TÀI SẢN</th>
            <th>GIÁ</th>
            <th>SỐ LƯỢNG</th>
            <th>GIÁ TRỊ</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const pct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
            return (
              <tr key={item.symbol} className="pfp-table-row">
                <td>
                  <div className="pfp-asset-cell">
                    <TokenIcon symbol={item.symbol} />
                    <div className="pfp-asset-meta">
                      <span className="pfp-asset-sym">{item.symbol}</span>
                      <span className="pfp-asset-chain">BSC</span>
                    </div>
                    <div className="pfp-pct-bar-wrap">
                      <div className="pfp-pct-bar" style={{ width: `${pct}%`, background: TOKEN_COLORS[item.symbol] ?? 'var(--accent)' }} />
                    </div>
                    <span className="pfp-pct-label">{pct.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="pfp-td-mono">{fmtPrice(item.price)}</td>
                <td className="pfp-td-mono">
                  {fmtBal(item.balance)}&nbsp;
                  <span className="pfp-td-sym">{item.symbol}</span>
                </td>
                <td className="pfp-td-value">{fmtUSD(item.value)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Tổng cộng */}
      <div className="pfp-table-total">
        <span>Tổng giá trị</span>
        <span className="pfp-total-val">{fmtUSD(totalValue)}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-tab 2 — TÀI SẢN THEO CHUỖI
═══════════════════════════════════════════════════════════════ */
function ByChainTab({ wallets, items }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (items.length === 0) {
    return <EmptyState msg="Chưa có dữ liệu theo chuỗi" />;
  }
  return (
    <div className="pfp-chain-view">
      <div className="pfp-chain-card">
        <div className="pfp-chain-header">
          <div className="pfp-chain-title">
            <span className="pfp-chain-dot" style={{ background: '#f0b90b' }} />
            <span>BSC — Binance Smart Chain</span>
            <span className="pfp-chain-wallets-badge">{wallets.length} ví</span>
          </div>
          <span className="pfp-chain-total-val">{fmtUSD(total)}</span>
        </div>

        <div className="pfp-chain-tokens">
          {items.map(item => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div key={item.symbol} className="pfp-chain-row">
                <div className="pfp-asset-cell" style={{ width: 140 }}>
                  <TokenIcon symbol={item.symbol} size={24} />
                  <span className="pfp-asset-sym">{item.symbol}</span>
                </div>
                <div className="pfp-chain-bar-track">
                  <div
                    className="pfp-chain-bar-fill"
                    style={{ width: `${pct}%`, background: TOKEN_COLORS[item.symbol] ?? 'var(--accent)' }}
                  />
                </div>
                <span className="pfp-chain-pct">{pct.toFixed(1)}%</span>
                <span className="pfp-td-value">{fmtUSD(item.value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-tab 3 — LỊCH SỬ SỐ DƯ
═══════════════════════════════════════════════════════════════ */
function BalHistRow({ ch }) {
  const prev  = parseFloat(ch.previous ?? 0);
  const curr  = parseFloat(ch.current ?? 0);
  const delta = curr - prev;
  const pct   = prev > 0 ? ((delta / prev) * 100).toFixed(2) : '—';
  const up    = delta >= 0;

  return (
    <tr className="pfp-table-row">
      <td className="pfp-td-time">{relTime(ch.timestamp)}</td>
      <td>
        <span className="pfp-hist-label" title={ch.wallet?.address}>
          {ch.wallet?.label ?? ch.wallet?.address?.slice(0, 10) + '...'}
        </span>
      </td>
      <td>
        <span className="pfp-token-badge" style={{ color: TOKEN_COLORS[ch.token?.symbol] ?? 'var(--accent)' }}>
          {ch.token?.symbol}
        </span>
      </td>
      <td className="pfp-td-mono pfp-td-muted">{fmtBal(prev)}</td>
      <td className="pfp-td-mono">{fmtBal(curr)}</td>
      <td className={up ? 'pfp-up' : 'pfp-down'}>
        {up ? '+' : ''}{fmtBal(delta)}
        {pct !== '—' && <span className="pfp-pct-inline"> ({pct}%)</span>}
      </td>
    </tr>
  );
}

function BalanceHistTab({ recentChanges }) {
  if (recentChanges.length === 0) {
    return <EmptyState msg="Chưa có lịch sử thay đổi" sub="Dữ liệu sẽ xuất hiện khi số dư ví thay đổi" />;
  }
  return (
    <div className="pfp-table-wrap">
      <table className="pfp-table">
        <thead>
          <tr>
            <th>THỜI GIAN</th><th>VÍ</th><th>TOKEN</th>
            <th>SỐ DƯ CŨ</th><th>SỐ DƯ MỚI</th><th>THAY ĐỔI</th>
          </tr>
        </thead>
        <tbody>
          {recentChanges.slice(0, 50).map((ch, i) => <BalHistRow key={i} ch={ch} />)}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-tab 4 — LỊCH SỬ SỐ DƯ TOKEN
═══════════════════════════════════════════════════════════════ */
function TokenHistTab({ recentChanges, tokens }) {
  const [sel, setSel] = useState(tokens[0]?.symbol ?? '');
  const filtered = useMemo(
    () => recentChanges.filter(c => c.token?.symbol === sel),
    [recentChanges, sel]
  );

  return (
    <div className="pfp-tokenhist">
      <div className="pfp-tokenhist-selector">
        {tokens.map(t => (
          <button
            key={t.symbol}
            className={`pfp-tokenhist-btn ${sel === t.symbol ? 'active' : ''}`}
            style={{ '--tc': TOKEN_COLORS[t.symbol] ?? 'var(--accent)' }}
            onClick={() => setSel(t.symbol)}
          >
            <TokenIcon symbol={t.symbol} size={20} />
            {t.symbol}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState msg={`Chưa có lịch sử cho ${sel}`} />
      ) : (
        <div className="pfp-table-wrap">
          <table className="pfp-table">
            <thead>
              <tr>
                <th>THỜI GIAN</th><th>VÍ</th><th>TOKEN</th>
                <th>SỐ DƯ CŨ</th><th>SỐ DƯ MỚI</th><th>THAY ĐỔI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((ch, i) => <BalHistRow key={i} ch={ch} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-tab 5 — LỢI NHUẬN & THUA LỖ
═══════════════════════════════════════════════════════════════ */
function PnLTab({ items }) {
  const hasData = items.some(i => i.value > 0 && i.change24h !== 0);
  return (
    <div className="pfp-pnl">
      <div className="pfp-pnl-note">
        <span className="pfp-pnl-note-icon">📊</span>
        <p>Thay đổi 24 giờ (ước tính theo giá Binance)</p>
        <small>Lợi nhuận/thua lỗ thực tế cần lịch sử giá mua — hiện chưa được lưu.</small>
      </div>

      {!hasData ? (
        <EmptyState msg="Chưa đủ dữ liệu giá" sub="Đang tải giá từ Binance..." />
      ) : (
        <div className="pfp-table-wrap">
          <table className="pfp-table">
            <thead>
              <tr>
                <th>TÀI SẢN</th>
                <th>GIÁ TRỊ</th>
                <th>% 24H</th>
                <th>LÃI/LỖ 24H</th>
              </tr>
            </thead>
            <tbody>
              {items.filter(i => i.value > 0).map(item => {
                const ch   = item.change24h ?? 0;
                const pnl  = (item.value * ch) / 100;
                return (
                  <tr key={item.symbol} className="pfp-table-row">
                    <td>
                      <div className="pfp-asset-cell">
                        <TokenIcon symbol={item.symbol} size={24} />
                        <span className="pfp-asset-sym">{item.symbol}</span>
                      </div>
                    </td>
                    <td className="pfp-td-value">{fmtUSD(item.value)}</td>
                    <td className={ch >= 0 ? 'pfp-up' : 'pfp-down'}>
                      {ch >= 0 ? '+' : ''}{ch.toFixed(2)}%
                    </td>
                    <td className={pnl >= 0 ? 'pfp-up' : 'pfp-down'}>
                      {pnl >= 0 ? '+' : '-'}{fmtUSD(Math.abs(pnl))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PortfolioPanel — main export
═══════════════════════════════════════════════════════════════ */
export default function PortfolioPanel({ user, onLogout }) {
  const [subTab,     setSubTab]     = useState('portfolio');
  const [timeFilter, setTimeFilter] = useState('ALL');
  const [minUSD,     setMinUSD]     = useState(1);

  const { wallets, tokens, balances, recentChanges } = useMonitor();
  const prices = usePrices();

  /* ── Gộp số dư các ví theo token ── */
  const aggregated = useMemo(() => {
    const map = {};
    for (const [key, balStr] of Object.entries(balances)) {
      const idx     = key.lastIndexOf(':');
      if (idx === -1) continue;
      const sym     = key.slice(idx + 1);
      map[sym]      = (map[sym] ?? 0) + (parseFloat(balStr) || 0);
    }
    return Object.entries(map)
      .map(([sym, bal]) => ({
        symbol:    sym,
        balance:   bal,
        price:     prices[sym]          ?? 0,
        change24h: prices[`${sym}_24h`] ?? 0,
        value:     bal * (prices[sym]   ?? 0),
      }))
      .filter(item => minUSD === 0 || item.value >= minUSD)
      .sort((a, b) => b.value - a.value);
  }, [balances, prices, minUSD]);

  const totalValue = aggregated.reduce((s, i) => s + i.value, 0);
  const initial    = user?.username?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="portfolio-panel">

      {/* ── Header ── */}
      <div className="pfp-header">
        <div className="pfp-user">
          <div className="pfp-avatar">{initial}</div>
          <div className="pfp-info">
            <span className="pfp-username">{user?.username ?? 'Người dùng'}</span>
            <span className="pfp-total">
              {fmtUSD(totalValue)}
            </span>
          </div>
        </div>

        <div className="pfp-header-right">
          <div className="pfp-network-chip">
            <span className="pfp-net-dot" />
            TẤT CẢ CÁC MẠNG
          </div>
          {onLogout && (
            <button className="pfp-logout-btn" onClick={onLogout} title="Đăng xuất">
              <span>↩</span>
              Đăng xuất
            </button>
          )}
        </div>
      </div>

      {/* ── Sub-tabs + time filter ── */}
      <div className="pfp-tabs-row">
        <nav className="pfp-subtabs">
          {SUB_TABS.map(t => (
            <button
              key={t.id}
              className={`pfp-subtab ${subTab === t.id ? 'pfp-subtab--active' : ''}`}
              onClick={() => setSubTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="pfp-time-filters">
          {TIME_FILTERS.map(f => (
            <button
              key={f.id}
              className={`pfp-time-btn ${timeFilter === f.id ? 'pfp-time-btn--active' : ''}`}
              onClick={() => setTimeFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="pfp-content">
        {subTab === 'portfolio' && <PortfolioTab  items={aggregated} totalValue={totalValue} />}
        {subTab === 'by-chain'  && <ByChainTab    wallets={wallets}   items={aggregated} />}
        {subTab === 'bal-hist'  && <BalanceHistTab recentChanges={recentChanges} />}
        {subTab === 'tok-hist'  && <TokenHistTab   recentChanges={recentChanges} tokens={tokens} />}
        {subTab === 'pnl'       && <PnLTab         items={aggregated} />}
      </div>

      {/* ── Bottom bar ── */}
      <div className="pfp-bottom-bar">
        <div className="pfp-accounts-chip">
          <span>TẤT CẢ TÀI KHOẢN</span>
          <span className="pfp-acct-badge">{wallets.length}</span>
        </div>
        <button
          className={`pfp-filter-chip ${minUSD >= 1 ? 'pfp-filter-chip--on' : ''}`}
          onClick={() => setMinUSD(p => p >= 1 ? 0 : 1)}
        >
          USD ≥ $1
        </button>
      </div>

    </div>
  );
}
