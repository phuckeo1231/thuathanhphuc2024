/**
 * BscScanProvider — lấy số dư ví BSC.
 *
 * Không cần API key:
 *  - BNB qua eth_getBalance (batch JSON-RPC, public node)
 *  - 12 token phổ biến qua eth_call balanceOf (batch JSON-RPC)
 *
 * Có API key (BSCSCAN_API_KEY):
 *  - Thêm BSCScan tokenlist để phát hiện mọi token BEP-20
 */
import eventBus from '../core/EventBus.js';
import logger   from '../utils/logger.js';

/* ── BSC public RPC endpoints (fallback) ─────────────────── */
const DEFAULT_RPC_URLS = [
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.binance.org/',
  'https://rpc.ankr.com/bsc',
  'https://bsc.publicnode.com',
];

const BSCSCAN    = 'https://api.bscscan.com/v2/api';
const BATCH_SIZE = 50;   // số call JSON-RPC mỗi batch
const BSC_BATCH  = 20;   // balancemulti tối đa 20 địa chỉ

/* ── Địa chỉ native BNB ──────────────────────────────────── */
const BNB_ADDR  = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const BNB_TOKEN = { address: BNB_ADDR, symbol: 'BNB', decimals: 18, name: 'BNB' };

/* ── 13 token phổ biến nhất trên BSC ────────────────────── */
const POPULAR_TOKENS = [
  { address: '0x55d398326f99059ff775485246999027b3197955', symbol: 'USDT',  decimals: 18, name: 'Tether USD' },
  { address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', symbol: 'USDC',  decimals: 18, name: 'USD Coin' },
  { address: '0xe9e7cea3dedca5984780bafc599bd69add087d56', symbol: 'BUSD',  decimals: 18, name: 'BUSD' },
  { address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', symbol: 'WBNB',  decimals: 18, name: 'Wrapped BNB' },
  { address: '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c', symbol: 'BTCB',  decimals: 18, name: 'Bitcoin BEP2' },
  { address: '0x2170ed0880ac9a755fd29b2688956bd959f933f8', symbol: 'ETH',   decimals: 18, name: 'Ethereum' },
  { address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82', symbol: 'CAKE',  decimals: 18, name: 'PancakeSwap' },
  { address: '0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe', symbol: 'XRP',   decimals: 18, name: 'XRP Token' },
  { address: '0x3ee2200efb3400fabb9aacf31297cbdd1d435d47', symbol: 'ADA',   decimals: 18, name: 'Cardano' },
  { address: '0xba2ae424d960c26247dd6c32edc70b295c744c43', symbol: 'DOGE',  decimals:  8, name: 'Dogecoin' },
  { address: '0x7083609fce4d1d8dc0c979aab8c869ea2c873402', symbol: 'DOT',   decimals: 18, name: 'Polkadot' },
  { address: '0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd', symbol: 'LINK',  decimals: 18, name: 'Chainlink' },
  { address: '0x1ce0c2827e2ef14d5c4f29a091d735a204794041', symbol: 'AVAX',  decimals: 18, name: 'Avalanche' },
];

/* ── Semaphore: giới hạn số request song song ─────────────── */
class Semaphore {
  #slots; #queue = [];
  constructor(n) { this.#slots = n; }
  acquire() {
    if (this.#slots > 0) { this.#slots--; return Promise.resolve(); }
    return new Promise(r => this.#queue.push(r));
  }
  release() {
    if (this.#queue.length > 0) this.#queue.shift()();
    else this.#slots++;
  }
}

class BscScanProvider {
  #wallets;
  #apiKey;
  #pollInterval;
  #timer    = null;
  #balances = new Map();
  #tokens   = new Map();
  #rpcIdx   = 0;
  #rpcUrls;
  #sem;
  #concurrency;
  #staggerMs;

  constructor({ wallets, pollInterval = 60_000, rpcUrl = '', concurrency = 10, staggerMs = 50 }) {
    this.#wallets      = wallets;
    this.#apiKey       = process.env.BSCSCAN_API_KEY ?? '';
    this.#pollInterval = pollInterval;
    this.#concurrency  = Math.max(1, Number(concurrency) || 10);
    this.#staggerMs    = Math.max(0, Number(staggerMs) || 50);
    this.#rpcUrls      = [...new Set([rpcUrl, ...DEFAULT_RPC_URLS].filter(Boolean))];
    this.#sem          = new Semaphore(this.#concurrency);

    // Nạp BNB + 13 token phổ biến vào registry
    this.#tokens.set(BNB_ADDR, BNB_TOKEN);
    for (const t of POPULAR_TOKENS) this.#tokens.set(t.address, t);
  }

  /* ── Sleep ──────────────────────────────────────────────── */
  #sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ── Gọi BSC JSON-RPC (batch) ───────────────────────────── */
  async #rpcBatch(calls) {
    const url = this.#rpcUrls[this.#rpcIdx % this.#rpcUrls.length];
    try {
      const res  = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(calls),
        signal:  AbortSignal.timeout(15_000),
      });
      const data = await res.json();
      // Trả kết quả theo thứ tự id
      const map = {};
      for (const item of (Array.isArray(data) ? data : [data])) {
        map[item.id] = item.result ?? null;
      }
      return map;
    } catch (err) {
      logger.debug(`[BscScan] RPC lỗi (${url}): ${err.message}`);
      // Thử node tiếp theo
      this.#rpcIdx = (this.#rpcIdx + 1) % this.#rpcUrls.length;
      return {};
    }
  }

  /* ── Lấy BNB cho tất cả ví qua eth_getBalance (batch) ───── */
  async #fetchBnbBatch(wallets) {
    const calls = wallets.map((w, i) => ({
      jsonrpc: '2.0',
      method:  'eth_getBalance',
      params:  [w.address, 'latest'],
      id:      i,
    }));

    // Chia thành các batch nhỏ
    const result = {};
    for (let i = 0; i < calls.length; i += BATCH_SIZE) {
      const chunk = calls.slice(i, i + BATCH_SIZE);
      const map   = await this.#rpcBatch(chunk);
      for (const [id, hex] of Object.entries(map)) {
        const wallet = wallets[parseInt(id)];
        if (!wallet || !hex) continue;
        try { result[wallet.address] = BigInt(hex); } catch { /* bỏ qua */ }
      }
    }
    return result;
  }

  /* ── Lấy balanceOf cho 1 ví × nhiều token (batch) ───────── */
  async #fetchTokenBalances(wallet) {
    const tokens = [...this.#tokens.values()].filter(t => t.address !== BNB_ADDR);
    const calls  = tokens.map((t, i) => {
      const padded = wallet.address.slice(2).padStart(64, '0');
      return {
        jsonrpc: '2.0',
        method:  'eth_call',
        params:  [{ to: t.address, data: `0x70a08231${padded}` }, 'latest'],
        id:      i,
      };
    });

    const result = {};
    for (let i = 0; i < calls.length; i += BATCH_SIZE) {
      const chunk = calls.slice(i, i + BATCH_SIZE);
      const map   = await this.#rpcBatch(chunk);
      for (const [id, hex] of Object.entries(map)) {
        const token = tokens[parseInt(id)];
        if (!token || !hex || hex === '0x') continue;
        try {
          const bal = BigInt(hex);
          if (bal > 0n) result[token.address] = bal;
        } catch { /* bỏ qua */ }
      }
    }
    return result;
  }

  /* ── Lấy token list từ BSCScan (chỉ khi có API key) ──────── */
  async #fetchBscScanTokenList(wallet) {
    if (!this.#apiKey) return [];
    const qs = new URLSearchParams({
      chainid: '56',
      module:  'account',
      action:  'tokenlist',
      address: wallet.address,
      apikey:  this.#apiKey,
    });
    try {
      const res  = await fetch(`${BSCSCAN}?${qs}`, { signal: AbortSignal.timeout(12_000) });
      const text = await res.text();
      const json = JSON.parse(text);
      if (json.status !== '1' || !Array.isArray(json.result)) return [];
      const result = [];
      for (const t of json.result) {
        if (t.type !== 'ERC-20') continue;
        let bal;
        try { bal = BigInt(t.balance ?? '0'); } catch { continue; }
        if (bal === 0n) continue;
        result.push({
          token: {
            address:  t.contractAddress.toLowerCase(),
            symbol:   t.symbol   || 'UNKNOWN',
            decimals: parseInt(t.decimals ?? '18', 10),
            name:     t.name     || t.symbol || '?',
          },
          balance: bal,
        });
      }
      return result;
    } catch {
      return [];
    }
  }

  /* ── Phát sự kiện thay đổi số dư ───────────────────────── */
  #emitChange(wallet, token, prev, curr) {
    if (curr === prev) return;
    eventBus.emit('balance_change', {
      wallet, token,
      previous:  prev,
      current:   curr,
      txHash:    null,
      timestamp: Date.now(),
    });
  }

  /* ── Emit snapshot ─────────────────────────────────────── */
  #emitSnapshot({ complete = true } = {}) {
    eventBus.emit('snapshot', {
      wallets:  this.#wallets,
      tokens:   Array.from(this.#tokens.values()),
      balances: new Map(this.#balances),
      balancesLoaded: complete,
    });
  }

  /* ── Poll 1 ví: balanceOf popular + BSCScan tokenlist ───── */
  async #pollWallet(wallet) {
    await this.#sem.acquire();
    try {
      /* Phase A: RPC balanceOf cho tất cả popular tokens */
      const tokenBals = await this.#fetchTokenBalances(wallet);
      for (const [tokenAddr, bal] of Object.entries(tokenBals)) {
        const token = this.#tokens.get(tokenAddr);
        if (!token) continue;
        const key  = `${wallet.address}:${tokenAddr}`;
        const prev = this.#balances.get(key) ?? 0n;
        this.#balances.set(key, bal);
        this.#emitChange(wallet, token, prev, bal);
      }

      /* Phase B: BSCScan tokenlist (nếu có API key — phát hiện thêm token) */
      if (this.#apiKey) {
        const extras = await this.#fetchBscScanTokenList(wallet);
        for (const { token, balance } of extras) {
          if (!this.#tokens.has(token.address)) {
            this.#tokens.set(token.address, token);
          }
          const key  = `${wallet.address}:${token.address}`;
          const prev = this.#balances.get(key) ?? 0n;
          this.#balances.set(key, balance);
          this.#emitChange(wallet, token, prev, balance);
        }
        logger.debug(`[BscScan] ${wallet.label}: ${extras.length} token bổ sung từ BSCScan`);
      }
    } catch (err) {
      logger.error(`[BscScan] Lỗi poll ${wallet.label}: ${err.message}`);
    } finally {
      this.#sem.release();
    }
  }

  /* ── Poll toàn bộ ───────────────────────────────────────── */
  async #pollAll() {
    const wallets = this.#wallets;

    /* Bước 1: BNB tất cả ví (batch eth_getBalance — nhanh) */
    const bnbMap = await this.#fetchBnbBatch(wallets);
    let bnbCount = 0;
    for (const wallet of wallets) {
      const bnb = bnbMap[wallet.address];
      if (bnb !== undefined) {
        const key  = `${wallet.address}:${BNB_ADDR}`;
        const prev = this.#balances.get(key) ?? 0n;
        this.#balances.set(key, bnb);
        this.#emitChange(wallet, BNB_TOKEN, prev, bnb);
        if (bnb > 0n) bnbCount++;
      }
    }
    this.#emitSnapshot({ complete: false });
    logger.info(`[BscScan] BNB xong — ${bnbCount}/${wallets.length} ví có số dư`);

    /* Bước 2: Token balances song song */
    await Promise.all(
      wallets.map((w, i) =>
        this.#sleep(i * this.#staggerMs)
          .then(() => this.#pollWallet(w))
          .then(() => eventBus.emit('wallet_scanned', { walletAddress: w.address }))
      )
    );

    this.#emitSnapshot({ complete: true });
    logger.info(`[BscScan] Snapshot đầy đủ — ${wallets.length} ví, ${this.#tokens.size} token, ${this.#balances.size} số dư`);
  }

  /* ── Thêm / Xóa ví ──────────────────────────────────────── */
  addWallet(wallet) {
    if (!this.#wallets.find(w => w.address === wallet.address)) {
      this.#wallets.push(wallet);
      this.#pollAll().catch(err => logger.error('[BscScan] Poll sau khi thêm ví lỗi:', err.message));
    }
  }

  removeWallet(address) {
    const idx = this.#wallets.findIndex(w => w.address === address);
    if (idx !== -1) this.#wallets.splice(idx, 1);
    for (const key of this.#balances.keys()) {
      if (key.startsWith(`${address}:`)) this.#balances.delete(key);
    }
  }

  /* ── Khởi động ──────────────────────────────────────────── */
  async start() {
    const mode = this.#apiKey
      ? 'RPC + BSCScan tokenlist'
      : 'RPC (public node) — không có API key';
    logger.info(`[BscScan] Khởi động — ${this.#wallets.length} ví | ${mode} | poll ${this.#pollInterval / 1000}s`);
    logger.info(`[BscScan] RPC ưu tiên: ${this.#rpcUrls[0]} | song song: ${this.#concurrency} | delay ví: ${this.#staggerMs}ms`);

    if (!this.#apiKey) {
      logger.warn('[BscScan] Không có BSCSCAN_API_KEY — chỉ theo dõi BNB + 13 token phổ biến. Thêm key vào .env để theo dõi mọi token BEP-20.');
    }

    eventBus.emit('wallets_update', { wallets: this.#wallets });
    await this.#pollAll();

    this.#timer = setInterval(
      () => this.#pollAll().catch(e => logger.error('[BscScan] Poll error:', e.message)),
      this.#pollInterval,
    );
  }

  stop() {
    if (this.#timer) clearInterval(this.#timer);
  }
}

export default BscScanProvider;
