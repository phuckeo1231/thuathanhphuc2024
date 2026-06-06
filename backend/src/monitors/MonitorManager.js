import WalletMonitor           from './WalletMonitor.js';
import ThresholdAlertStrategy  from '../strategies/ThresholdAlertStrategy.js';
import PercentChangeStrategy   from '../strategies/PercentChangeStrategy.js';
import AbsoluteChangeStrategy  from '../strategies/AbsoluteChangeStrategy.js';

class MonitorManager {
  #entries = new Map();      // addr → { monitor, wallet }
  #alertConfig = {};         // global config
  #walletConfigs = new Map(); // addr → per-wallet overrides

  /** Khởi tạo ban đầu với danh sách ví từ config */
  init(wallets, alertConfig = {}) {
    this.#alertConfig = { absoluteChangeRaw: 100_000_000_000_000_000_000n, ...alertConfig };
    for (const wallet of wallets) {
      this.#start(wallet);
    }
  }

  /** Thêm ví mới lúc runtime (gọi từ REST API) */
  addWallet(wallet) {
    const addr = wallet.address.toLowerCase();
    if (this.#entries.has(addr)) return false;
    this.#start({ ...wallet, address: addr });
    return true;
  }

  /** Xóa ví lúc runtime */
  removeWallet(address) {
    const addr = address.toLowerCase();
    const entry = this.#entries.get(addr);
    if (!entry) return false;
    entry.monitor.stop();
    this.#entries.delete(addr);
    this.#walletConfigs.delete(addr);
    return true;
  }

  /** Danh sách ví đang được theo dõi */
  listWallets() {
    return [...this.#entries.values()].map(e => e.wallet);
  }

  /** Cập nhật cấu hình toàn cục — áp dụng ngay, tôn trọng override từng ví */
  updateAlertConfig(newConfig) {
    this.#alertConfig = { ...this.#alertConfig, ...newConfig };
    for (const [addr, entry] of this.#entries) {
      entry.monitor.setStrategies(this.#buildStrategies(this.#mergedConfig(addr)));
    }
  }

  getAlertConfig() {
    return { ...this.#alertConfig };
  }

  /** Lấy cấu hình hợp nhất của một ví (global + override) */
  getWalletAlertConfig(address) {
    const addr     = address.toLowerCase();
    const override = this.#walletConfigs.get(addr) ?? {};
    return { ...this.#alertConfig, ...override, hasOverride: Object.keys(override).length > 0 };
  }

  /** Ghi đè cấu hình cho một ví cụ thể và áp dụng ngay */
  updateWalletAlertConfig(address, config) {
    const addr = address.toLowerCase();
    this.#walletConfigs.set(addr, { ...config });
    const entry = this.#entries.get(addr);
    if (entry) {
      entry.monitor.setStrategies(this.#buildStrategies(this.#mergedConfig(addr)));
    }
  }

  /** Xóa override, quay về cấu hình toàn cục */
  resetWalletAlertConfig(address) {
    const addr = address.toLowerCase();
    this.#walletConfigs.delete(addr);
    const entry = this.#entries.get(addr);
    if (entry) {
      entry.monitor.setStrategies(this.#buildStrategies(this.#alertConfig));
    }
  }

  stopAll() {
    for (const entry of this.#entries.values()) entry.monitor.stop();
    this.#entries.clear();
  }

  /* ── private ── */
  #mergedConfig(addr) {
    return { ...this.#alertConfig, ...(this.#walletConfigs.get(addr) ?? {}) };
  }

  #buildStrategies(cfg) {
    const {
      thresholdRaw      = 1_000_000_000_000_000_000n,
      changePercent     = 1,
      absoluteChangeRaw = 100_000_000_000_000_000_000n,
    } = cfg;
    return [
      new ThresholdAlertStrategy(thresholdRaw),
      new PercentChangeStrategy(changePercent),
      new AbsoluteChangeStrategy(absoluteChangeRaw),
    ];
  }

  #start(wallet) {
    const cfg     = this.#mergedConfig(wallet.address);
    const monitor = new WalletMonitor(wallet);
    for (const s of this.#buildStrategies(cfg)) monitor.addStrategy(s);
    monitor.start();
    this.#entries.set(wallet.address, { monitor, wallet });
  }
}

export default MonitorManager;
