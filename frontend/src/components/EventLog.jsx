import { useState, useMemo, useEffect } from 'react';

const PAGE_SIZE   = 50;   // số dòng mỗi trang
const MAX_PER_DAY = 500;  // tối đa sự kiện lưu mỗi ngày

function fmtAmt(raw) {
  const n = parseFloat(raw);
  if (isNaN(n)) return raw ?? '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 10_000)    return (n / 1_000).toFixed(1) + 'K';
  if (n >= 1)         return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (n > 0)          return n.toPrecision(4);
  return '0';
}

function fmtTime(ts, full = false) {
  const d = new Date(ts);
  if (full) {
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
  return d.toLocaleTimeString('vi-VN');
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10)    return 'vừa nay';
  if (s < 60)    return `${s}s trước`;
  if (s < 3600)  return `${Math.floor(s / 60)}ph trước`;
  if (s < 86400) return `${Math.floor(s / 3600)}h trước`;
  return `${Math.floor(s / 86400)}d trước`;
}

/* ── Chế độ sidebar (compact) ── */
function SidebarRow({ e, diff, isPos }) {
  return (
    <li style={SR.item}>
      <span style={{ ...SR.dir, color: isPos ? 'var(--green)' : 'var(--red)', background: isPos ? 'rgba(46,204,113,.12)' : 'rgba(231,76,60,.12)' }}>
        {isPos ? '▲' : '▼'}
      </span>
      <div style={SR.main}>
        <div style={SR.topRow}>
          <span style={SR.wallet}>{e.wallet?.label ?? '—'}</span>
          <span style={SR.token}>{e.token?.symbol}</span>
        </div>
        <div style={SR.botRow}>
          <span style={{ ...SR.delta, color: isPos ? 'var(--green)' : 'var(--red)' }}>
            {isPos ? '+' : ''}{fmtAmt(String(Math.abs(diff)))}
          </span>
          <span style={SR.arrow}>→</span>
          <span style={SR.balance}>{fmtAmt(e.current)}</span>
        </div>
      </div>
      <div style={SR.right}>
        <span style={SR.time}>{timeAgo(e.timestamp)}</span>
        {e.txHash && (
          <a href={`https://bscscan.com/tx/${e.txHash}`} target="_blank" rel="noreferrer" style={SR.link}>↗</a>
        )}
      </div>
    </li>
  );
}

const SR = {
  item:    { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, cursor: 'default', borderBottom: '1px solid var(--border)' },
  dir:     { width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 },
  main:    { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  topRow:  { display: 'flex', alignItems: 'center', gap: 6 },
  wallet:  { fontSize: 12, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 },
  token:   { fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'rgba(240,185,11,.12)', padding: '1px 5px', borderRadius: 4 },
  botRow:  { display: 'flex', alignItems: 'center', gap: 4 },
  delta:   { fontSize: 12, fontWeight: 600, fontFamily: 'monospace' },
  arrow:   { fontSize: 10, color: 'var(--muted)' },
  balance: { fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' },
  right:   { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  time:    { fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' },
  link:    { fontSize: 12, color: 'var(--blue)', textDecoration: 'none' },
};

/* ── Pagination controls ── */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  /* Tạo dãy số trang hiển thị (có dấu "...") */
  function pages() {
    const list = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) list.push(i);
      return list;
    }
    list.push(0);
    if (page > 3)          list.push('...');
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) list.push(i);
    if (page < totalPages - 4) list.push('...');
    list.push(totalPages - 1);
    return list;
  }

  return (
    <div style={PG.wrap}>
      <button style={{ ...PG.btn, opacity: page === 0 ? .3 : 1 }}
              disabled={page === 0} onClick={() => onChange(page - 1)}>
        ← Trước
      </button>

      <div style={PG.nums}>
        {pages().map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} style={PG.ellipsis}>…</span>
            : <button
                key={p}
                style={{ ...PG.num, ...(p === page ? PG.numActive : {}) }}
                onClick={() => onChange(p)}
              >{p + 1}</button>
        )}
      </div>

      <button style={{ ...PG.btn, opacity: page === totalPages - 1 ? .3 : 1 }}
              disabled={page === totalPages - 1} onClick={() => onChange(page + 1)}>
        Tiếp →
      </button>
    </div>
  );
}

