import { createContext, useContext, useReducer, useEffect } from 'react';
import useWebSocket      from '../hooks/useWebSocket.js';
import useBalanceHistory from '../hooks/useBalanceHistory.js';

const MonitorContext = createContext(null);

const INITIAL_STATE = {
  wallets:        [],
  tokens:         [],
  balances:       {},
  recentChanges:  [],
  alerts:         [],
  trends:         [],
  transfers:      [],
  balancesLoaded: false,
  scannedWallets: {},   // { walletAddr: true } — ví đã hoàn thành scan
};

function reducer(state, action) {
  switch (action.type) {
    case 'snapshot':
      return {
        ...state,
        wallets: action.wallets,
        tokens: action.tokens,
        balances: action.balances,
        balancesLoaded: action.balancesLoaded ?? true,
      };

    case 'balance_change': {
      const walletExists = state.wallets.some(w => w.address === action.wallet.address);
      return {
        ...state,
        wallets: walletExists
          ? state.wallets
          : [...state.wallets, { address: action.wallet.address, label: action.wallet.label }],
        balances: {
          ...state.balances,
          [`${action.wallet.address}:${action.token.symbol}`]: action.current,
        },
        recentChanges: [action, ...state.recentChanges].slice(0, 500),
      };
    }

    case 'alert':
      return { ...state, alerts: [action, ...state.alerts] };

    /* Load lịch sử alerts từ DB — merge với real-time alerts đã có, dedup theo timestamp */
    case 'init_alerts': {
      const existingTs = new Set(state.alerts.map(a => a.timestamp));
      const newAlerts  = action.alerts.filter(a => !existingTs.has(a.timestamp));
      return { ...state, alerts: [...state.alerts, ...newAlerts] };
    }

    case 'wallet_scanned': {
      if (state.scannedWallets[action.walletAddress]) return state; // không re-render nếu đã có
      return {
        ...state,
        scannedWallets: { ...state.scannedWallets, [action.walletAddress]: true },
      };
    }

    case 'wallets_scanned': {
      const incoming = action.wallets ?? [];
      // Bỏ qua nếu tất cả đã có sẵn
      if (incoming.every(a => state.scannedWallets[a])) return state;
      const extra = Object.fromEntries(incoming.map(a => [a, true]));
      return { ...state, scannedWallets: { ...state.scannedWallets, ...extra } };
    }

    case 'trending':
      return { ...state, trends: action.trends };

    case 'wallets_update':
      return { ...state, wallets: action.wallets };

    case 'transfers':
      return { ...state, transfers: action.transfers };

    default:
      return state;
  }
}

export function MonitorProvider({ children, wsUrl }) {
  const [state, dispatch]       = useReducer(reducer, INITIAL_STATE);
  const { status, lastMessage } = useWebSocket(wsUrl);
  const history                 = useBalanceHistory();

  /* ── Khi WebSocket nhận message ───────────────────────────── */
  useEffect(() => {
    if (!lastMessage) return;
    // balance_history: nạp sparkline cache từ server — không dispatch vào reducer
    if (lastMessage.type === 'balance_history') {
      history.init(lastMessage.data ?? {});
      return;
    }
    if (lastMessage.type === 'balance_change') {
      history.push(lastMessage.wallet.address, lastMessage.token.symbol, lastMessage.current);
    }
    dispatch(lastMessage);
  }, [lastMessage]);

  /* ── Load dữ liệu từ REST API ngay khi mount ──────────────
     Không chờ WebSocket — trang hiển thị dữ liệu tức thì khi F5  */
  useEffect(() => {
    /* Snapshot: tải số dư ngay qua REST — không chờ WebSocket */
    fetch('/api/snapshot')
      .then(r => r.status === 204 ? null : r.json())
      .then(data => { if (data) dispatch(data); })
      .catch(() => {});

    /* Wallets: hiển thị danh sách ví ngay trước khi WS snapshot đến */
    fetch('/api/wallets')
      .then(r => r.json())
      .then(wallets => dispatch({ type: 'wallets_update', wallets }))
      .catch(() => {});

    /* Alerts: load lịch sử từ DB */
    fetch('/api/alerts')
      .then(r => r.json())
      .then(alerts => {
        const normalized = alerts.map(a => ({
          ...a,
          type:      'alert',
          timestamp: new Date(a.timestamp).getTime(), // ISO string → số ms
        }));
        dispatch({ type: 'init_alerts', alerts: normalized });
      })
      .catch(() => {});

    /* Transfers: load lịch sử từ DB (WsServer cũng gửi khi kết nối, đây là fallback nhanh hơn) */
    fetch('/api/transfers')
      .then(r => r.json())
      .then(transfers => dispatch({ type: 'transfers', transfers }))
      .catch(() => {});
  }, []);

  return (
    <MonitorContext.Provider value={{ ...state, wsStatus: status, history }}>
      {children}
    </MonitorContext.Provider>
  );
}

export const useMonitor = () => {
  const ctx = useContext(MonitorContext);
  if (!ctx) throw new Error('useMonitor phải dùng trong MonitorProvider');
  return ctx;
};
