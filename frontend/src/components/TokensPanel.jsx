import { useState, useMemo } from 'react';
import { useMonitor } from '../context/MonitorContext.jsx';

function fmtAmount(raw) {
  const n = parseFloat(raw);
  if (isNaN(n) || n === 0) return '0';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 10_000)        return (n / 1_000).toFixed(1) + 'K';
  if (n >= 1)             return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (n > 0)              return n.toPrecision(4);
  return '0';
}

function timeAgoMs(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10)    return 'vừa nay';
  if (s < 60)    return `${s}s trước`;
  if (s < 3600)  return `${Math.floor(s / 60)}ph trước`;
  if (s < 86400) return `${Math.floor(s / 3600)}h trước`;
  return `${Math.floor(s / 86400)}d trước`;
}

/* Hàng expand: số dư từng ví cho 1 token */
function WalletBreakdown({ symbol, wallets, balances, recentChanges }) {
  const rows = wallets
    .map(w => {
      const key     = `${w.address}:${symbol}`;
      const balance = balances[key];
      if (!balance || balance === '—' || parseFloat(balance) === 0) return null;
      const lastChg = recentChanges.find(
        c => c.wallet?.address === w.address && c.token?.symbol === symbol
      );
      const delta = lastChg
        ? parseFloat(lastChg.current) - parseFloat(lastChg.previous)
        : null;
      return { wallet: w, balance, delta, lastChg };
    })
    .filter(Boolean);

  if (rows.length === 0) return (
    <tr>
      <td colSpan={6} style={S.breakEmpty}>Không có ví nào đang giữ {symbol}</td>
    </tr>
  );

  return rows.map(({ wallet, balance, delta, lastChg }) => (
    <tr key={wallet.address} style={S.breakRow}>
      <td style={S.breakIndent} />
      <td style={S.breakWallet}>
        <span style={S.breakLogo}>{wallet.logo || '💼'}</span>
        <div>
          <div style={S.breakLabel}>{wallet.label}</div>
          <div style={S.breakAddr}>{wallet.address.slice(0, 8)}…{wallet.address.slice(-4)}</div>
        </div>
      </td>
      <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace' }}>{fmtAmount(balance)}</td>
      <td style={{ ...S.td, textAlign: 'right' }}>
        {delta !== null && delta !== 0 ? (
          <span style={{ color: delta > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
            {delta > 0 ? '+' : ''}{fmtAmount(String(Math.abs(delta).toFixed(6)))}
          </span>
        ) : <span style={{ color: 'var(--muted)' }}>—</span>}
      </td>
      <td style={{ ...S.td, textAlign: 'right', color: 'var(--muted)', fontSize: 11 }}>
        {lastChg ? timeAgoMs(lastChg.timestamp) : '—'}
      </td>
      <td style={{ ...S.td, textAlign: 'center' }}>
        <a
          href={`https://bscscan.com/address/${wallet.address}`}
          target="_blank" rel="noreferrer"
          style={S.link}
          title="Xem ví trên BSCScan"
        >↗</a>
      </td>
    </tr>
  ));
}

/* Hàng chính của token */
function TokenRow({ token, wallets, balances, recentChanges, rank, sortKey }) {
  const [expanded, setExpanded] = useState(false);

  /* Tổng số dư + số ví giữ token này */
  const { total, walletCount } = useMemo(() => {
    let sum = 0, count = 0;
    for (const w of wallets) {
      const key = `${w.address}:${token.symbol}`;
      const val = parseFloat(balances[key] ?? 0);
      if (val > 0) { sum += val; count++; }
    }
    return { total: sum, walletCount: count };
  }, [token.symbol, wallets, balances]);

  /* Biến động gần nhất */
  const lastChange = useMemo(() =>
    recentChanges.find(c => c.token?.symbol === token.symbol),
    [recentChanges, token.symbol]
  );
  const delta    = lastChange
    ? parseFloat(lastChange.current) - parseFloat(lastChange.previous)
    : null;
  const hasAlert = delta !== null && Math.abs(delta) > 0;

  return (
    <>
      <tr
        style={{ ...S.row, background: expanded ? 'var(--surface-2)' : undefined }}
        onClick={() => setExpanded(e => !e)}
      >
        <td style={{ ...S.td, color: 'var(--muted)', fontSize: 12, width: 36 }}>{rank}</td>
        <td style={S.td}>
          <div style={S.tokenCell}>
            <span style={S.tokenIcon}>{token.symbol.slice(0, 3)}</span>
            <div>
              <div style={S.tokenSymbol}>{token.symbol}</div>
              {token.name && <div style={S.tokenName}>{token.name}</div>}
            </div>
            {hasAlert && <span style={S.liveDot} title="Có biến động gần đây" />}
          </div>
        </td>
        <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>
          {total > 0 ? fmtAmount(String(total)) : <span style={{ color: 'var(--muted)' }}>—</span>}
        </td>
        <td style={{ ...S.td, textAlign: 'center' }}>
          <span style={{
            background: walletCount > 0 ? 'rgba(240,185,11,.15)' : 'var(--surface-2)',
            color:      walletCount > 0 ? 'var(--accent)'         : 'var(--muted)',
            padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
          }}>{walletCount}</span>
        </td>
        <td style={{ ...S.td, textAlign: 'right' }}>
          {delta !== null && delta !== 0 ? (
            <span style={{ color: delta > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600, fontSize: 12 }}>
              {delta > 0 ? '+' : ''}{fmtAmount(String(Math.abs(delta).toFixed(6)))}
            </span>
          ) : <span style={{ color: 'var(--muted)' }}>—</span>}
        </td>
        <td style={{ ...S.td, textAlign: 'right', color: 'var(--muted)', fontSize: 11 }}>
          {lastChange ? timeAgoMs(lastChange.timestamp) : '—'}
        </td>
        <td style={{ ...S.td, textAlign: 'center' }}>
          <a
            href={`https://bscscan.com/token/${token.address}`}
            target="_blank" rel="noreferrer"
            style={S.link}
            title="Xem token trên BSCScan"
            onClick={e => e.stopPropagation()}
          >🔍</a>
        </td>
        <td style={{ ...S.td, textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>
          {expanded ? '▲' : '▼'}
        </td>
      </tr>

      {/* Hàng chi tiết theo ví */}
      {expanded && (
        <WalletBreakdown
          symbol={token.symbol}
          wallets={wallets}
          balances={balances}
          recentChanges={recentChanges}
        />
      )}
    </>
  );
}

const SORT_OPTIONS = [
  { id: 'symbol',      label: 'Tên' },
  { id: 'total',       label: 'Tổng số dư' },
  { id: 'walletCount', label: 'Số ví' },
  { id: 'lastChange',  label: 'Biến động' },
];

export default function TokensPanel() {
  const { tokens, wallets, balances, recentChanges } = useMonitor();
  const [search,  setSearch]  = useState('');
  const [sortKey, setSortKey] = useState('total');
  const [sortDir, setSortDir] = useState(-1); // -1 = desc

  /* Tính thêm derived data để sort */
  const enriched = useMemo(() => tokens.map(t => {
    let total = 0, walletCount = 0;
    for (const w of wallets) {
      const val = parseFloat(balances[`${w.address}:${t.symbol}`] ?? 0);
      if (val > 0) { total += val; walletCount++; }
    }
    const lastChange = recentChanges.find(c => c.token?.symbol === t.symbol);
    return { ...t, total, walletCount, lastChange: lastChange?.timestamp ?? 0 };
  }), [tokens, wallets, balances, recentChanges]);

  const filtered = useMemo(() =>
    enriched.filter(t =>
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      (t.name ?? '').toLowerCase().includes(search.toLowerCase())
    ),
    [enriched, search]
  );

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
      return (av - bv) * sortDir;
    });
  }, [filtered, sortKey, sortDir]);

  function handleSort(key) {
    if (key === sortKey) setSortDir(d => d * -1);
    else { setSortKey(key); setSortDir(-1); }
  }

  function SortIcon({ col }) {
    if (col !== sortKey) return <span style={{ color: 'var(--muted)', fontSize: 9 }}>⇅</span>;
    return <span style={{ color: 'var(--accent)', fontSize: 9 }}>{sortDir === -1 ? '↓' : '↑'}</span>;
  }

  const activeCount  = enriched.filter(t => t.total > 0).length;
  const totalChanged = recentChanges.length;

  return (
    <div style={S.wrap}>

      {/* ── Header ── */}
      <div style={S.header}>
        <div>
          <h2 style={S.title}>
            Danh sách Token
            <span style={S.countBadge}>{tokens.length}</span>
          </h2>
          <div style={S.subtitle}>
            <span style={{ color: 'var(--green)' }}>{activeCount} token</span> đang có số dư ·&nbsp;
            <span style={{ color: 'var(--accent)' }}>{totalChanged}</span> biến động trong phiên
          </div>
        </div>
        <input
          style={S.search}
          placeholder="Tìm token (symbol, tên)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Sort chips ── */}
      <div style={S.sortRow}>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>Sắp xếp:</span>
        {SORT_OPTIONS.map(o => (
          <button
            key={o.id}
            style={{
              ...S.chip,
              background: sortKey === o.id ? 'rgba(240,185,11,.15)' : 'var(--surface-2)',
              color:      sortKey === o.id ? 'var(--accent)'         : 'var(--muted)',
              borderColor: sortKey === o.id ? 'rgba(240,185,11,.4)'  : 'var(--border)',
            }}
            onClick={() => handleSort(o.id)}
          >
            {o.label} <SortIcon col={o.id} />
          </button>
        ))}
      </div>

      {/* ── Bảng ── */}
      {tokens.length === 0 ? (
        <div style={S.empty}>
          <p style={{ marginBottom: 8 }}>Chưa có token nào được theo dõi</p>
          <small style={{ color: 'var(--muted)', fontSize: 12 }}>
            Token xuất hiện khi backend phát hiện số dư trong các ví đang theo dõi
          </small>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 36 }}>#</th>
                <th style={{ ...S.th, textAlign: 'left', cursor: 'pointer' }} onClick={() => handleSort('symbol')}>
                  Token <SortIcon col="symbol" />
                </th>
                <th style={{ ...S.th, cursor: 'pointer' }} onClick={() => handleSort('total')}>
                  Tổng số dư <SortIcon col="total" />
                </th>
                <th style={{ ...S.th, cursor: 'pointer' }} onClick={() => handleSort('walletCount')}>
                  Số ví <SortIcon col="walletCount" />
                </th>
                <th style={S.th}>Biến động gần nhất</th>
                <th style={{ ...S.th, cursor: 'pointer' }} onClick={() => handleSort('lastChange')}>
                  Thời gian <SortIcon col="lastChange" />
                </th>
                <th style={S.th}>BSCScan</th>
                <th style={{ ...S.th, width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...S.td, textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
                    Không tìm thấy token "{search}"
                  </td>
                </tr>
              ) : sorted.map((token, i) => (
                <TokenRow
                  key={token.symbol}
                  rank={i + 1}
                  token={token}
                  wallets={wallets}
                  balances={balances}
                  recentChanges={recentChanges}
                  sortKey={sortKey}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={S.footer}>
        {sorted.length} token · Click vào hàng để xem chi tiết theo ví
      </div>
    </div>
  );
}

/* ── Styles ── */
const S = {
  wrap:      { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 },
  title:     { fontSize: 18, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  countBadge:{ background: 'rgba(240,185,11,.15)', color: 'var(--accent)', borderRadius: 10, padding: '1px 8px', fontSize: 12, fontWeight: 600 },
  subtitle:  { fontSize: 12, color: 'var(--muted)' },
  search:    { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', width: 220 },
  sortRow:   { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip:      { border: '1px solid', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 },
  tableWrap: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:        { padding: '9px 14px', background: 'var(--surface-2)', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border)', textAlign: 'right', whiteSpace: 'nowrap', userSelect: 'none' },
  td:        { padding: '10px 14px', borderBottom: '1px solid var(--border)' },
  row:       { cursor: 'pointer', transition: 'background .15s' },
  tokenCell: { display: 'flex', alignItems: 'center', gap: 10 },
  tokenIcon: { width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 },
  tokenSymbol:{ fontWeight: 700, color: 'var(--text)', fontSize: 13 },
  tokenName: { fontSize: 11, color: 'var(--muted)', marginTop: 1 },
  liveDot:   { width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)', animation: 'pulse 2s infinite' },
  link:      { color: 'var(--blue)', textDecoration: 'none', fontSize: 15 },
  empty:     { textAlign: 'center', padding: '64px 20px', color: 'var(--text)' },
  footer:    { color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: '4px 0' },
  breakRow:  { background: 'rgba(255,255,255,0.02)' },
  breakIndent:{ width: 36, borderBottom: '1px solid var(--border)' },
  breakWallet:{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 },
  breakLogo: { fontSize: 18, flexShrink: 0 },
  breakLabel:{ fontWeight: 600, fontSize: 12, color: 'var(--text)' },
  breakAddr: { fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' },
  breakEmpty:{ padding: '12px 14px', color: 'var(--muted)', fontSize: 12, textAlign: 'center', borderBottom: '1px solid var(--border)' },
};
