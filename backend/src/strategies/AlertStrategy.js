/**
 * ============================================================
 * DESIGN PATTERN: STRATEGY — Interface (lớp cơ sở)
 * ============================================================
 * AlertStrategy định nghĩa "hợp đồng" mà mọi chiến lược
 * cảnh báo phải tuân theo.
 *
 * WalletMonitor giữ một mảng strategy và gọi checkAlert()
 * trên mỗi cái — không quan tâm logic bên trong là gì.
 * Chiến lược có thể được thêm / thay / bỏ tại runtime.
 * ============================================================
 */
class AlertStrategy {
  /**
   * Đánh giá xem có nên phát cảnh báo không.
   *
   * @param {bigint} current   - Số dư hiện tại (raw, đơn vị wei)
   * @param {bigint} previous  - Số dư trước đó (raw, đơn vị wei)
   * @param {{ wallet: object, token: object }} context
   * @returns {{ triggered: boolean, level?: 'low'|'medium'|'high', message?: string }}
   */
  checkAlert(current, previous, context) {     // eslint-disable-line no-unused-vars
    throw new Error(`${this.constructor.name}.checkAlert() chưa được implement`);
  }
}

export default AlertStrategy;
