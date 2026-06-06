import { useState, useMemo, useEffect, useRef } from 'react';
import { useMonitor } from '../context/MonitorContext.jsx';
import usePrices      from '../hooks/usePrices.js';

const PER_PAGE = 15;

/* ── Màu token ───────────────────────────────────────────── */
const TOKEN_COLOR = {
  USDT: '#26a17b', USDC: '#2775ca', BUSD: '#f0b90b', DAI: '#f5ac37',
  BNB:  '#f0b90b', WBNB: '#f0b90b', CAKE: '#d1884f', BAKE: '#e9a84c',
  ETH:  '#627eea', WETH: '#627eea', BTCB: '#f7931a', BTC:  '#f7931a',
  XVS:  '#1db8c1', TWT:  '#198de0', ALPACA: '#7a4f2e',
};
const TOKEN_EMOJI = {
  USDT: '💵', USDC: '💵', BNB: '🟡', WBNB: '🟡', CAKE: '🥞',
  ETH: '🔷', WETH: '🔷', BTCB: '🟠', BTC: '🟠', BUSD: '💛',
};
function tokenColor(sym) { return TOKEN_COLOR[sym?.toUpperCase()] ?? '#64748b'; }
function tokenEmoji(sym) { return TOKEN_EMOJI[sym?.toUpperCase()] ?? '⬡'; }

/* ── Rút gọn địa chỉ ─────────────────────────────────────── */
function short(addr) {
  if (!addr) return '—';
  return addr.slice(0, 8) + '…' + addr.slice(-4);
}

/* ── Thời gian tương đối ─────────────────────────────────── */
function timeAgo(ts) {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 10)    return 'vừa nay';
  if (s < 60)    return `${s}s trước`;
  if (s < 3600)  return `${Math.floor(s / 60)}ph trước`;
  if (s < 86400) return `${Math.floor(s / 3600)}h trước`;
  return `${Math.floor(s / 86400)}d trước`;
}

/* ── Tính USD ─────────────────────────────────────────────── */
function calcUsd(tx, prices) {
  const sym   = tx.tokenSymbol?.toUpperCase();
  const price = prices?.[sym];
  if (!price || !tx.valueRaw) return null;
  return tx.valueRaw * price;
}

