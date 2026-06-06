/**
 * WalletMonitor: theo dõi một ví cụ thể.
 *
 * Kết hợp Observer + Strategy:
 *   - Subscribe EventBus để nhận 'balance_change' (Observer)
 *   - Đánh giá từng strategy được inject (Strategy)
 *   - Emit 'alert' nếu strategy bị kích hoạt
 */
import eventBus from '../core/EventBus.js';
import logger   from '../utils/logger.js';

class WalletMonitor {
  #wallet;
  #strategies = [];
  #unsubscribe = null;

  constructor(wallet) {
    this.#wallet = wallet;
  }

  /**
   * Thêm một chiến lược cảnh báo.
   * Fluent interface: monitor.addStrategy(a).addStrategy(b)
   * @param {import('../strategies/AlertStrategy.js').default} strategy
   */
  addStrategy(strategy) {
    this.#strategies.push(strategy);
    return this;
  }

  setStrategies(strategies) {
    this.#strategies = [...strategies];
    return this;
  }

  start() {
    this.#unsubscribe = eventBus.subscribe('balance_change', (data) => {
      // Chỉ xử lý sự kiện cho ví này
      if (data.wallet.address !== this.#wallet.address) return;

      for (const strategy of this.#strategies) {
        const result = strategy.checkAlert(data.current, data.previous, {
          wallet: data.wallet,
          token:  data.token,
        });

        if (result.triggered) {
          eventBus.emit('alert', {
            wallet:    data.wallet,
            token:     data.token,
            level:     result.level,
            message:   result.message,
            timestamp: data.timestamp,
          });
          logger.warn(`[Alert][${data.wallet.label}] ${result.message}`);
        }
      }
    });
  }

  stop() {
    this.#unsubscribe?.();
  }
}

export default WalletMonitor;
