import { useState, useMemo, useEffect, useCallback, useRef } from 'react';

/* ── Format helpers ─────────────────────────────────────────── */
function fmtMoney(n) {
  if (!n || n === 0) return '$0';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPrice(price) {
  if (price >= 1e4) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 1e3) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1)   return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 6 })}`;
}

function fmtPct(n) {
  const s = n.toFixed(2);
  return n >= 0 ? `+${s}%` : `${s}%`;
}

/* ── Token icon colors ──────────────────────────────────────── */
const TOKEN_COLORS = {
  SP500:    '#c0392b',
  ETH:      '#627eea',
  BẠC:      '#7f8c8d',
  XYZ100:   '#2980b9',
  AAVE:     '#7b2d8b',
  SOL:      '#9945ff',
  SNDK:     '#e74c3c',
  MŨTRÒM:   '#27ae60',
  BRENTOIL: '#2c3e50',
  DẦU:      '#34495e',
  XLM:      '#3498db',
  VÀNG:     '#d4ac0d',
  BTC:      '#f7931a',
  BNB:      '#f0b90b',
};
function tokenColor(id) { return TOKEN_COLORS[id] ?? '#475569'; }

/* ── Bybit API ──────────────────────────────────────────────── */
const BYBIT_API = 'https://api.bybit.com/v5';

// Maps token IDs → Bybit linear perpetual symbols
const BYBIT_SYMBOL_MAP = {
  BTC:  'BTCUSDT',
  ETH:  'ETHUSDT',
  SOL:  'SOLUSDT',
  AAVE: 'AAVEUSDT',
  XLM:  'XLMUSDT',
  BNB:  'BNBUSDT',
  VÀNG: 'XAUUSDT',
};
const BYBIT_IDS = new Set(Object.keys(BYBIT_SYMBOL_MAP));

async function fetchBybitTickers() {
  try {
    const res  = await fetch(`${BYBIT_API}/market/tickers?category=linear`, {
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json();
    if (json.retCode !== 0 || !Array.isArray(json.result?.list)) return {};
    return Object.fromEntries(json.result.list.map(item => [item.symbol, item]));
  } catch { return {}; }
}

async function fetchBybitRatio(symbol) {
  try {
    const res  = await fetch(
      `${BYBIT_API}/market/account-ratio?category=linear&symbol=${symbol}&period=1h&limit=1`,
      { signal: AbortSignal.timeout(8_000) },
    );
    const json = await res.json();
    if (json.retCode !== 0 || !json.result?.list?.length) return null;
    const item = json.result.list[0];
    return {
      buyRatio:  parseFloat(item.buyRatio)  || 0.5,
      sellRatio: parseFloat(item.sellRatio) || 0.5,
    };
  } catch { return null; }
}

function applyBybitTick(token, ticker, ratio) {
  const price     = parseFloat(ticker.lastPrice)       || token.price;
  const changePct = parseFloat(ticker.price24hPcnt)    * 100;
  const volumeUSD = parseFloat(ticker.turnover24h)     || token.volumeUSD;
  const oi        = parseFloat(ticker.openInterestValue) || 0;
  const buy       = ratio?.buyRatio  ?? 0.5;
  const sell      = ratio?.sellRatio ?? 0.5;
  return {
    ...token,
    price,
    changePct,
    volumeUSD,
    longPos:      Math.round(oi * buy),
    shortPos:     Math.round(oi * sell),
    longTraders:  Math.round(buy  * 100),
    shortTraders: Math.round(sell * 100),
    _live:        true,
  };
}

/* ── Initial / static data ──────────────────────────────────── */
const INITIAL_DATA = [
  { id: 'BTC',     symbol: 'BTC',         iconText: '₿',  volumeUSD: 3_790_000_000, price: 75_766,  changePct: -2.08, longTraders: 54, shortTraders: 46, longPos: 2_140_000_000, shortPos: 1_825_000_000 },
  { id: 'ETH',     symbol: 'ETH',         iconText: 'Ξ',  volumeUSD: 2_458_000_000, price: 2_357,   changePct: -3.16, longTraders: 48, shortTraders: 52, longPos:   920_000_000, shortPos:   998_000_000 },
  { id: 'SOL',     symbol: 'SOL',         iconText: '◎',  volumeUSD:   589_830_000, price:  86.57,  changePct: -3.33, longTraders: 51, shortTraders: 49, longPos:   276_000_000, shortPos:   266_000_000 },
  { id: 'AAVE',    symbol: 'AAVE',        iconText: 'Av', volumeUSD:    35_810_000, price: 111.67,  changePct: -4.90, longTraders: 55, shortTraders: 45, longPos:    27_500_000, shortPos:    22_600_000 },
  { id: 'XLM',     symbol: 'XLM',         iconText: 'X',  volumeUSD:    13_560_000, price:   0.169, changePct: -4.01, longTraders: 52, shortTraders: 48, longPos:     7_290_000, shortPos:     6_720_000 },
  { id: 'BNB',     symbol: 'BNB',         iconText: 'B',  volumeUSD:   120_000_000, price:  570,    changePct: -1.50, longTraders: 50, shortTraders: 50, longPos:    60_000_000, shortPos:    60_000_000 },
  { id: 'VÀNG',    symbol: 'VÀNG (XAU)',  iconText: 'Au', volumeUSD:    10_770_000, price: 4_824,   changePct: -0.83, longTraders: 44, shortTraders: 56, longPos:     9_400_000, shortPos:    11_970_000 },
  { id: 'SP500',   symbol: 'SP500',       iconText: 'S&P',volumeUSD:   541_000_000, price: 7_030,   changePct:  0.84, longTraders: 75, shortTraders: 25, longPos:    45_040_000, shortPos:     5_760_000 },
  { id: 'BẠC',    symbol: 'BẠC (Silver)',iconText: 'Ag', volumeUSD:   119_000_000, price:  79.84,  changePct:  0.63, longTraders: 44, shortTraders: 56, longPos:       843_880, shortPos:     6_090_000 },
  { id: 'XYZ100', symbol: 'XYZ100',      iconText: '100',volumeUSD:    58_429_000, price: 26_270,  changePct:  1.60, longTraders: 57, shortTraders: 43, longPos:    23_460_000, shortPos:       160_390 },
  { id: 'BRENTOIL',symbol:'BRENTOIL',    iconText: 'B',  volumeUSD:    47_037_000, price:  91.87,  changePct:  0.41, longTraders: 90, shortTraders: 10, longPos:     7_270_000, shortPos:       183_750 },
  { id: 'SNDK',   symbol: 'SNDK',        iconText: 'S',  volumeUSD:    28_308_000, price: 903.54,  changePct: -2.87, longTraders:  0, shortTraders:100, longPos:             0, shortPos:     2_610_000 },
  { id: 'MŨTRÒM', symbol: 'MŨ TRÒM',    iconText: 'M',  volumeUSD:    30_192_000, price:  89.63,  changePct:  6.51, longTraders:  0, shortTraders:100, longPos:             0, shortPos:       132_080 },
  { id: 'DẦU',    symbol: 'DẦU',         iconText: '⛽', volumeUSD:    17_660_000, price:  89.23,  changePct:  0.36, longTraders:  0, shortTraders:  0, longPos:             0, shortPos:             0 },
];

/* ── Column definitions ──────────────────────────────────────── */
const COLUMNS = [
  { id: 'watch',        label: '',                  icon: null,  align: 'left',  sortable: false },
  { id: 'symbol',       label: 'Mã thông báo',      icon: null,  align: 'left',  sortable: false },
  { id: 'volumeUSD',    label: 'Khối lượng USD',     icon: null,  align: 'right', sortable: true  },
  { id: 'price',        label: 'Giá (% thay đổi)',   icon: null,  align: 'right', sortable: true  },
  { id: 'longTraders',  label: 'Nhà GD dài hạn',     icon: null,  align: 'right', sortable: true  },
  { id: 'shortTraders', label: 'Nhà GD bán khống',   icon: null,  align: 'right', sortable: true  },
  { id: 'longPos',      label: 'Vị thế mua ($)',      icon: null,  align: 'right', sortable: true  },
  { id: 'shortPos',     label: 'Quản short ($)',      icon: null,  align: 'right', sortable: true  },
];

const TIME_PERIODS   = ['5 phút', '10 phút', '1 giờ', '6 giờ', '24 giờ', '7D', '30D'];
const SCREENER_TABS  = ['Mặc định', 'Xu hướng', 'Danh sách theo dõi'];
const FILTER_CHIPS   = [
  { id: 'sieulong', label: '↔ Siêu lòng' },
  { id: 'diem',     label: 'Điểm' },
  { id: 'toipham',  label: 'Tội phạm' },
];

/* ── Trend helpers ──────────────────────────────────────────── */
function trendMeta(changePct) {
  if (changePct >= 5)  return { icon: '🔥', text: 'Rất hot',    cls: 'tr-hot'  };
  if (changePct >= 2)  return { icon: '📈', text: 'Tăng mạnh', cls: 'tr-up'   };
  if (changePct >= 0)  return { icon: '↗',  text: 'Tăng nhẹ',  cls: 'tr-mild' };
  if (changePct >= -2) return { icon: '↘',  text: 'Giảm nhẹ',  cls: 'tr-mild-down' };
  if (changePct >= -5) return { icon: '📉', text: 'Giảm mạnh', cls: 'tr-down' };
  return                       { icon: '❄️', text: 'Lạnh',      cls: 'tr-cold' };
}

function hotScore(t) {
  return Math.abs(t.changePct) * Math.log10(Math.max(t.volumeUSD, 10));
}

/* ── Trend card ─────────────────────────────────────────────── */
function TrendCard({ token, rank }) {
  const isPos = token.changePct >= 0;
  const meta  = trendMeta(token.changePct);
  const maxVol = 10_000_000_000;
  const volBar = Math.min(token.volumeUSD / maxVol, 1) * 100;
  return (
    <div className="tr-card">
      <div className="tr-card-top">
        <span className="tr-rank">#{rank}</span>
        <span className="tr-token-icon" style={{ background: tokenColor(token.id) }}>
          {token.iconText}
        </span>
        <div className="tr-card-info">
          <span className="tr-card-symbol">{token.symbol}</span>
          <span className={`tr-badge ${meta.cls}`}>{meta.icon} {meta.text}</span>
        </div>
        <div className="tr-card-right">
          <span className="tr-card-price">{fmtPrice(token.price)}</span>
          <span className={`tr-card-change ${isPos ? 'tr-up' : 'tr-down'}`}>
            {fmtPct(token.changePct)}
          </span>
        </div>
      </div>
      <div className="tr-card-bottom">
        <span className="tr-vol-label">Vol: {fmtMoney(token.volumeUSD)}</span>
        <div className="tr-vol-bar-wrap">
          <div
            className={`tr-vol-bar ${isPos ? 'tr-vol-bar--up' : 'tr-vol-bar--down'}`}
            style={{ width: `${volBar}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Xu hướng tab ───────────────────────────────────────────── */
