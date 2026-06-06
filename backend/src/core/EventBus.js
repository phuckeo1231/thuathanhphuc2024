/**
 * ============================================================
 * DESIGN PATTERN: OBSERVER
 * ============================================================
 * EventBus là hub trung tâm cho toàn bộ ứng dụng.
 *
 * - Subject  : bất kỳ module nào gọi eventBus.emit(event, data)
 * - Observer : bất kỳ module nào gọi eventBus.subscribe(event, fn)
 *
 * Các sự kiện chính:
 *   'snapshot'       — dữ liệu ban đầu sau khi kết nối blockchain
 *   'balance_change' — số dư ví thay đổi sau một giao dịch
 *   'alert'          — một chiến lược cảnh báo được kích hoạt
 * ============================================================
 */
class EventBus {
  /** @type {Map<string, Set<Function>>} */
  #listeners = new Map();

  /**
   * Đăng ký lắng nghe một sự kiện.
   * @param {string} event
   * @param {Function} listener
   * @returns {Function} hàm huỷ đăng ký
   */
  subscribe(event, listener) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(listener);
    return () => this.#listeners.get(event)?.delete(listener);
  }

  /**
   * Phát một sự kiện tới tất cả observer đã đăng ký.
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    this.#listeners.get(event)?.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error(`[EventBus] Lỗi trong listener '${event}':`, err.message);
      }
    });
  }
}

// Export một instance duy nhất — dùng chung toàn ứng dụng
export default new EventBus();
