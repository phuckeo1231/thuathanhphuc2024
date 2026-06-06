import { useState, useEffect, useCallback } from 'react';

const API_URL =
  'https://api.coingecko.com/api/v3/coins/markets' +
  '?vs_currency=usd&category=binance-smart-chain' +
  '&order=market_cap_desc&per_page=12&page=1' +
  '&sparkline=false&price_change_percentage=24h';

function fmtPrice(n) {
  if (n == null) return '—';
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1)    return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(4);
  return '$' + n.toPrecision(3);
}

function fmtBig(n) {
  if (!n) return '—';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  return '$' + (n / 1e3).toFixed(1) + 'K';
}

/* ── Thẻ mini cho từng token ── */
function TokenMiniCard({ coin }) {
  const change = coin.price_change_percentage_24h;
  const isUp   = change >= 0;
  return (
    <div style={S.card}>
      <div style={S.cardTop}>
        <img src={coin.image} alt={coin.symbol} style={S.coinImg} />
        <div style={S.cardNames}>
          <span style={S.cardSymbol}>{coin.symbol.toUpperCase()}</span>
          <span style={S.cardName}>{coin.name}</span>
        </div>
      </div>
      <div style={S.cardPrice}>{fmtPrice(coin.current_price)}</div>
      <div style={{ ...S.cardChange, color: isUp ? 'var(--green)' : 'var(--red)', background: isUp ? 'rgba(46,204,113,.12)' : 'rgba(231,76,60,.12)' }}>
        {change != null ? (isUp ? '+' : '') + change.toFixed(2) + '%' : '—'}
      </div>
    </div>
  );
}

/* ── Thẻ BNB nổi bật ── */
function BnbHighlight({ coin }) {
  if (!coin) return null;
  const change = coin.price_change_percentage_24h;
  const isUp   = change >= 0;
  return (
    <div style={S.bnbCard}>
      <div style={S.bnbLeft}>
        <img src={coin.image} alt="BNB" style={S.bnbImg} />
        <div>
          <div style={S.bnbLabel}>BNB · BNB Smart Chain</div>
          <div style={S.bnbPrice}>{fmtPrice(coin.current_price)}</div>
        </div>
      </div>
      <div style={{ ...S.bnbChange, color: isUp ? 'var(--green)' : 'var(--red)', background: isUp ? 'rgba(46,204,113,.12)' : 'rgba(231,76,60,.12)' }}>
        {isUp ? '▲' : '▼'} {change != null ? Math.abs(change).toFixed(2) + '%' : '—'} <span style={{ fontSize: 11, opacity: 0.7 }}>24h</span>
      </div>
    </div>
  );
}