function TrendTab({ data }) {
  const sorted     = [...data].sort((a, b) => hotScore(b) - hotScore(a));
  const gainers    = [...data].filter(t => t.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const losers     = [...data].filter(t => t.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 5);
  const mostActive = [...data].sort((a, b) => b.volumeUSD - a.volumeUSD).slice(0, 5);

  const avgChange  = data.reduce((s, t) => s + t.changePct, 0) / data.length;
  const totalVol   = data.reduce((s, t) => s + t.volumeUSD, 0);
  const bullCount  = data.filter(t => t.changePct > 0).length;
  const bearCount  = data.filter(t => t.changePct < 0).length;
  const bullPct    = Math.round(bullCount / data.length * 100);

  return (
    <div className="tr-tab-wrap">

      <div className="tr-market-overview">
        <div className="tr-market-stat">
          <span className="tr-stat-label">Trung bình thay đổi</span>
          <span className={`tr-stat-val ${avgChange >= 0 ? 'tr-up' : 'tr-down'}`}>
            {fmtPct(avgChange)}
          </span>
        </div>
        <div className="tr-market-stat">
          <span className="tr-stat-label">Tổng khối lượng</span>
          <span className="tr-stat-val">{fmtMoney(totalVol)}</span>
        </div>
        <div className="tr-market-stat">
          <span className="tr-stat-label">Tâm lý thị trường</span>
          <div className="tr-sentiment-bar-wrap">
            <div className="tr-sentiment-bar">
              <div className="tr-sentiment-bull" style={{ width: `${bullPct}%` }} />
            </div>
            <span className="tr-sentiment-labels">
              <span className="tr-up">▲ {bullCount} tăng</span>
              <span className="tr-down">▼ {bearCount} giảm</span>
            </span>
          </div>
        </div>
        <div className="tr-market-stat">
          <span className="tr-stat-label">Chỉ số Fear &amp; Greed</span>
          <div className="tr-fg-meter">
            <span className="tr-fg-val" style={{ color: avgChange > 2 ? '#f39c12' : avgChange > 0 ? '#2ecc71' : '#e74c3c' }}>
              {avgChange > 3 ? '😱 Tham lam' : avgChange > 0 ? '😀 Lạc quan' : avgChange > -3 ? '😰 Sợ hãi' : '💀 Cực sợ'}
            </span>
          </div>
        </div>
      </div>

      <div className="tr-section">
        <div className="tr-section-header">
          <span className="tr-section-title">🔥 Đang nóng nhất</span>
          <span className="tr-section-desc">Xếp hạng theo điểm xu hướng (biến động × khối lượng)</span>
        </div>
        <div className="tr-cards-grid">
          {sorted.slice(0, 6).map((t, i) => (
            <TrendCard key={t.id} token={t} rank={i + 1} />
          ))}
        </div>
      </div>

      <div className="tr-two-col">
        <div className="tr-section">
          <div className="tr-section-header">
            <span className="tr-section-title tr-up">📈 Top tăng mạnh</span>
          </div>
          <div className="tr-rank-list">
            {gainers.map((t, i) => (
              <div key={t.id} className="tr-rank-row">
                <span className="tr-rank-num">{i + 1}</span>
                <span className="tr-rank-icon" style={{ background: tokenColor(t.id) }}>{t.iconText}</span>
                <span className="tr-rank-sym">{t.symbol}</span>
                <span className="tr-rank-price">{fmtPrice(t.price)}</span>
                <span className="tr-rank-change tr-up">{fmtPct(t.changePct)}</span>
              </div>
            ))}
            {gainers.length === 0 && <div className="tr-empty">Không có token tăng</div>}
          </div>
        </div>

        <div className="tr-section">
          <div className="tr-section-header">
            <span className="tr-section-title tr-down">📉 Top giảm mạnh</span>
          </div>
          <div className="tr-rank-list">
            {losers.map((t, i) => (
              <div key={t.id} className="tr-rank-row">
                <span className="tr-rank-num">{i + 1}</span>
                <span className="tr-rank-icon" style={{ background: tokenColor(t.id) }}>{t.iconText}</span>
                <span className="tr-rank-sym">{t.symbol}</span>
                <span className="tr-rank-price">{fmtPrice(t.price)}</span>
                <span className="tr-rank-change tr-down">{fmtPct(t.changePct)}</span>
              </div>
            ))}
            {losers.length === 0 && <div className="tr-empty">Không có token giảm</div>}
          </div>
        </div>
      </div>

      <div className="tr-section">
        <div className="tr-section-header">
          <span className="tr-section-title">⚡ Hoạt động nhiều nhất</span>
          <span className="tr-section-desc">Khối lượng giao dịch lớn nhất trong 24 giờ</span>
        </div>
        <div className="tr-activity-list">
          {mostActive.map(t => {
            const isPos = t.changePct >= 0;
            const barW  = Math.round(t.volumeUSD / mostActive[0].volumeUSD * 100);
            return (
              <div key={t.id} className="tr-activity-row">
                <span className="tr-rank-icon" style={{ background: tokenColor(t.id) }}>{t.iconText}</span>
                <span className="tr-rank-sym">{t.symbol}</span>
                <div className="tr-act-bar-wrap">
                  <div
                    className={`tr-act-bar ${isPos ? 'tr-vol-bar--up' : 'tr-vol-bar--down'}`}
                    style={{ width: `${barW}%` }}
                  />
                </div>
                <span className="tr-act-vol">{fmtMoney(t.volumeUSD)}</span>
                <span className={`tr-rank-change ${isPos ? 'tr-up' : 'tr-down'}`}>
                  {fmtPct(t.changePct)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

/* ── Watchlist tab ──────────────────────────────────────────── */
function WatchlistTab({ data, watchlist, onRemove, sortBy, sortDir, onSort }) {
  const watched = useMemo(
    () => data.filter(t => watchlist.has(t.id)),
    [data, watchlist],
  );
  const sorted = useMemo(() => {
    return [...watched].sort((a, b) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [watched, sortBy, sortDir]);

  if (watchlist.size === 0) {
    return (
      <div className="wl-empty">
        <div className="wl-empty-icon">☆</div>
        <p className="wl-empty-title">Danh sách theo dõi trống</p>
        <p className="wl-empty-desc">
          Chuyển sang tab <strong>Mặc định</strong> và nhấn <span className="wl-star-hint">☆</span> bên cạnh token để thêm vào đây.
        </p>
      </div>
    );
  }

  const WL_COLS = COLUMNS.slice(1);
  return (
    <div className="screener-table-wrap">
      <table className="screener-table">
        <thead>
          <tr>
            {WL_COLS.map(col => (
              <th
                key={col.id}
                className={[
                  'sc-th',
                  col.align === 'right' ? 'sc-th--r' : '',
                  col.sortable ? 'sc-th--sort' : '',
                  sortBy === col.id ? 'sc-th--active' : '',
                ].join(' ')}
                onClick={() => col.sortable && onSort(col.id)}
              >
                <span className="sc-th-inner">
                  {col.label}
                  {col.sortable && (
                    <span className="sc-th-sort-icon">
                      {sortBy === col.id ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  )}
                </span>
              </th>
            ))}
            <th className="sc-th sc-th--r" style={{ width: 48 }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(token => {
            const isPos = token.changePct >= 0;
            return (
              <tr key={token.id} className="sc-row">
                <td className="sc-td sc-td--token">
                  <div className="sc-token-cell">
                    <span className="sc-token-icon" style={{ background: tokenColor(token.id) }}>
                      {token.iconText}
                    </span>
                    <span className="sc-token-name">{token.symbol}</span>
                    {token._live && <span className="sc-live-dot" title="Dữ liệu thực" />}
                  </div>
                </td>
                <td className="sc-td sc-td--r">{fmtMoney(token.volumeUSD)}</td>
                <td className="sc-td sc-td--r">
                  <span className="sc-price">{fmtPrice(token.price)}</span>
                  <span className={`sc-change ${isPos ? 'sc-change--up' : 'sc-change--down'}`}>
                    {fmtPct(token.changePct)}
                  </span>
                </td>
                <td className="sc-td sc-td--r sc-td--num">
                  <span className={token.longTraders > token.shortTraders ? 'sc-long' : ''}>{token.longTraders}%</span>
                </td>
                <td className="sc-td sc-td--r sc-td--num">
                  <span className={token.shortTraders > token.longTraders ? 'sc-short' : ''}>{token.shortTraders}%</span>
                </td>
                <td className="sc-td sc-td--r">{token.longPos > 0 ? fmtMoney(token.longPos) : '—'}</td>
                <td className="sc-td sc-td--r">{token.shortPos > 0 ? fmtMoney(token.shortPos) : '—'}</td>
                <td className="sc-td sc-td--r">
                  <button
                    className="wl-remove-btn"
                    title="Xoá khỏi danh sách"
                    onClick={() => onRemove(token.id)}
                  >✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Token row (Mặc định) ────────────────────────────────────── */
function TokenRow({ token, watched, onToggle }) {
  const isPos = token.changePct >= 0;
  return (
    <tr className="sc-row">
      <td className="sc-td sc-td--watch">
        <button
          className={`wl-star-btn ${watched ? 'wl-star-btn--on' : ''}`}
          title={watched ? 'Xoá khỏi danh sách theo dõi' : 'Thêm vào danh sách theo dõi'}
          onClick={() => onToggle(token.id)}
        >
          {watched ? '★' : '☆'}
        </button>
      </td>

      <td className="sc-td sc-td--token">
        <div className="sc-token-cell">
          <span className="sc-token-icon" style={{ background: tokenColor(token.id) }}>
            {token.iconText}
          </span>
          <span className="sc-token-name">{token.symbol}</span>
          {token._live && <span className="sc-live-dot" title="Dữ liệu thực từ Bybit" />}
        </div>
      </td>

      <td className="sc-td sc-td--r">{fmtMoney(token.volumeUSD)}</td>

      <td className="sc-td sc-td--r">
        <span className="sc-price">{fmtPrice(token.price)}</span>
        <span className={`sc-change ${isPos ? 'sc-change--up' : 'sc-change--down'}`}>
          {fmtPct(token.changePct)}
        </span>
      </td>

      <td className="sc-td sc-td--r sc-td--num">
        <span className={token.longTraders > token.shortTraders ? 'sc-long' : ''}>{token.longTraders}%</span>
      </td>
      <td className="sc-td sc-td--r sc-td--num">
        <span className={token.shortTraders > token.longTraders ? 'sc-short' : ''}>{token.shortTraders}%</span>
      </td>
      <td className="sc-td sc-td--r">{token.longPos > 0 ? fmtMoney(token.longPos) : '—'}</td>
      <td className="sc-td sc-td--r">{token.shortPos > 0 ? fmtMoney(token.shortPos) : '—'}</td>
    </tr>
  );
}

/* ── localStorage helpers ───────────────────────────────────── */
function loadWatchlist() {
  try { return new Set(JSON.parse(localStorage.getItem('sc_watchlist') || '[]')); }
  catch { return new Set(); }
}
function saveWatchlist(set) {
  localStorage.setItem('sc_watchlist', JSON.stringify([...set]));
}

/* ── Main component ──────────────────────────────────────────── */
export default function TokenScreener() {
  const [period,     setPeriod]     = useState('24 giờ');
  const [tab,        setTab]        = useState('Mặc định');
  const [activeChip, setActiveChip] = useState('toipham');
  const [smartMoney, setSmartMoney] = useState(true);
  const [paused,     setPaused]     = useState(false);   // live by default
  const [sortBy,     setSortBy]     = useState('volumeUSD');
  const [sortDir,    setSortDir]    = useState('desc');
  const [data,       setData]       = useState(INITIAL_DATA);
  const [watchlist,  setWatchlist]  = useState(loadWatchlist);
  const [loading,    setLoading]    = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const fetchingRef = useRef(false);

  const refreshBybit = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const tickerMap = await fetchBybitTickers();
      if (Object.keys(tickerMap).length === 0) return;

      // Fetch account ratios for all crypto symbols in parallel
      const ratioEntries = await Promise.all(
        Object.entries(BYBIT_SYMBOL_MAP).map(async ([id, sym]) => {
          const ratio = await fetchBybitRatio(sym);
          return [sym, ratio];
        })
      );
      const ratioMap = Object.fromEntries(ratioEntries);

      setData(prev => prev.map(token => {
        if (!BYBIT_IDS.has(token.id)) return token;
        const sym    = BYBIT_SYMBOL_MAP[token.id];
        const ticker = tickerMap[sym];
        if (!ticker) return token;
        return applyBybitTick(token, ticker, ratioMap[sym]);
      }));
      setLastUpdate(new Date());
    } catch (err) {
      console.error('[Bybit]', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => { refreshBybit(); }, [refreshBybit]);

  // Poll every 30s when LIVE mode
  useEffect(() => {
    if (paused) return;
    const id = setInterval(refreshBybit, 30_000);
    return () => clearInterval(id);
  }, [paused, refreshBybit]);

  function handleSort(colId) {
    if (sortBy === colId) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(colId);
      setSortDir('desc');
    }
  }

  function toggleWatch(id) {
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveWatchlist(next);
      return next;
    });
  }

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [data, sortBy, sortDir]);

  const watchCount = watchlist.size;

  const updateTimeStr = lastUpdate
    ? lastUpdate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <section className="screener-panel">

      {/* ── Header ── */}
      <div className="screener-header">
        <div className="screener-title-row">
          <span className="screener-title">Trình sàng lọc mã thông báo</span>
          <span className="screener-title-arrow">›</span>
          <button
            className={`screener-status-btn ${paused ? 'screener-status-btn--paused' : 'screener-status-btn--live'}`}
            onClick={() => setPaused(p => !p)}
            title={paused ? 'Nhấp để bắt đầu cập nhật' : 'Nhấp để tạm dừng'}
          >
            {paused ? 'TẠM DỪNG' : (loading ? '⟳ ĐANG TẢI...' : '● TRỰC TIẾP')}
          </button>
          {updateTimeStr && (
            <span className="screener-last-update">Cập nhật: {updateTimeStr}</span>
          )}
          <button
            className="screener-refresh-btn"
            onClick={refreshBybit}
            disabled={loading}
            title="Làm mới ngay"
          >
            {loading ? '⟳' : '↻'}
          </button>
        </div>

        <div className="screener-periods">
          {TIME_PERIODS.map(p => (
            <button
              key={p}
              className={`screener-period-btn ${period === p ? 'screener-period-btn--active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
          <span className="screener-period-divider" />
          <button className="screener-period-btn screener-period-btn--code" title="Xem mã nhúng">
            {'</>'}
          </button>
        </div>
      </div>

      {/* ── Sub-tabs ── */}
      <div className="screener-subtabs">
        {SCREENER_TABS.map(t => (
          <button
            key={t}
            className={`screener-subtab ${tab === t ? 'screener-subtab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
            {t === 'Danh sách theo dõi' && watchCount > 0 && (
              <span className="sc-wl-count">{watchCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Bộ lọc (chỉ hiện ở Mặc định) ── */}
      {tab === 'Mặc định' && (
        <div className="screener-filters-row">
          <div className="screener-chips">
            {FILTER_CHIPS.map(f => (
              <button
                key={f.id}
                className={`screener-chip ${activeChip === f.id ? 'screener-chip--active' : ''}`}
                onClick={() => setActiveChip(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="screener-smart-money">
            <label className="sc-toggle-label">
              <input
                type="checkbox"
                className="sc-toggle-input"
                checked={smartMoney}
                onChange={e => setSmartMoney(e.target.checked)}
              />
              <span className="sc-toggle-track" />
            </label>
            <span className="screener-smart-label">Tiền thông minh</span>
            <span className="screener-hint-icon" title="Hiển thị dữ liệu giao dịch của tổ chức lớn">ⓘ</span>
          </div>
        </div>
      )}

      {/* ── Nội dung theo tab ── */}
      {tab === 'Mặc định' && (
        <div className="screener-table-wrap">
          <table className="screener-table">
            <thead>
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.id}
                    className={[
                      'sc-th',
                      col.id === 'watch' ? 'sc-th--watch' : '',
                      col.align === 'right' ? 'sc-th--r' : '',
                      col.sortable ? 'sc-th--sort' : '',
                      sortBy === col.id ? 'sc-th--active' : '',
                    ].join(' ')}
                    onClick={() => col.sortable && handleSort(col.id)}
                  >
                    {col.id !== 'watch' && (
                      <span className="sc-th-inner">
                        {col.label}
                        {col.sortable && (
                          <span className="sc-th-sort-icon">
                            {sortBy === col.id ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}
                          </span>
                        )}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(token => (
                <TokenRow
                  key={token.id}
                  token={token}
                  watched={watchlist.has(token.id)}
                  onToggle={toggleWatch}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Xu hướng' && <TrendTab data={data} />}

      {tab === 'Danh sách theo dõi' && (
        <WatchlistTab
          data={data}
          watchlist={watchlist}
          onRemove={toggleWatch}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      )}

      {/* ── Footer ── */}
      <div className="screener-footer">
        {tab === 'Mặc định' && <span>{sorted.length} mã thông báo</span>}
        {tab === 'Xu hướng' && <span>{data.length} mã thông báo đang theo dõi xu hướng</span>}
        {tab === 'Danh sách theo dõi' && (
          <span>{watchCount > 0 ? `${watchCount} token trong danh sách` : 'Danh sách trống'}</span>
        )}
        <span>Bybit Futures · cập nhật mỗi 30 giây</span>
        {!paused && <span className="screener-footer-live">● Đang cập nhật</span>}
      </div>

    </section>
  );
}
