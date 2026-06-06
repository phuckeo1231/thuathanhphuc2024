/**
 * Provider realtime: subscribe Transfer events qua WebSocket RPC.
 * Phản hồi ngay lập tức khi có giao dịch thay vì chờ polling.
 */
import { ethers } from 'ethers';
import eventBus   from '../core/EventBus.js';
import logger     from '../utils/logger.js';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

class WebSocketProvider {
  #provider   = null;
  #contracts  = new Map();
  #balances   = new Map();
  #wallets;
  #tokens;

  constructor({ wsUrl, wallets, tokens }) {
    this.wsUrl    = wsUrl;
    this.#wallets = wallets;
    this.#tokens  = tokens;
  }

  #key(walletAddr, tokenAddr) {
    return `${walletAddr}:${tokenAddr}`;
  }

  async #connect() {
    this.#provider = new ethers.WebSocketProvider(this.wsUrl);
    for (const token of this.#tokens) {
      this.#contracts.set(token.address, new ethers.Contract(token.address, ERC20_ABI, this.#provider));
    }
    logger.info(`[WS] Đã kết nối tới ${this.wsUrl}`);
  }

  async #fetchOne(wallet, token) {
    const contract = this.#contracts.get(token.address);
    return await contract.balanceOf(wallet.address);
  }

  async #initBalances() {
    for (const wallet of this.#wallets) {
      for (const token of this.#tokens) {
        try {
          const balance = await this.#fetchOne(wallet, token);
          this.#balances.set(this.#key(wallet.address, token.address), balance);
        } catch (err) {
          logger.error(`[WS] Init balance lỗi ${wallet.label}/${token.symbol}:`, err.message);
          this.#balances.set(this.#key(wallet.address, token.address), 0n);
        }
      }
    }
    logger.info(`[WS] Đã khởi tạo số dư ban đầu`);
  }

  #subscribeTransfers() {
    const watched = new Map(this.#wallets.map(w => [w.address, w]));

    for (const token of this.#tokens) {
      const contract = this.#contracts.get(token.address);

      contract.on('Transfer', async (from, to, value, eventObj) => {
        from = from.toLowerCase();
        to   = to.toLowerCase();

        const affected = [];
        if (watched.has(from)) affected.push(watched.get(from));
        if (watched.has(to))   affected.push(watched.get(to));

        for (const wallet of affected) {
          const key = this.#key(wallet.address, token.address);
          const previous = this.#balances.get(key) ?? 0n;

          try {
            const current = await this.#fetchOne(wallet, token);
            this.#balances.set(key, current);
            eventBus.emit('balance_change', {
              wallet, token, previous, current,
              txHash:    eventObj.log.transactionHash,
              timestamp: Date.now(),
            });
          } catch (err) {
            logger.error(`[WS] Lỗi cập nhật sau Transfer:`, err.message);
          }
        }
      });
    }

    logger.info(`[WS] Đã subscribe Transfer cho ${this.#tokens.length} token`);
  }

  async start() {
    await this.#connect();
    await this.#initBalances();
    this.#subscribeTransfers();

    eventBus.emit('snapshot', {
      wallets:  this.#wallets,
      tokens:   this.#tokens,
      balances: new Map(this.#balances),
    });
  }

  async addWallet(wallet) {
    if (this.#wallets.find(w => w.address === wallet.address)) return;
    this.#wallets.push(wallet);

    for (const token of this.#tokens) {
      try {
        const balance = await this.#fetchOne(wallet, token);
        this.#balances.set(this.#key(wallet.address, token.address), balance);
      } catch (err) {
        logger.error(`[WS] Init balance lỗi ${wallet.label}/${token.symbol}:`, err.message);
      }
    }

    eventBus.emit('snapshot', {
      wallets:  this.#wallets,
      tokens:   this.#tokens,
      balances: new Map(this.#balances),
    });
  }

  removeWallet(address) {
    const addr = address.toLowerCase();
    const idx = this.#wallets.findIndex(w => w.address === addr);
    if (idx !== -1) this.#wallets.splice(idx, 1);
    for (const key of this.#balances.keys()) {
      if (key.startsWith(`${addr}:`)) this.#balances.delete(key);
    }
  }
}

export default WebSocketProvider;
