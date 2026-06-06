import { useState } from 'react';
import { MonitorProvider, useMonitor } from './context/MonitorContext.jsx';
import AlertBanner     from './components/AlertBanner.jsx';
import AlertsPanel     from './components/AlertsPanel.jsx';
import StatsBar        from './components/StatsBar.jsx';
import TrendingPanel   from './components/TrendingPanel.jsx';
import WalletCard      from './components/WalletCard.jsx';
import EventLog        from './components/EventLog.jsx';
import Toolbar         from './components/Toolbar.jsx';
import AddWalletModal  from './components/AddWalletModal.jsx';
import TransfersPanel  from './components/TransfersPanel.jsx';
import PortfolioPanel  from './components/PortfolioPanel.jsx';
import MarketPanel     from './components/MarketPanel.jsx';
import TokensPanel     from './components/TokensPanel.jsx';
import AuthPage, { getSession, clearSession } from './components/AuthPage.jsx';

const WS_URL = 'ws://localhost:8080';

function WalletCardSkeleton() {
  return (
    <div className="wallet-card-skeleton">
      <div className="wcs-header">
        <div className="skel wcs-logo" />
        <div className="wcs-info">
          <div className="skel wcs-name" />
          <div className="skel wcs-addr" />
        </div>
      </div>
      <div className="wcs-divider" />
      <div className="wcs-tokens">
        {[0, 1, 2].map(i => (
          <div key={i} className="wcs-row">
            <div className="skel wcs-sym" />
            <div className="skel wcs-val" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const { wallets, tokens, balances, alerts, recentChanges, wsStatus, history, balancesLoaded, scannedWallets } = useMonitor();
  const [activeTab,     setActiveTab]     = useState('dashboard');
  const [clearedAlerts, setClearedAlerts] = useState(0);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [filterWallet,  setFilterWallet]  = useState('');
  const [alertPage,     setAlertPage]     = useState(0);
  const [filterPage,    setFilterPage]    = useState(0);
  const [pinnedWallets, setPinnedWallets] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('pinnedWallets') || '[]')); }
    catch { return new Set(); }
  });

  function togglePinWallet(addr) {
    setPinnedWallets(prev => {
      const next = new Set(prev);
      if (next.has(addr)) next.delete(addr); else next.add(addr);
      localStorage.setItem('pinnedWallets', JSON.stringify([...next]));
      return next;
    });
  }

  const visibleAlerts = alerts.filter(a => a.timestamp > clearedAlerts);

  async function removeWallet(address) {
    try {
      await fetch(`/api/wallets/${address}`, { method: 'DELETE' });
    } catch { /* lỗi kết nối — bỏ qua */ }
  }

  return (
    <div className="layout">
      {/* ── Header + Toolbar ── */}
      <header className="header">
        <div className="header-brand">
          <span className="logo">◈</span>
          <h1 className="title">BSC Asset Monitor</h1>
        </div>
        <Toolbar activeTab={activeTab} onTabChange={setActiveTab} wsStatus={wsStatus} user={user} />
      </header>

      {/* ── Xu hướng nổi bật ── */}
      <TrendingPanel />

      {/* ── Thống kê 4 thẻ ── */}
      <StatsBar
        wallets={wallets}
        tokens={tokens}
        recentChanges={recentChanges}
        alerts={visibleAlerts}
        wsStatus={wsStatus}
      />

      {/* ── Panel cảnh báo ── */}
      <AlertsPanel
        alerts={visibleAlerts}
        onClearAll={() => setClearedAlerts(Date.now())}
      />

      {/* ── Nội dung theo tab ── */}
      <main className="main-content">

        {/* Tab: Danh mục đầu tư */}
        {activeTab === 'portfolio' && (
          <section className="tab-portfolio-page">
            <PortfolioPanel user={user} onLogout={onLogout} />
          </section>
        )}

        {/* Tab: Token — danh sách tất cả token đang theo dõi */}
        {activeTab === 'tokens' && (
          <section className="tab-screener-page">
            <TokensPanel />
          </section>
        )}

        {/* Tab: Thị trường BSC */}
        {activeTab === 'market' && (
          <section className="tab-screener-page">
            <MarketPanel />
          </section>
        )}

        {/* Tab: Tổng quan / Ví */}
        {(activeTab === 'dashboard' || activeTab === 'wallets') && (
          <>
            <section className="wallets-grid">
              <div className="wallets-grid-header">
                <span className="wallets-grid-title">
                  Danh sách ví <span className="wallets-count">{wallets.length}</span>
                </span>
                <button
                  className="add-wallet-btn"
                  onClick={() => setShowAddModal(true)}
                  title="Thêm ví theo dõi"
                >
                  + Thêm ví
                </button>
              </div>

              {wallets.length === 0 ? (
                wsStatus === 'connecting' || wsStatus === 'reconnecting' ? (
                  Array.from({ length: 4 }).map((_, i) => <WalletCardSkeleton key={i} />)
                ) : (
                  <div className="empty-state">
                    <p>Chưa có ví nào được theo dõi</p>
                    <small>Nhấn "+ Thêm ví" để bắt đầu theo dõi ví BSC</small>
                  </div>
                )
              ) : (() => {
                const pinned   = wallets.filter(w => pinnedWallets.has(w.address));
                const unpinned = wallets.filter(w => !pinnedWallets.has(w.address));
                const sorted   = [...pinned, ...unpinned];
                return sorted.map((wallet, idx) => (
                  <>
                    {idx === pinned.length && pinned.length > 0 && unpinned.length > 0 && (
                      <div key="divider" className="wallets-pin-divider">
                        <span>Các ví khác</span>
                      </div>
                    )}
                    <WalletCard
                      key={wallet.address}
                      wallet={wallet}
                      tokens={tokens}
                      balances={balances}
                      recentChanges={recentChanges}
                      history={history}
                      balancesLoaded={balancesLoaded}
                      scannedWallets={scannedWallets}
                      onRemove={() => removeWallet(wallet.address)}
                      pinned={pinnedWallets.has(wallet.address)}
                      onPin={() => togglePinWallet(wallet.address)}
                    />
                  </>
                ));
              })()}
            </section>
            <aside className="sidebar">
              <EventLog recentChanges={recentChanges} />
            </aside>

            {/* ── Thị trường BSC (dưới ví, chỉ ở dashboard) ── */}
            {activeTab === 'dashboard' && (
              <MarketPanel compact onViewAll={() => setActiveTab('market')} />
            )}
          </>
        )}

        {/* Tab: Cảnh báo */}
        {activeTab === 'alerts' && (() => {
          const PAGE = 50;

          /* Pagination controls */
          function Pager({ page, total, onPage }) {
            const totalPages = Math.ceil(total / PAGE);
            if (totalPages <= 1) return null;
            const start = page * PAGE + 1;
            const end   = Math.min((page + 1) * PAGE, total);
            return (
              <div className="ap-pager">
                <button className="ap-pager-btn" disabled={page === 0}
                        onClick={() => onPage(page - 1)}>← Trước</button>
                <span className="ap-pager-info">
                  {start}–{end} / {total}
                  <span className="ap-pager-pages"> (trang {page + 1}/{totalPages})</span>
                </span>
                <button className="ap-pager-btn" disabled={page >= totalPages - 1}
                        onClick={() => onPage(page + 1)}>Tiếp →</button>
              </div>
            );
          }

          /* Danh sách ví duy nhất có trong alerts */
          const alertWallets = [...new Map(
            visibleAlerts
              .filter(a => a.walletAddr)
              .map(a => [a.walletAddr, { addr: a.walletAddr, label: a.walletLabel || `${a.walletAddr.slice(0, 8)}…` }])
          ).values()];

          const filteredAlerts = filterWallet
            ? visibleAlerts.filter(a => a.walletAddr === filterWallet)
            : visibleAlerts;

          /* Trang hiện tại */
          const pageAlerts  = visibleAlerts.slice(alertPage  * PAGE, (alertPage  + 1) * PAGE);
          const pageFiltered = filteredAlerts.slice(filterPage * PAGE, (filterPage + 1) * PAGE);

          return (
            <section className="tab-alerts-page">
              <div className="alerts-columns">

                {/* Cột trái: tất cả cảnh báo */}
                <div className="alerts-col">
                  <h2 className="tab-page-title">
                    Tất cả cảnh báo
                    {visibleAlerts.length > 0 && (
                      <span className="ap-total-badge">{visibleAlerts.length}</span>
                    )}
                  </h2>
                  {visibleAlerts.length === 0 ? (
                    <div className="empty-state">
                      <p>Chưa có cảnh báo nào</p>
                      <small>Cảnh báo xuất hiện khi số dư giảm dưới ngưỡng hoặc biến động mạnh</small>
                    </div>
                  ) : (
                    <>
                      <div className="alerts-list">
                        {pageAlerts.map((a, i) => (
                          <AlertBanner key={`${a.timestamp}-${i}`} alert={a} />
                        ))}
                      </div>
                      <Pager page={alertPage} total={visibleAlerts.length} onPage={setAlertPage} />
                    </>
                  )}
                </div>

                {/* Cột phải: lọc theo ví */}
                <div className="alerts-col alerts-col--filter">
                  <h2 className="tab-page-title">Lọc theo ví</h2>

                  {alertWallets.length === 0 ? (
                    <div className="pinned-empty">Chưa có cảnh báo nào để lọc</div>
                  ) : (
                    <>
                      {/* Chip chọn ví */}
                      <div className="aw-chips">
                        <button
                          className={`aw-chip${filterWallet === '' ? ' aw-chip--active' : ''}`}
                          onClick={() => { setFilterWallet(''); setFilterPage(0); }}
                        >
                          Tất cả
                          <span className="aw-chip-count">{visibleAlerts.length}</span>
                        </button>
                        {alertWallets.map(w => {
                          const cnt = visibleAlerts.filter(a => a.walletAddr === w.addr).length;
                          const highLevel = visibleAlerts.some(a => a.walletAddr === w.addr && a.level === 'high');
                          return (
                            <button
                              key={w.addr}
                              className={`aw-chip${filterWallet === w.addr ? ' aw-chip--active' : ''}${highLevel ? ' aw-chip--high' : ''}`}
                              onClick={() => {
                                setFilterWallet(v => v === w.addr ? '' : w.addr);
                                setFilterPage(0);
                              }}
                              title={w.addr}
                            >
                              {w.label}
                              <span className="aw-chip-count">{cnt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Danh sách cảnh báo đã lọc */}
                      {filterWallet && (
                        <>
                          <div className="alerts-list" style={{ marginTop: 10 }}>
                            {pageFiltered.length === 0 ? (
                              <div className="pinned-empty">Không có cảnh báo cho ví này</div>
                            ) : pageFiltered.map((a, i) => (
                              <AlertBanner key={`f-${a.timestamp}-${i}`} alert={a} />
                            ))}
                          </div>
                          <Pager page={filterPage} total={filteredAlerts.length} onPage={setFilterPage} />
                        </>
                      )}
                    </>
                  )}
                </div>

              </div>
            </section>
          );
        })()}

        {/* Tab: Giao dịch */}
        {activeTab === 'transfers' && (
          <section className="tab-transfers-page">
            <TransfersPanel />
          </section>
        )}

        {/* Tab: Lịch sử */}
        {activeTab === 'history' && (
          <section className="tab-history-page">
            <h2 className="tab-page-title">Lịch sử thay đổi số dư</h2>
            <EventLog recentChanges={recentChanges} fullMode />
          </section>
        )}

      </main>

      {/* ── Modal thêm ví ── */}
      {showAddModal && (
        <AddWalletModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => getSession());

  function handleLogin(session) { setUser(session); }
  function handleLogout()       { clearSession(); setUser(null); }

  if (!user) return <AuthPage onLogin={handleLogin} />;

  return (
    <MonitorProvider wsUrl={WS_URL}>
      <Dashboard user={user} onLogout={handleLogout} />
    </MonitorProvider>
  );
}
