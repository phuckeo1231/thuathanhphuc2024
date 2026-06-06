/**
 * ============================================================
 * DESIGN PATTERN: SINGLETON
 * ============================================================
 * ProviderManager đảm bảo chỉ có MỘT instance provider
 * blockchain tồn tại trong suốt vòng đời ứng dụng.
 *
 * Lý do dùng Singleton ở đây:
 *   - Kết nối WebSocket/HTTP tới BSC rất tốn kém
 *   - Nhiều module (BlockchainService, WsServer) cần dùng
 *     chung một provider, không phải tạo riêng từng cái
 *   - Tránh race condition khi nhiều nơi cùng khởi tạo
 * ============================================================
 */
class ProviderManager {
  /** @type {ProviderManager|null} */
  static #instance = null;

  /** @type {import('../providers/WebSocketProvider.js').default | import('../providers/HttpPollingProvider.js').default | null} */
  #provider = null;

  constructor() {
    if (ProviderManager.#instance) {
      throw new Error('Dùng ProviderManager.getInstance() thay vì new');
    }
  }

  /** @returns {ProviderManager} */
  static getInstance() {
    if (!ProviderManager.#instance) {
      ProviderManager.#instance = new ProviderManager();
    }
    return ProviderManager.#instance;
  }

  setProvider(provider) {
    this.#provider = provider;
  }

  getProvider() {
    if (!this.#provider) throw new Error('Provider chưa được khởi tạo');
    return this.#provider;
  }
}

export default ProviderManager.getInstance();
