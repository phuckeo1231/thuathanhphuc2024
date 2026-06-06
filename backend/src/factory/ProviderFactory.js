/**
 * ============================================================
 * DESIGN PATTERN: FACTORY (tiếp theo)
 * ============================================================
 * ProviderFactory quyết định tạo loại provider nào dựa vào
 * biến môi trường PROVIDER_TYPE.
 *
 * Caller chỉ gọi ProviderFactory.create(config) và nhận lại
 * một provider đã sẵn sàng — không cần biết class cụ thể.
 * ============================================================
 */
import WebSocketProvider    from '../providers/WebSocketProvider.js';
import HttpPollingProvider  from '../providers/HttpPollingProvider.js';
import BscScanProvider      from '../providers/BscScanProvider.js';

class ProviderFactory {
  /**
   * @param {object} config - config từ src/config/config.js
   * @returns {WebSocketProvider | HttpPollingProvider | BscScanProvider}
   */
  static create(config) {
    const type = (config.PROVIDER_TYPE || 'bscscan').toLowerCase();

    switch (type) {
      case 'ws':
      case 'websocket':
        return new WebSocketProvider({
          wsUrl:   config.BSC_WS_URL,
          wallets: config.wallets,
          tokens:  config.tokens,
        });

      case 'http':
      case 'polling':
        return new HttpPollingProvider({
          httpUrl:      config.BSC_HTTP_URL,
          wallets:      config.wallets,
          tokens:       config.tokens,
          pollInterval: config.POLL_INTERVAL_MS,
        });

      case 'bscscan':
        return new BscScanProvider({
          wallets:     config.wallets,
          pollInterval: config.BSCSCAN_POLL_MS,
          rpcUrl:      config.BSC_HTTP_URL,
          concurrency: config.BSCSCAN_CONCURRENCY,
          staggerMs:   config.BSCSCAN_STAGGER_MS,
        });

      default:
        throw new Error(`ProviderFactory: loại không hợp lệ "${type}". Dùng "bscscan", "http" hoặc "ws".`);
    }
  }
}

export default ProviderFactory;
