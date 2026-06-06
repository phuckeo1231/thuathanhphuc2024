/**
 * Provider dự phòng: lấy số dư bằng HTTP polling định kỳ.
 * Phù hợp khi không có WebSocket RPC hoặc cần độ tin cậy cao hơn.
 */
import { ethers } from 'ethers';
import eventBus   from '../core/EventBus.js';
import logger     from '../utils/logger.js';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
];

/* ── Danh sách BSC RPC dự phòng ─────────────────────────── */
const FALLBACK_URLS = [
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
  'https://rpc.ankr.com/bsc',
  'https://bsc.publicnode.com',
];

class HttpPollingProvider {
  #provider     = null;
  #contracts    = new Map();   // tokenAddr → Contract
  #balances     = new Map();   // "walletAddr:tokenAddr" → bigint
  #timer        = null;
  #wallets;
  #tokens;
  #pollInterval;
  #urlList;
  #urlIdx       = 0;
  #failCount    = 0;

  constructor({ httpUrl, wallets, tokens, pollInterval = 15000 }) {
    // Xây dựng danh sách URL: ưu tiên URL từ config, sau đó dùng fallback
    const primary = httpUrl || FALLBACK_URLS[0];
    const others  = FALLBACK_URLS.filter(u => u !== primary);
    this.#urlList      = [primary, ...others];
    this.#wallets      = wallets;
    this.#tokens       = tokens;
    this.#pollInterval = pollInterval;
  }

  #key(walletAddr, tokenAddr) {
    return `${walletAddr}:${tokenAddr}`;
  }

  async #connect() {
    const url = this.#urlList[this.#urlIdx % this.#urlList.length];
    this.#provider = new ethers.JsonRpcProvider(url);
    this.#contracts.clear();
    for (const token of this.#tokens) {
      this.#contracts.set(token.address, new ethers.Contract(token.address, ERC20_ABI, this.#provider));
    }
    logger.info(`[HTTP] Đã kết nối tới ${url}`);
  }

  async #switchToNextUrl() {
    this.#urlIdx = (this.#urlIdx + 1) % this.#urlList.length;
    this.#failCount = 0;
    logger.warn(`[HTTP] Chuyển sang node dự phòng: ${this.#urlList[this.#urlIdx]}`);
    await this.#connect();
  }

  async #fetchOne(wallet, token) {
    const contract = this.#contracts.get(token.address);
    return await contract.balanceOf(wallet.address);
  }

  async #pollOne(wallet, token) {
    try {
      const key      = this.#key(wallet.address, token.address);
      const previous = this.#balances.get(key) ?? 0n;
      const current  = await this.#fetchOne(wallet, token);
      this.#failCount = 0;
      if (current !== previous) {
        this.#balances.set(key, current);
        eventBus.emit('balance_change', { wallet, token, previous, current, txHash: null, timestamp: Date.now() });
      }
    } catch (err) {
      this.#failCount++;
      logger.error(`[HTTP] Lỗi poll ${wallet.label}/${token.symbol}: ${err.message}`);
      // Sau 5 lỗi liên tiếp → chuyển sang node RPC dự phòng
      if (this.#failCount >= 5) {
        await this.#switchToNextUrl().catch(e => logger.error('[HTTP] Chuyển node thất bại:', e.message));
      }
    }
  }

  async #poll() {
    // Fetch tất cả ví × token song song để giảm thời gian chờ
    const tasks = [];
    for (const wallet of this.#wallets) {
      for (const token of this.#tokens) {
        tasks.push(this.#pollOne(wallet, token));
      }
    }
    await Promise.all(tasks);
  }

  async start() {
    await this.#connect();

    // Gửi danh sách ví ngay lập tức — frontend hiển thị ví trước khi có số dư
    eventBus.emit('wallets_update', { wallets: this.#wallets });

    await this.#poll(); // Lấy dữ liệu ban đầu (song song)

    // Gửi snapshot đầy đủ sau khi poll xong
    eventBus.emit('snapshot', {
      wallets:  this.#wallets,
      tokens:   this.#tokens,
      balances: new Map(this.#balances),
    });

    this.#timer = setInterval(() => this.#poll(), this.#pollInterval);
    logger.info(`[HTTP] Polling mỗi ${this.#pollInterval / 1000}s cho ${this.#wallets.length} ví × ${this.#tokens.length} token`);
  }

  addWallet(wallet) {
    if (!this.#wallets.find(w => w.address === wallet.address)) {
      this.#wallets.push(wallet);
      this.#poll()
        .then(() => {
          eventBus.emit('snapshot', {
            wallets:  this.#wallets,
            tokens:   this.#tokens,
            balances: new Map(this.#balances),
          });
        })
        .catch(err => logger.error('[HTTP] Poll sau khi thêm ví lỗi:', err.message));
    }
  }

  removeWallet(address) {
    const addr = address.toLowerCase();
    const idx = this.#wallets.findIndex(w => w.address === addr);
    if (idx !== -1) this.#wallets.splice(idx, 1);
    for (const key of this.#balances.keys()) {
      if (key.startsWith(`${addr}:`)) this.#balances.delete(key);
    }
  }

  stop() {
    if (this.#timer) clearInterval(this.#timer);
  }
}

export default HttpPollingProvider;