function fmtUsd(n) {
  if (n == null || isNaN(n)) return null;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

/* ── Địa chỉ: label hoặc link ngắn ──────────────────────── */
function AddrCell({ label, addr }) {
  if (!addr) return <span className="tf-addr-unknown">— ẩn danh —</span>;
  if (label) {
    return (
      <a
        className="tf-label"
        href={`https://bscscan.com/address/${addr}`}
        target="_blank" rel="noreferrer"
        title={addr}
      >
        <span className="tf-label-icon">📄</span>
        {label}
      </a>
    );
  }
  return (
    <a
      className="tf-addr-link"
      href={`https://bscscan.com/address/${addr}`}
      target="_blank" rel="noreferrer"
    >
      {short(addr)}
    </a>
  );
}

/* ── Hàng giao dịch ──────────────────────────────────────── */
function TxRow({ tx, isNew, prices }) {
  const sym = tx.tokenSymbol?.toUpperCase() ?? '?';
  const usd = calcUsd(tx, prices);

  return (
    <tr className={`tf-row ${isNew ? 'tf-row--new' : ''}`}>

      {/* Chain icon */}
      <td className="tf-td tf-td--chain">
        <span className="tf-chain-dot" title="BNB Smart Chain">🟡</span>
      </td>

      {/* Thời gian */}
      <td className="tf-td tf-td--time">
        <span className={tx.timeStamp > Date.now() / 1000 - 30 ? 'tf-just-now' : ''}>
          {timeAgo(tx.timeStamp)}
        </span>
      </td>

      {/* Từ */}
      <td className="tf-td">
        <AddrCell label={tx.fromLabel} addr={tx.from} />
      </td>

      {/* Arrow */}
      <td className="tf-td tf-td--arrow">→</td>

      {/* Đến */}
      <td className="tf-td">
        <AddrCell label={tx.toLabel} addr={tx.to} />
      </td>

      {/* Giá trị */}
      <td className="tf-td tf-td--num">{tx.valueFormatted}</td>

      {/* Token chip */}
      <td className="tf-td">
        <span className="tf-sym-chip" style={{ color: tokenColor(sym) }}>
          {tokenEmoji(sym)} {sym}
        </span>
      </td>

      {/* USD */}
      <td className="tf-td tf-td--num tf-td--usd">
        {usd != null ? fmtUsd(usd) : (tx.usd != null ? fmtUsd(tx.usd) : '—')}
      </td>

      {/* Link */}
      <td className="tf-td tf-td--action">
        <a
          className="tf-ext-link"
          href={`https://bscscan.com/tx/${tx.hash}`}
          target="_blank" rel="noreferrer"
          title="Xem trên BSCScan"
        >↗</a>
      </td>
    </tr>
  );
}

/* ── Panel chính ─────────────────────────────────────────── */
export default function TransfersPanel() {
  const { transfers }  = useMonitor();
  const prices         = usePrices();

  const todayCount = useMemo(() => {
    const startSec = new Date().setHours(0, 0, 0, 0) / 1000;
    return transfers.filter(t => t.timeStamp >= startSec).length;
  }, [transfers]);

  const [minUsd,    setMinUsd]    = useState(0);
  const [minToken,  setMinToken]  = useState('');
  const [search,    setSearch]    = useState('');
  const [page,      setPage]      = useState(1);
  const [newHashes, setNewHashes] = useState(new Set());
  const [newCount,  setNewCount]  = useState(0);

  const prevLen = useRef(0);

  /* ── Phát hiện row mới → flash animation ─────────────── */
  useEffect(() => {
    if (transfers.length > prevLen.current) {
      const diff    = transfers.length - prevLen.current;
      const freshSet = new Set(
        transfers.slice(0, diff).map(t => `${t.hash}:${t.tokenSymbol}`)
      );
      setNewHashes(freshSet);
      setNewCount(c => c + diff);
      setPage(1);   // nhảy về trang đầu để thấy row mới
      const tid = setTimeout(() => setNewHashes(new Set()), 1500);
      prevLen.current = transfers.length;
      return () => clearTimeout(tid);
    }
  }, [transfers.length]);

  /* ── Lấy danh sách token unique để filter ────────────── */
  const tokenList = useMemo(() => {
    const syms = new Set(transfers.map(t => t.tokenSymbol).filter(Boolean));
    return [...syms].sort();
  }, [transfers]);

  /* ── Lọc ─────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transfers.filter(t => {
      if (minToken && t.tokenSymbol !== minToken) return false;
      if (minUsd > 0) {
        const usd = calcUsd(t, prices) ?? t.usd ?? 0;
        if (Number(usd) < minUsd) return false;
      }
      if (q) {
        const hit =
          t.from?.toLowerCase().includes(q) ||
          t.to?.toLowerCase().includes(q) ||
          t.fromLabel?.toLowerCase().includes(q) ||
          t.toLabel?.toLowerCase().includes(q) ||
          t.hash?.toLowerCase().includes(q) ||
          t.tokenSymbol?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [transfers, minUsd, minToken, search, prices]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageItems   = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  function goPage(delta) {
    setPage(p => Math.max(1, Math.min(totalPages, p + delta)));
  }

  return (
    <section className="tf-panel">

      {/* ── Tiêu đề ──────────────────────────────────────── */}
      <div className="tf-title-row">
        <div className="tf-title-left">
          <span className="tf-live-dot" title="Đang cập nhật theo thời gian thực" />
          <h2 className="tf-title">BỘ LỌC CHO CÁC CHUYỂN KHOẢN</h2>
          {todayCount > 0 && (
            <span className="tf-today-badge" title="Số giao dịch trong ngày hôm nay">
              Hôm nay: {todayCount}
            </span>
          )}
          {newCount > 0 && (
            <span className="tf-new-badge" onClick={() => setNewCount(0)}>
              +{newCount} mới
            </span>
          )}
        </div>

        <div className="tf-header-right">
          {/* Thanh tìm kiếm */}
          <div className="tf-search-wrap">
            <span className="tf-search-icon">⌕</span>
            <input
              className="tf-search-input"
              placeholder="Tìm địa chỉ, tên ví, token, tx hash..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button className="tf-search-clear" onClick={() => { setSearch(''); setPage(1); }}>✕</button>
            )}
          </div>

          {/* Filter USD */}
          <div className="tf-chips">
            <button
              className={`tf-chip ${minUsd === 0 ? 'tf-chip--on' : ''}`}
              onClick={() => { setMinUsd(0); setPage(1); }}
            >TẤT CẢ</button>

            <button
              className={`tf-chip ${minUsd === 1 ? 'tf-chip--on' : ''}`}
              onClick={() => { setMinUsd(1); setPage(1); }}
            >USD ≥ $1</button>

            <button
              className={`tf-chip ${minUsd === 1000 ? 'tf-chip--on' : ''}`}
              onClick={() => { setMinUsd(1000); setPage(1); }}
            >USD ≥ $1K</button>
          </div>

          {/* Filter token */}
          <select
            className="tf-token-select"
            value={minToken}
            onChange={e => { setMinToken(e.target.value); setPage(1); }}
          >
            <option value="">TẤT CẢ TOKEN</option>
            {tokenList.map(sym => (
              <option key={sym} value={sym}>{sym}</option>
            ))}
          </select>

          {/* Phân trang */}
          <div className="tf-pager">
            <span className="tf-pager-label">CHUYỂN NHƯỢNG</span>
            <button className="tf-pager-btn" onClick={() => goPage(-1)} disabled={currentPage <= 1}>‹</button>
            <span className="tf-pager-info">{currentPage} / {totalPages}</span>
            <button className="tf-pager-btn" onClick={() => goPage(+1)} disabled={currentPage >= totalPages}>›</button>
          </div>
        </div>
      </div>

      {/* ── Bảng ─────────────────────────────────────────── */}
      <div className="tf-table-wrap">
        <table className="tf-table">
          <thead>
            <tr>
              <th className="tf-th" style={{ width: 28 }}></th>
              <th className="tf-th tf-th--time">THỜI GIAN ▼</th>
              <th className="tf-th">TỪ</th>
              <th className="tf-th" style={{ width: 28 }}></th>
              <th className="tf-th">ĐẾN</th>
              <th className="tf-th tf-th--r">GIÁ TRỊ</th>
              <th className="tf-th">MÃ THÔNG BÁO</th>
              <th className="tf-th tf-th--r">USD</th>
              <th className="tf-th" style={{ width: 28 }}></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="tf-empty">
                  {transfers.length === 0
                    ? 'Đang tải dữ liệu từ BSCScan...'
                    : 'Không có giao dịch phù hợp với bộ lọc'}
                </td>
              </tr>
            ) : (
              pageItems.map((tx, i) => {
                const key   = `${tx.hash}:${tx.tokenSymbol}`;
                const isNew = newHashes.has(key);
                return (
                  <TxRow key={`${key}:${i}`} tx={tx} isNew={isNew} prices={prices} />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ───────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="tf-footer">
          Hiển thị <strong>{(currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, filtered.length)}</strong> / {filtered.length} giao dịch
          {transfers.length > 0 && ` · ${transfers.length} trong bộ nhớ`}
        </div>
      )}
    </section>
  );
}
