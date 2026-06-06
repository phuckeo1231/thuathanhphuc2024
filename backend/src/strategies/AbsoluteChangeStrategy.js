/**
 * STRATEGY: Cảnh báo khi số dư thay đổi >= X token (tuyệt đối).
 * Phù hợp với ví whale/sàn lớn — nơi biến động % nhỏ nhưng lượng tuyệt đối rất lớn.
 */
import AlertStrategy from './AlertStrategy.js';

class AbsoluteChangeStrategy extends AlertStrategy {
  /** @type {bigint} minChangeRaw — ngưỡng tuyệt đối tính theo wei */
  #minChange;

  constructor(minChangeRaw) {
    super();
    this.#minChange = BigInt(minChangeRaw);
  }

  checkAlert(current, previous, { token }) {
    if (previous === 0n) return { triggered: false };

    const diff    = current > previous ? current - previous : previous - current;
    if (diff < this.#minChange) return { triggered: false };

    const decimals = BigInt(token.decimals);
    const divisor  = 10n ** decimals;
    const diffHuman = Number(diff) / Number(divisor);
    const direction = current > previous ? 'tăng' : 'giảm';

    return {
      triggered: true,
      level: diff >= this.#minChange * 10n ? 'high' : 'medium',
      message: `${token.symbol} ${direction} ${diffHuman.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ${token.symbol} (thay đổi lớn)`,
      changePercent: Number(current - previous) / Number(previous) * 100,
    };
  }
}

export default AbsoluteChangeStrategy;