export default function BscMarketSummary({ onViewAll }) {
  const [coins,      setCoins]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetch_ = useCallback(async () => {
    try {
      setError(null);
      const res  = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCoins(data);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 60_000);
    return () => clearInterval(id);
  }, [fetch_]);

  const bnb      = coins.find(c => c.symbol === 'bnb');
  const others   = coins.filter(c => c.symbol !== 'bnb').slice(0, 9);

  /* Tính tổng market cap & volume từ 12 token đầu */
  const totalMCap = coins.reduce((s, c) => s + (c.market_cap || 0), 0);
  const totalVol  = coins.reduce((s, c) => s + (c.total_volume || 0), 0);
  const gainers   = coins.filter(c => (c.price_change_percentage_24h ?? 0) > 0).length;
  const losers    = coins.filter(c => (c.price_change_percentage_24h ?? 0) < 0).length;

  return (
    <section style={S.wrap}>

      {/* ── Tiêu đề ── */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.dot} />
          <span style={S.title}>Thị trường BSC</span>
          {lastUpdate && (
            <span style={S.updated}>· {lastUpdate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </div>
        <button style={S.viewAllBtn} onClick={onViewAll}>
          Xem tất cả →
        </button>
      </div>

      {/* ── Lỗi ── */}
      {error && !loading && (
        <div style={S.errorBox}>
          ⚠ Không tải được dữ liệu CoinGecko: {error} ·{' '}
          <button style={S.retryBtn} onClick={fetch_}>Thử lại</button>
        </div>
      )}

      {/* ── Skeleton loading ── */}
      {loading && (
        <div style={S.skeletonWrap}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={S.skeleton} />
          ))}
        </div>
      )}

      {/* ── Nội dung ── */}
      {!loading && coins.length > 0 && (
        <>
          {/* Hàng 1: BNB nổi bật + thống kê nhanh */}
          <div style={S.topRow}>
            <BnbHighlight coin={bnb} />

            <div style={S.statsRow}>
              <div style={S.statItem}>
                <span style={S.statLabel}>Tổng Market Cap (top 12)</span>
                <span style={S.statValue}>{fmtBig(totalMCap)}</span>
              </div>
              <div style={S.statDivider} />
              <div style={S.statItem}>
                <span style={S.statLabel}>Tổng Volume 24h</span>
                <span style={S.statValue}>{fmtBig(totalVol)}</span>
              </div>
              <div style={S.statDivider} />
              <div style={S.statItem}>
                <span style={S.statLabel}>Tăng / Giảm</span>
                <span style={S.statValue}>
                  <span style={{ color: 'var(--green)' }}>▲{gainers}</span>
                  {' / '}
                  <span style={{ color: 'var(--red)' }}>▼{losers}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Hàng 2: grid token mini cards */}
          <div style={S.grid}>
            {others.map(coin => (
              <TokenMiniCard key={coin.id} coin={coin} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ── Styles ── */
const S = {
  wrap: {
    gridColumn: '1 / -1',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    padding: '14px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: {
    width: 8, height: 8, borderRadius: '50%',
    background: 'var(--green)', boxShadow: '0 0 6px var(--green)',
    animation: 'pulse 2s infinite',
  },
  title:    { fontSize: 13, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5 },
  updated:  { fontSize: 11, color: 'var(--muted)' },
  viewAllBtn: {
    background: 'none', border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--accent)', fontSize: 12, padding: '4px 10px', cursor: 'pointer',
    transition: 'border-color .15s',
  },

  errorBox: {
    background: 'rgba(231,76,60,.1)', border: '1px solid rgba(231,76,60,.25)',
    borderRadius: 7, padding: '8px 12px', color: 'var(--red)', fontSize: 12,
  },
  retryBtn: {
    background: 'none', border: '1px solid var(--red)', borderRadius: 4,
    color: 'var(--red)', padding: '1px 6px', cursor: 'pointer', fontSize: 11,
  },

  skeletonWrap: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  skeleton: {
    width: 110, height: 78, borderRadius: 8,
    background: 'linear-gradient(90deg,var(--surface-2) 25%,var(--border) 50%,var(--surface-2) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
  },

  /* BNB highlight */
  topRow: { display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' },
  bnbCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, background: 'var(--surface-2)', border: '1px solid rgba(240,185,11,.25)',
    borderRadius: 10, padding: '10px 16px', minWidth: 240, flex: '0 0 auto',
  },
  bnbLeft:  { display: 'flex', alignItems: 'center', gap: 10 },
  bnbImg:   { width: 36, height: 36, borderRadius: '50%' },
  bnbLabel: { fontSize: 11, color: 'var(--muted)', marginBottom: 2 },
  bnbPrice: { fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' },
  bnbChange: {
    fontSize: 14, fontWeight: 700, padding: '4px 10px',
    borderRadius: 7, whiteSpace: 'nowrap',
  },

  /* Thống kê nhanh */
  statsRow: {
    display: 'flex', alignItems: 'center', gap: 0,
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 10, flex: 1, minWidth: 0, flexWrap: 'wrap',
  },
  statItem: {
    display: 'flex', flexDirection: 'column', gap: 3,
    padding: '8px 20px', flex: 1,
  },
  statDivider: { width: 1, height: 32, background: 'var(--border)', flexShrink: 0 },
  statLabel:   { fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue:   { fontSize: 15, fontWeight: 700, color: 'var(--text)' },

  /* Grid token mini */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: 8,
  },
  card: {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '8px 10px',
    display: 'flex', flexDirection: 'column', gap: 4,
    cursor: 'default', transition: 'border-color .15s',
  },
  cardTop:    { display: 'flex', alignItems: 'center', gap: 6 },
  coinImg:    { width: 22, height: 22, borderRadius: '50%', flexShrink: 0 },
  cardNames:  { display: 'flex', flexDirection: 'column', minWidth: 0 },
  cardSymbol: { fontSize: 12, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 },
  cardName:   { fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardPrice:  { fontSize: 12, fontFamily: 'monospace', color: 'var(--text)', fontWeight: 600 },
  cardChange: { fontSize: 11, fontWeight: 700, padding: '2px 5px', borderRadius: 5, textAlign: 'center' },
};
