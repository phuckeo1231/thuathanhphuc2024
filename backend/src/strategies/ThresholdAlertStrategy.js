/**
 * STRATEGY: Cảnh báo khi số dư giảm xuống dưới ngưỡng tối thiểu.
 * Ví dụ: thresholdRaw = 1e18 → cảnh báo khi số dư < 1 token
 */
import AlertStrategy from './AlertStrategy.js';

class ThresholdAlertStrategy extends AlertStrategy {
  /** @type {bigint} */
  #threshold;

  constructor(thresholdRaw) {
    super();
    this.#threshold = BigInt(thresholdRaw);
  }

  checkAlert(current, previous, { token }) {
    // Chỉ cảnh báo khi số dư VỪA rơi xuống dưới ngưỡng (không cảnh báo liên tục)
    if (previous >= this.#threshold && current < this.#threshold) {
      const decimals  = BigInt(token.decimals);
      const humanVal  = current / (10n ** decimals);
      return {
        triggered: true,
        level:     'high',
        message:   `${token.symbol} giảm xuống dưới ngưỡng: còn ${humanVal} ${token.symbol}`,
      };
    }
    return { triggered: false };
  }
}

export default ThresholdAlertStrategy;
