/**
 * STRATEGY: Cảnh báo khi số dư thay đổi >= X% so với lần trước.
 * Ví dụ: changePercent = 10 → cảnh báo khi biến động >= 10%
 */
import AlertStrategy from './AlertStrategy.js';

class PercentChangeStrategy extends AlertStrategy {
  /** @type {number} */
  #percent;

  constructor(changePercent) {
    super();
    this.#percent = changePercent;
  }

  checkAlert(current, previous, { token }) {
    if (previous === 0n) return { triggered: false };

    // Dùng BigInt arithmetic để tránh mất độ chính xác với whale wallets
    // (Number() chỉ chính xác đến 2^53 ≈ 9e15, whale có thể > 1e21)
    const bigDiff    = current - previous;
    const absDiff    = bigDiff >= 0n ? bigDiff : -bigDiff;
    // Nhân 10_000 trước khi chia → giữ 2 chữ số thập phân (đơn vị: 0.01%)
    const absChangeBp = Number((absDiff * 10_000n) / previous);
    const absChange   = absChangeBp / 100;

    if (absChange >= this.#percent) {
      const direction = bigDiff > 0n ? 'tăng' : 'giảm';
      return {
        triggered: true,
        level:     absChange >= this.#percent * 2 ? 'high' : 'medium',
        message:   `${token.symbol} ${direction} ${absChange.toFixed(1)}%`,
        changePercent: (bigDiff > 0n ? 1 : -1) * absChange,
      };
    }
    return { triggered: false };
  }
}

export default PercentChangeStrategy;
