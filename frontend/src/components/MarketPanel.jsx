import { useState, useEffect, useCallback } from 'react';

const API_URL =
  'https://api.coingecko.com/api/v3/coins/markets' +
  '?vs_currency=usd&category=binance-smart-chain' +
  '&order=market_cap_desc&per_page=50&page=1' +
  '&sparkline=false&price_change_percentage=24h';

function fmt(n, opts = {}) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', opts).format(n);
}

function fmtPrice(n) {
  if (n == null) return '—';
  if (n >= 1)    return '$' + fmt(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 0.01) return '$' + fmt(n, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return '$' + fmt(n, { minimumFractionDigits: 6, maximumFractionDigits: 8 });
}

function fmtBig(n) {
  if (n == null) return '—';
  if (n >= 1e9) return '$' + fmt(n / 1e9, { maximumFractionDigits: 2 }) + 'B';
  if (n >= 1e6) return '$' + fmt(n / 1e6, { maximumFractionDigits: 2 }) + 'M';
  if (n >= 1e3) return '$' + fmt(n / 1e3, { maximumFractionDigits: 2 }) + 'K';
  return '$' + fmt(n, { maximumFractionDigits: 2 });
}

const SORT_KEYS = {
  market_cap:       (a, b) => b.market_cap - a.market_cap,
  current_price:    (a, b) => b.current_price - a.current_price,
  price_change_24h: (a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h,
  total_volume:     (a, b) => b.total_volume - a.total_volume,
  name:             (a, b) => a.name.localeCompare(b.name),
};

/**
 * compact=true  → widget nhúng vào dashboard (10 dòng, không phân trang)
 * compact=false → trang đầy đủ với tìm kiếm + phân trang
 */
export default function MarketPanel({ compact = false, onViewAll }) {
  const [coins,      setCoins]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [search,     setSearch]     = useState('');
  const [sortKey,    setSortKey]    = useState('market_cap');
  const [sortDir,    setSortDir]    = useState(1);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [page,       setPage]       = useState(1);
  const PER_PAGE = compact ? 10 : 20;

  const fetchCoins = useCallback(async () => {
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
    fetchCoins();
    const id = setInterval(fetchCoins, 60_000);
    return () => clearInterval(id);
  }, [fetchCoins]);

  function handleSort(key) {
    if (key === sortKey) setSortDir(d => d * -1);
    else { setSortKey(key); setSortDir(1); }
    setPage(1);
  }

  const filtered = coins.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.symbol.toLowerCase().includes(search.toLowerCase())
  );
  const sorted     = [...filtered].sort((a, b) => (SORT_KEYS[sortKey]?.(a, b) ?? 0) * sortDir);
  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paged      = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function SortArrow({ col }) {
    if (col !== sortKey) return <span style={{ color: 'var(--muted)', fontSize: 10 }}>⇅</span>;
    return <span style={{ color: 'var(--accent)', fontSize: 10 }}>{sortDir === 1 ? '↑' : '↓'}</span>;
  }

  /* ── Wrapper style — compact span full width của grid dashboard ── */
  const wrapStyle = compact
    ? { ...styles.wrap, gridColumn: '1 / -1', padding: '14px 20px', gap: 12 }
    : styles.wrap;

  return (
    <div style={wrapStyle}>

      {/* ── Header ── */}
      <div style={styles.header}>
        <div>
          <h2 style={{ ...styles.title, fontSize: compact ? 14 : 18 }}>
            Thị trường BSC
          </h2>
          {lastUpdate && (
            <span style={styles.updated}>
              Cập nhật: {lastUpdate.toLocaleTimeString('vi-VN')} · tự động sau 60s
            </span>
          )}
        </div>
        <div style={styles.headerRight}>
          {/* Chế độ đầy đủ: ô tìm kiếm */}
          {!compact && (
            <input
              style={styles.search}
              placeholder="Tìm token..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          )}
          <button style={styles.refreshBtn} onClick={fetchCoins} title="Làm mới">↺</button>
          {/* Compact: nút xem tất cả */}
          {compact && onViewAll && (
            <button style={styles.viewAllBtn} onClick={onViewAll}>
              Xem tất cả →
            </button>
          )}
        </div>
      </div>

      {/* ── Lỗi ── */}
      {error && (
        <div style={styles.errorBox}>
          ⚠ Không tải được dữ liệu: {error}.&nbsp;
          <button style={styles.retryBtn} onClick={fetchCoins}>Thử lại</button>
        </div>
      )}

      {/* ── Skeleton khi loading ── */}
      {loading && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 40 }}>#</th>
                <th style={{ ...styles.th, textAlign: 'left' }}>Token</th>
                <th style={styles.th}>Giá</th>
                <th style={styles.th}>24h %</th>
                <th style={styles.th}>Volume</th>
                <th style={styles.th}>Market Cap</th>
                <th style={styles.th}>BSCScan</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: compact ? 5 : 8 }).map((_, i) => (
                <tr key={i} className="market-skel-row">
                  <td><div className="skel" style={{ height: 12, width: 20 }} /></td>
                  <td>
                    <div className="market-skel-coin">
                      <div className="skel market-skel-img" />
                      <div className="market-skel-info">
                        <div className="skel market-skel-name" style={{ width: 80 }} />
                        <div className="skel market-skel-sym" style={{ width: 40 }} />
                      </div>
                    </div>
                  </td>
                  <td><div className="skel" style={{ height: 12, width: 70, marginLeft: 'auto' }} /></td>
                  <td><div className="skel" style={{ height: 12, width: 50, marginLeft: 'auto' }} /></td>
                  <td><div className="skel" style={{ height: 12, width: 65, marginLeft: 'auto' }} /></td>
                  <td><div className="skel" style={{ height: 12, width: 75, marginLeft: 'auto' }} /></td>
                  <td><div className="skel" style={{ height: 16, width: 20, margin: '0 auto' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Bảng ── */}
      {!loading && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 40 }}>#</th>
                <th style={{ ...styles.th, textAlign: 'left', cursor: 'pointer' }} onClick={() => handleSort('name')}>
                  Token <SortArrow col="name" />
                </th>
                <th style={{ ...styles.th, cursor: 'pointer' }} onClick={() => handleSort('current_price')}>
                  Giá <SortArrow col="current_price" />
                </th>
                <th style={{ ...styles.th, cursor: 'pointer' }} onClick={() => handleSort('price_change_24h')}>
                  24h % <SortArrow col="price_change_24h" />
                </th>
                <th style={{ ...styles.th, cursor: 'pointer' }} onClick={() => handleSort('total_volume')}>
                  Volume <SortArrow col="total_volume" />
                </th>
                <th style={{ ...styles.th, cursor: 'pointer' }} onClick={() => handleSort('market_cap')}>
                  Market Cap <SortArrow col="market_cap" />
                </th>
                <th style={styles.th}>BSCScan</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
                    Không tìm thấy token nào
                  </td>
                </tr>
              ) : paged.map((coin, i) => {
                const change      = coin.price_change_percentage_24h;
                const changeColor = change > 0 ? 'var(--green)' : change < 0 ? 'var(--red)' : 'var(--muted)';
                const rank        = (page - 1) * PER_PAGE + i + 1;
                return (
                  <tr key={coin.id} style={styles.row}>
                    <td style={{ ...styles.td, color: 'var(--muted)', fontSize: 12 }}>{rank}</td>
                    <td style={styles.td}>
                      <div style={styles.coinInfo}>
                        <img src={coin.image} alt={coin.symbol} style={styles.coinImg} />
                        <div>
                          <div style={styles.coinName}>{coin.name}</div>
                          <div style={styles.coinSymbol}>{coin.symbol.toUpperCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace' }}>
                      {fmtPrice(coin.current_price)}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: changeColor, fontWeight: 600 }}>
                      {change != null ? (change > 0 ? '+' : '') + change.toFixed(2) + '%' : '—'}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: 'var(--muted)' }}>
                      {fmtBig(coin.total_volume)}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {fmtBig(coin.market_cap)}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <a
                        href={`https://bscscan.com/token/${coin.platforms?.['binance-smart-chain'] || ''}`}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.link}
                        title="Xem trên BSCScan"
                      >
                        🔍
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Phân trang (chỉ chế độ đầy đủ) ── */}
      {!compact && totalPages > 1 && (
        <div style={styles.pagination}>
          <button style={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Trước</button>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>
            Trang {page} / {totalPages} ({filtered.length} token)
          </span>
          <button style={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Sau →</button>
        </div>
      )}

      {/* ── Footer compact: nút xem tất cả ── */}
      {compact && !loading && coins.length > 0 && onViewAll && (
        <div style={styles.compactFooter}>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            Hiển thị {paged.length} / {coins.length} token BSC hàng đầu
          </span>
          <button style={styles.viewAllBtn} onClick={onViewAll}>
            Xem đầy đủ →
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  header: {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
  },
  headerRight: { display: 'flex', gap: 8, alignItems: 'center' },
  title:   { fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginBottom: 2 },
  updated: { fontSize: 11, color: 'var(--muted)' },
  search: {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '6px 12px', color: 'var(--text)',
    fontSize: 13, outline: 'none', width: 200,
  },
  refreshBtn: {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '6px 10px', color: 'var(--accent)',
    cursor: 'pointer', fontSize: 16,
  },
  viewAllBtn: {
    background: 'none', border: '1px solid var(--border)',
    borderRadius: 6, padding: '6px 12px', color: 'var(--accent)',
    cursor: 'pointer', fontSize: 12, fontWeight: 600,
    transition: 'border-color .15s',
  },
  errorBox: {
    background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)',
    borderRadius: 8, padding: '10px 14px', color: 'var(--red)', fontSize: 13,
  },
  retryBtn: {
    background: 'none', border: '1px solid var(--red)', borderRadius: 4,
    color: 'var(--red)', padding: '2px 8px', cursor: 'pointer', fontSize: 12,
  },
  tableWrap: {
    background: 'var(--surface)', borderRadius: 10,
    border: '1px solid var(--border)', overflow: 'auto',
  },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    padding: '10px 14px', background: 'var(--surface-2)',
    color: 'var(--muted)', fontWeight: 600, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 0.5,
    borderBottom: '1px solid var(--border)', textAlign: 'right',
    whiteSpace: 'nowrap', userSelect: 'none',
  },
  td:        { padding: '10px 14px', borderBottom: '1px solid var(--border)' },
  row:       { transition: 'background 0.15s' },
  coinInfo:  { display: 'flex', alignItems: 'center', gap: 10 },
  coinImg:   { width: 28, height: 28, borderRadius: '50%', flexShrink: 0 },
  coinName:  { fontWeight: 600, color: 'var(--text)', fontSize: 13 },
  coinSymbol:{ color: 'var(--muted)', fontSize: 11 },
  link:      { fontSize: 16, textDecoration: 'none' },
  pagination: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 16, padding: '8px 0',
  },
  pageBtn: {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '6px 14px', color: 'var(--text)',
    cursor: 'pointer', fontSize: 13,
  },
  compactFooter: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: 4,
  },
};
