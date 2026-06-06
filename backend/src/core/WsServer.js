/**
 * WebSocket server: nhận sự kiện từ EventBus (Observer)
 * và broadcast tới tất cả client trình duyệt đang kết nối.
 */
import { WebSocketServer } from 'ws';
import eventBus            from './EventBus.js';
import { formatBalance }   from '../utils/formatBalance.js';
import logger              from '../utils/logger.js';

function serializeWallet(w) {
  return {
    address:     w.address,
    label:       w.label,
    category:    w.category    ?? 'other',
    logo:        w.logo        ?? '💼',
    website:     w.website     ?? '',
    description: w.description ?? '',
  };
}

class WsServer {
  #wss              = null;
  #clients          = new Set();
  #latestSnapshot   = null;
  #latestTrending   = null;
  #latestTransfers  = null;
  #latestWallets    = null;
  #scannedWallets   = new Set();  // ví đã hoàn thành scan — gửi cho client kết nối muộn
  #balanceHistory   = new Map();  // "walletAddr:tokenSymbol" → number[] (sparkline cache)
  static #MAX_HIST  = 30;         // số điểm tối đa mỗi ví:token

  init(httpServer) {
    this.#wss = new WebSocketServer({ server: httpServer });

    this.#wss.on('connection', (ws) => {
      this.#clients.add(ws);
      logger.info(`[WS-Server] Client kết nối (tổng: ${this.#clients.size})`);

      // Gửi snapshot mới nhất cho client vừa kết nối
      if (this.#latestSnapshot) {
        ws.send(JSON.stringify(this.#serializeSnapshot(this.#latestSnapshot)));
      } else if (this.#latestWallets) {
        // Snapshot chưa sẵn sàng — gửi danh sách ví trước để hiển thị ngay
        ws.send(JSON.stringify({ type: 'wallets_update', wallets: this.#latestWallets }));
      }
      if (this.#latestTrending) {
        ws.send(JSON.stringify({ type: 'trending', trends: this.#latestTrending }));
      }
      if (this.#latestTransfers) {
        ws.send(JSON.stringify({ type: 'transfers', transfers: this.#latestTransfers }));
      }
      // Gửi danh sách ví đã scan cho client kết nối muộn — xóa "Đang tải số dư..." ngay
      if (this.#scannedWallets.size > 0) {
        ws.send(JSON.stringify({ type: 'wallets_scanned', wallets: [...this.#scannedWallets] }));
      }
      // Gửi sparkline history để sparkline không trắng sau F5
      if (this.#balanceHistory.size > 0) {
        const histObj = Object.fromEntries(this.#balanceHistory);
        ws.send(JSON.stringify({ type: 'balance_history', data: histObj }));
      }

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw);
          if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
        } catch { /* bỏ qua */ }
      });

      ws.on('close', () => {
        this.#clients.delete(ws);
        logger.info(`[WS-Server] Client ngắt kết nối (tổng: ${this.#clients.size})`);
      });
    });

    // === Observer subscriptions ===

    eventBus.subscribe('snapshot', (data) => {
      this.#latestSnapshot = data;
      this.#broadcast(this.#serializeSnapshot(data));
    });

    eventBus.subscribe('balance_change', (data) => {
      // Cập nhật snapshot cache để client kết nối muộn nhận dữ liệu mới nhất
      if (this.#latestSnapshot) {
        const key = `${data.wallet.address}:${data.token.address}`;
        const cur = data.current;
        if ((typeof cur === 'bigint' ? cur : BigInt(cur || 0)) === 0n) {
          this.#latestSnapshot.balances.delete(key);
        } else {
          this.#latestSnapshot.balances.set(key, cur);
        }
      }
      // Cập nhật sparkline history cache — gửi cho client kết nối muộn (sau F5)
      const histKey = `${data.wallet.address}:${data.token.symbol}`;
      const hist    = this.#balanceHistory.get(histKey) ?? [];
      hist.push(parseFloat(formatBalance(data.current, data.token.decimals)));
      if (hist.length > WsServer.#MAX_HIST) hist.shift();
      this.#balanceHistory.set(histKey, hist);

      this.#broadcast({
        type:     'balance_change',
        wallet:   { address: data.wallet.address, label: data.wallet.label },
        token:    { symbol: data.token.symbol, decimals: data.token.decimals },
        previous: formatBalance(data.previous, data.token.decimals),
        current:  formatBalance(data.current,  data.token.decimals),
        txHash:   data.txHash,
        timestamp: data.timestamp,
      });
    });

    eventBus.subscribe('alert', (data) => {
      this.#broadcast({
        type:        'alert',
        walletAddr:  data.wallet.address,
        walletLabel: data.wallet.label,
        token:       data.token.symbol,
        level:       data.level,
        message:     data.message,
        timestamp:   data.timestamp,
      });
    });

    eventBus.subscribe('trending', (trends) => {
      this.#latestTrending = trends;
      this.#broadcast({ type: 'trending', trends });
    });

    // BSCScan transfers
    eventBus.subscribe('transfers', (transfers) => {
      this.#latestTransfers = transfers;
      this.#broadcast({ type: 'transfers', transfers });
    });

    // Ví vừa hoàn thành scan — báo frontend tắt "Đang tải số dư..."
    eventBus.subscribe('wallet_scanned', ({ walletAddress }) => {
      this.#scannedWallets.add(walletAddress);
      this.#broadcast({ type: 'wallet_scanned', walletAddress });
    });

    // Danh sách ví cập nhật (gửi trước snapshot để hiển thị ngay)
    eventBus.subscribe('wallets_update', ({ wallets }) => {
      this.#latestWallets = wallets.map(serializeWallet);
      // Cập nhật snapshot cache để client kết nối muộn thấy ví mới
      if (this.#latestSnapshot) {
        this.#latestSnapshot.wallets = wallets;
      }
      this.#broadcast({ type: 'wallets_update', wallets: this.#latestWallets });
    });

  }

  #serializeSnapshot({ wallets, tokens, balances, balancesLoaded = true }) {
    // Tạo map nhanh tokenAddr → token để tránh O(n²)
    const tokenMap = new Map(tokens.map(t => [t.address, t]));

    const formatted = {};
    for (const [key, value] of balances) {
      const colonIdx  = key.indexOf(':');
      const walletAddr = key.slice(0, colonIdx);
      const tokenAddr  = key.slice(colonIdx + 1);
      const token = tokenMap.get(tokenAddr);
      if (!token) continue;

      // Bỏ qua số dư = 0
      let raw;
      try { raw = typeof value === 'bigint' ? value : BigInt(value); } catch { continue; }
      if (raw === 0n) continue;

      // Frontend dùng "walletAddr:tokenSymbol" làm key
      formatted[`${walletAddr}:${token.symbol}`] = formatBalance(raw, token.decimals);
    }

    return {
      type:     'snapshot',
      wallets:  wallets.map(serializeWallet),
      tokens:   tokens.map(t => ({ address: t.address, symbol: t.symbol, decimals: t.decimals, name: t.name })),
      balances: formatted,
      balancesLoaded,
    };
  }

  /** Trả về snapshot hiện tại dưới dạng object JSON — dùng cho REST API */
  getSnapshotPayload() {
    if (!this.#latestSnapshot) return null;
    return this.#serializeSnapshot(this.#latestSnapshot);
  }

  /** Pre-load transfers từ DB để gửi ngay cho client mới kết nối */
  setInitialTransfers(transfers) {
    if (transfers?.length) this.#latestTransfers = transfers;
  }

  /** Gọi từ bên ngoài khi danh sách ví thay đổi */
  broadcastWalletsUpdate(wallets) {
    this.#broadcast({
      type:    'wallets_update',
      wallets: wallets.map(serializeWallet),
    });
  }

  #broadcast(data) {
    const msg = JSON.stringify(data);
    for (const client of this.#clients) {
      if (client.readyState === 1 /* OPEN */) client.send(msg);
    }
  }
}

export default WsServer;
