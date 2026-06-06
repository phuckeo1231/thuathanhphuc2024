import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMonitor } from '../context/MonitorContext.jsx';
import ConnectionStatus from './ConnectionStatus.jsx';

/* ── User profile button ─────────────────────────────────── */
function UserProfileBtn({ user, onShowPortfolio, isActive }) {
  const initial = user.username[0].toUpperCase();
  return (
    <button
      className={`tb-user-btn ${isActive ? 'tb-user-btn--active' : ''}`}
      onClick={onShowPortfolio}
      title="Xem danh mục cá nhân"
    >
      <span className="tb-user-avatar">{initial}</span>
      <span className="tb-user-name">{user.username}</span>
    </button>
  );
}

/* ── Dropdown — dùng portal để tránh bị header clip ─────── */
function Dropdown({ label, items }) {
  const [open,    setOpen]    = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef  = useRef(null);
  const menuRef = useRef(null);

  /* Đóng khi click ngoài */
  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  /* Đóng khi scroll trang */
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [open]);

  function handleToggle() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(o => !o);
  }

  const menu = open && createPortal(
    <div
      ref={menuRef}
      className="tb-dropdown-menu"
      style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="tb-dropdown-divider" />
        ) : item.href ? (
          <a
            key={i}
            className="tb-dropdown-item"
            href={item.href}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
          >
            <span className="tb-dropdown-icon">{item.icon}</span>
            <div>
              <div className="tb-dropdown-label">{item.label}</div>
              {item.desc && <div className="tb-dropdown-desc">{item.desc}</div>}
            </div>
            {item.badge && <span className="tb-badge tb-badge--new">{item.badge}</span>}
          </a>
        ) : (
          <button
            key={i}
            className="tb-dropdown-item"
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => { item.onClick?.(); setOpen(false); }}
          >
            <span className="tb-dropdown-icon">{item.icon}</span>
            <div>
              <div className="tb-dropdown-label">{item.label}</div>
              {item.desc && <div className="tb-dropdown-desc">{item.desc}</div>}
            </div>
            {item.badge && <span className="tb-badge tb-badge--new">{item.badge}</span>}
          </button>
        )
      )}
    </div>,
    document.body
  );

  return (
    <div className="tb-dropdown">
      <button ref={btnRef} className="tb-nav-btn" onClick={handleToggle}>
        {label}
        <span className={`tb-chevron ${open ? 'tb-chevron--open' : ''}`}>▾</span>
      </button>
      {menu}
    </div>
  );
}