const PG = {
  wrap:      { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', paddingTop: 12 },
  btn:       { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, padding: '5px 12px', cursor: 'pointer' },
  nums:      { display: 'flex', gap: 4 },
  num:       { background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--muted)', fontSize: 12, width: 30, height: 28, cursor: 'pointer' },
  numActive: { background: 'var(--accent)', border: '1px solid var(--accent)', color: '#0a0b0e', fontWeight: 700 },
  ellipsis:  { color: 'var(--muted)', fontSize: 12, lineHeight: '28px', padding: '0 2px' },
};

/* ── Bảng đầy đủ ── */
function FullTable({ rows, total, search, setSearch, filter, setFilter, tokenList,
                     page, setPage, dateFilter, setDateFilter }) {
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows   = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const start      = page * PAGE_SIZE + 1;
  const end        = Math.min((page + 1) * PAGE_SIZE, rows.length);

  return (
    <div style={FT.wrap}>

      {/* Thanh lọc */}
      <div style={FT.toolbar}>
        <input
          style={FT.search}
          placeholder="Tìm ví, token..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
        />
        <select style={FT.select} value={filter}
                onChange={e => { setFilter(e.target.value); setPage(0); }}>
          <option value="">Tất cả token</option>
          {tokenList.map(sym => <option key={sym} value={sym}>{sym}</option>)}
        </select>
        <select style={FT.select} value={dateFilter}
                onChange={e => { setDateFilter(e.target.value); setPage(0); }}>
          <option value="today">Hôm nay</option>
          <option value="all">Tất cả</option>
        </select>
        <div style={FT.legend}>
          <span style={{ color: 'var(--green)', fontSize: 12 }}>▲ Tăng</span>
          <span style={{ color: 'var(--red)',   fontSize: 12 }}>▼ Giảm</span>
          {rows.length > 0 && (
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>
              {start}–{end} / {rows.length} sự kiện
            </span>
          )}
          {dateFilter === 'today' && total >= MAX_PER_DAY && (
            <span style={{ color: 'var(--orange)', fontSize: 11 }}>
              (tối đa {MAX_PER_DAY}/ngày)
            </span>
          )}
        </div>
      </div>

      {/* Bảng */}
      <div style={FT.tableWrap}>
        <table style={FT.table}>
          <thead>
            <tr>
              <th style={FT.th}></th>
              <th style={{ ...FT.th, textAlign: 'left' }}>Ví</th>
              <th style={{ ...FT.th, textAlign: 'left' }}>Token</th>
              <th style={FT.th}>Trước</th>
              <th style={{ ...FT.th, width: 20 }}></th>
              <th style={FT.th}>Sau</th>
              <th style={FT.th}>Thay đổi</th>
              <th style={FT.th}>Thời gian</th>
              <th style={FT.th}>BSCScan</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...FT.td, textAlign: 'center', color: 'var(--muted)', padding: '40px 0' }}>
                  Chưa có sự kiện nào
                </td>
              </tr>
            ) : pageRows.map((e, i) => {
              const diff  = parseFloat(e.current) - parseFloat(e.previous);
              const isPos = diff >= 0;
              return (
                <tr key={i} style={FT.row}>
                  <td style={FT.td}>
                    <span style={{ ...FT.badge, color: isPos ? 'var(--green)' : 'var(--red)', background: isPos ? 'rgba(46,204,113,.12)' : 'rgba(231,76,60,.12)' }}>
                      {isPos ? '▲' : '▼'}
                    </span>
                  </td>
                  <td style={FT.td}>
                    <span style={FT.walletName}>{e.wallet?.label ?? '—'}</span>
                    <div style={FT.walletAddr}>{e.wallet?.address?.slice(0, 8)}…</div>
                  </td>
                  <td style={FT.td}>
                    <span style={FT.tokenChip}>{e.token?.symbol ?? '?'}</span>
                  </td>
                  <td style={{ ...FT.td, textAlign: 'right', fontFamily: 'monospace', color: 'var(--muted)', fontSize: 12 }}>
                    {fmtAmt(e.previous)}
                  </td>
                  <td style={{ ...FT.td, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>→</td>
                  <td style={{ ...FT.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>
                    {fmtAmt(e.current)}
                  </td>
                  <td style={{ ...FT.td, textAlign: 'right' }}>
                    <span style={{ color: isPos ? 'var(--green)' : 'var(--red)', fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>
                      {isPos ? '+' : ''}{fmtAmt(String(Math.abs(diff).toFixed(6)))}
                    </span>
                  </td>
                  <td style={{ ...FT.td, textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--text)' }}>{fmtTime(e.timestamp)}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{timeAgo(e.timestamp)}</div>
                  </td>
                  <td style={{ ...FT.td, textAlign: 'center' }}>
                    {e.txHash
                      ? <a href={`https://bscscan.com/tx/${e.txHash}`} target="_blank" rel="noreferrer" style={FT.link}>↗</a>
                      : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}

const FT = {
  wrap:      { display: 'flex', flexDirection: 'column', gap: 14 },
  toolbar:   { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  search:    { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', width: 200 },
  select:    { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text)', fontSize: 13, outline: 'none' },
  legend:    { marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' },
  tableWrap: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:        { padding: '9px 14px', background: 'var(--surface-2)', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid var(--border)', textAlign: 'right', whiteSpace: 'nowrap' },
  td:        { padding: '10px 14px', borderBottom: '1px solid var(--border)' },
  row:       { transition: 'background .15s' },
  badge:     { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 5, fontSize: 10, fontWeight: 700 },
  walletName:{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block' },
  walletAddr:{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' },
  tokenChip: { background: 'rgba(240,185,11,.12)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 5, fontSize: 12, fontWeight: 700 },
  link:      { color: 'var(--blue)', textDecoration: 'none', fontSize: 15 },
};

/* ── Export chính ── */
export default function EventLog({ recentChanges, fullMode = false }) {
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [page,       setPage]       = useState(0);

  /* Reset trang khi dữ liệu mới đến */
  useEffect(() => { setPage(0); }, [recentChanges.length]);

  const tokenList = useMemo(() =>
    [...new Set(recentChanges.map(e => e.token?.symbol).filter(Boolean))].sort(),
    [recentChanges]
  );

  /* Lọc theo ngày hôm nay (từ 00:00 đến hiện tại), tối đa MAX_PER_DAY */
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const filtered = useMemo(() => {
    let list = recentChanges;

    if (dateFilter === 'today') {
      list = list.filter(e => e.timestamp >= todayStart);
      list = list.slice(0, MAX_PER_DAY);
    }

    if (filter) list = list.filter(e => e.token?.symbol === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.wallet?.label ?? '').toLowerCase().includes(q) ||
        (e.wallet?.address ?? '').toLowerCase().includes(q) ||
        (e.token?.symbol  ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [recentChanges, filter, search, dateFilter, todayStart]);

  const todayTotal = useMemo(() =>
    recentChanges.filter(e => e.timestamp >= todayStart).length,
    [recentChanges, todayStart]
  );

  /* ── Sidebar compact ── */
  if (!fullMode) {
    if (recentChanges.length === 0) {
      return (
        <div className="event-log">
          <h3 className="event-log-title">Lịch sử thay đổi</h3>
          <div className="event-log-empty">Chưa có sự kiện nào...</div>
        </div>
      );
    }
    return (
      <div className="event-log">
        <h3 className="event-log-title">Lịch sử thay đổi</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {recentChanges.slice(0, 25).map((e, i) => {
            const diff  = parseFloat(e.current) - parseFloat(e.previous);
            const isPos = diff >= 0;
            return <SidebarRow key={i} e={e} diff={diff} isPos={isPos} />;
          })}
        </ul>
      </div>
    );
  }

  /* ── Tab Lịch sử đầy đủ ── */
  return (
    <FullTable
      rows={filtered}
      total={todayTotal}
      search={search}     setSearch={setSearch}
      filter={filter}     setFilter={setFilter}
      dateFilter={dateFilter} setDateFilter={setDateFilter}
      tokenList={tokenList}
      page={page}         setPage={setPage}
    />
  );
}