/* ── Main Toolbar ─────────────────────────────────────────── */
export default function Toolbar({ activeTab, onTabChange, wsStatus, user }) {
  const [searchVal, setSearchVal] = useState('');
  const { wallets, tokens, alerts, recentChanges, transfers } = useMonitor();

  function handleSearch(e) {
    e.preventDefault();
    const q = searchVal.trim();
    if (!q) return;
    const url = q.startsWith('0x') && q.length === 66
      ? `https://bscscan.com/tx/${q}`
      : q.startsWith('0x')
        ? `https://bscscan.com/address/${q}`
        : `https://bscscan.com/search?q=${q}`;
    window.open(url, '_blank', 'noreferrer');
    setSearchVal('');
  }

  const TABS = [
    { id: 'dashboard',  label: 'Tổng quan' },
    { id: 'wallets',    label: 'Ví',         badge: wallets.length       || null },
    { id: 'tokens',     label: 'Token',      badge: tokens.length        || null },
    { id: 'market',     label: 'Thị trường BSC' },
    { id: 'transfers',  label: 'Giao dịch',  badge: transfers.length     || null },
    { id: 'alerts',     label: 'Cảnh báo',   badge: alerts.length        || null, badgeType: 'alert' },
    { id: 'history',    label: 'Lịch sử',    badge: recentChanges.length || null },
  ];

  const MARKET_ITEMS = [
    {
      icon: '📊', label: 'Thị trường BSC',
      desc: 'Xem bảng giá token trên BSC',
      onClick: () => onTabChange('market'),
    },
    { divider: true },
    { icon: '📈', label: 'BNB/USD',      desc: 'Giao dịch BNB trên Binance',   href: 'https://www.binance.com/vi/trade/BNB_USDT' },
    { icon: '🥞', label: 'PancakeSwap',  desc: 'DEX lớn nhất BSC',             href: 'https://pancakeswap.finance' },
    { icon: '💹', label: 'Biểu đồ giá', desc: 'DexTools – biểu đồ BSC token', href: 'https://www.dextools.io/app/bsc' },
    { icon: '🔍', label: 'BSCScan',      desc: 'Explorer blockchain BSC',      href: 'https://bscscan.com' },
  ];

  const TOOL_ITEMS = [
    {
      icon: '🔗', label: 'Kiểm tra ví',
      desc: 'Tra cứu địa chỉ BSC trong ứng dụng',
      onClick: () => onTabChange('wallets'),
    },
    {
      icon: '📊', label: 'Thị trường BSC',
      desc: 'Bảng giá token trên BSC',
      onClick: () => onTabChange('market'),
    },
    {
      icon: '🔔', label: 'Quản lý cảnh báo',
      desc: 'Xem và xóa cảnh báo số dư',
      onClick: () => onTabChange('alerts'),
    },
    { divider: true },
    { icon: '💧', label: 'Token Sniffer',  desc: 'Kiểm tra token an toàn',      href: 'https://tokensniffer.com' },
    { icon: '⚡', label: 'Gas Tracker',   desc: 'Phí gas BSC hiện tại',        href: 'https://bscscan.com/gastracker' },
    { icon: '📋', label: 'ABI Decoder',   desc: 'Giải mã dữ liệu giao dịch',   href: 'https://abi.hashex.org' },
    { icon: '🌉', label: 'BSC Bridge',    desc: 'Cầu nối tài sản sang BSC',    href: 'https://www.bnbchain.org/en/bridge' },
  ];

  return (
    <div className="tb-content">
      {/* ── Tabs điều hướng ── */}
      <div className="tb-left">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tb-tab ${activeTab === tab.id ? 'tb-tab--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
            {tab.badge != null && (
              <span className={`tb-badge ${tab.badgeType === 'alert' && tab.badge > 0 ? 'tb-badge--alert' : ''}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}

        <div className="tb-sep" />

        <Dropdown label="Thị trường" items={MARKET_ITEMS} />
        <Dropdown label="Công cụ"    items={TOOL_ITEMS} />
      </div>

      {/* ── Thanh tìm kiếm ── */}
      <form className="tb-search" onSubmit={handleSearch}>
        <span className="tb-search-icon">⌕</span>
        <input
          className="tb-search-input"
          placeholder="Tìm địa chỉ ví, token, tx hash... (0x...)"
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
        />
        {searchVal && (
          <button type="submit" className="tb-search-go">↗</button>
        )}
      </form>

      {/* ── Phải: công cụ nhanh ── */}
      <div className="tb-right">
        <ConnectionStatus status={wsStatus} />

        <button
          className="tb-icon-btn"
          title="Tải lại trang"
          onClick={() => window.location.reload()}
        >
          ↺
        </button>

        <a
          className="tb-icon-btn"
          href="https://bscscan.com"
          target="_blank"
          rel="noreferrer"
          title="BSCScan Explorer"
        >
          🔍
        </a>

        <button
          className="tb-icon-btn"
          title="Sao chép link"
          onClick={() => navigator.clipboard?.writeText(window.location.href)}
        >
          ⎘
        </button>

        <div className="tb-sep" />

        {user && (
          <UserProfileBtn
            user={user}
            onShowPortfolio={() => onTabChange('portfolio')}
            isActive={activeTab === 'portfolio'}
          />
        )}
      </div>
    </div>
  );
}
