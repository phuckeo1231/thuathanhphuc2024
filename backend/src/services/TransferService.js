/**
 * TransferService — giao dịch BEP-20 theo thời gian thực.
 *
 * Có BSCSCAN_API_KEY  → BSCScan tokentx (đầy đủ from/to/hash)
 * Không có API key    → tự suy luận từ balance_change events
 *                       (biết ví + token + delta, không biết counterparty)
 */
import eventBus from '../core/EventBus.js';
import logger   from '../utils/logger.js';

const BSCSCAN   = 'https://api.bscscan.com/v2/api';
const MAX_STORE = 500;

/* ── Label cho các địa chỉ BSC nổi tiếng ─────────────────── */
const KNOWN_LABELS = new Map([
  ['0xf977814e90da44bfa03b6295a0616a897441acec', 'Binance 8'],
  ['0x21a31ee1afc51d94c2efccaa2092ad1028285549', 'Binance 15'],
  ['0x28c6c06298d514db089934071355e5743bf21d60', 'Binance 14'],
  ['0x5a52e96bacdabb82fd05763e25335261b270efcb', 'Binance Treasury'],
  ['0xbe0eb53f46cd790cd13851d5eff43d12404d33e8', 'Binance Cold'],
  ['0xe2fc31f816a9b94326492132018c3aecc4a93ae1', 'Binance 16'],
  ['0xb8c77482e45f1f44de1745f52c74426c631bdd52', 'BNB Token'],
  ['0x5041ed759dd4afc3a72b8192c143f72f4724081f', 'OKX'],
  ['0xcffad3200574698b78f32232aa9d63eabd290703', 'OKX 2'],
  ['0x6cc5f688a315f3dc28a7781717a9a798a59fda7b', 'OKX 3'],
  ['0xf89d7b9c864f589bbf53a82105107622b35eaa40', 'Bybit'],
  ['0x1db3439a222c519ab44bb1144fc28167b4fa6ee6', 'Bybit 2'],
  ['0xd652776de7ad802be5ec7bebfafda37600222a1d', 'KuCoin'],
  ['0x738cf6903e6c4e699d1c2dd9ab8b67fcdb3121ea', 'KuCoin 2'],
  ['0xab5c66752a9e8167967685f1450532fb96d5d24f', 'HTX'],
  ['0x6748f50f686bfbca6fe8ad62b22228b87f31ff2b', 'HTX 2'],
  ['0x0d0707963952f2fba59dd06f2b425ace40b492fe', 'Gate.io'],
  ['0x75e89d5979e4f6fba9f97c104c2f0afb3f1dcb88', 'MEXC'],
  ['0x73feaa1ee314f8c655e354234017be2193c9e24e', 'PancakeSwap MCV1'],
  ['0xa5f8c5dbd5f286960b9d90548680ae5ebff07652', 'PancakeSwap MCV2'],
  ['0x556b9306565093c855aea9ae92a594704c2cd59e', 'PancakeSwap MCV3'],
  ['0x10ed43c718714eb63d5aa57b78b54704e256024e', 'PancakeSwap Router V2'],
  ['0x13f4ea83d0bd40e75c8222255bc855a974568dd4', 'PancakeSwap Router V3'],
  ['0xfd36e2c2a6789db23113685031d7f16329158384', 'Venus Unitroller'],
  ['0xa07c5b74c9b40447a954e1466938b865b6bbea36', 'Venus vBNB'],
  ['0xdef171fe48cf0115b1d80b88dc8eab59176fee57', 'ParaSwap'],
  ['0x1111111254eeb25477b68fb85ed929f73a960582', '1inch V5'],
  ['0x8894e0a0c962cb723c1976a4421c95949be2d4e3', 'BSC Whale 1'],
  ['0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503', 'BSC Whale 2'],
  ['0x59d779bed4db1e734d3fda3172d45bc3063ecd69', 'BSC Whale 3'],
  ['0x0000000000000000000000000000000000001004', 'BSC Staking'],
]);

function resolveLabel(address, walletLabelMap) {
  const a = address?.toLowerCase();
  if (!a) return null;
  return walletLabelMap.get(a) ?? KNOWN_LABELS.get(a) ?? null;
}

function fmtValue(raw, decimals) {
  try {
    const val = Number(BigInt(raw)) / 10 ** parseInt(decimals ?? '18');
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(2)}K`;
    if (val >= 1)   return val.toFixed(2);
    return val.toPrecision(4);
  } catch { return '?'; }
}

function fmtFloat(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  if (n >= 1)   return n.toFixed(2);
  return n.toPrecision(4);
}

function rawValue(raw, decimals) {
  try { return Number(BigInt(raw)) / 10 ** parseInt(decimals ?? '18'); }
  catch { return 0; }
}

/* ── In-memory store ─────────────────────────────────────── */
const store = [];
const seen  = new Set();
let   _saveFn = null;   // inject từ bên ngoài để tránh circular dep

/** Inject hàm lưu DB (gọi từ index.js sau khi DB sẵn sàng) */
export function setTransferSaveFn(fn) { _saveFn = fn; }

/** Khởi tạo store từ dữ liệu DB khi server restart */
export function initStore(transfers) {
  store.length = 0;
  seen.clear();
  for (const tx of transfers) {
    seen.add(`${tx.hash}:${tx.tokenSymbol}`);
    store.push(tx);
  }
  if (store.length) logger.info(`[Transfers] Đã tải ${store.length} giao dịch từ MongoDB`);
}

function addToStore(txs) {
  let added = 0;
  for (const tx of txs) {
    const key = `${tx.hash}:${tx.tokenSymbol}`;
    if (!seen.has(key)) {
      seen.add(key);
      store.unshift(tx);
      added++;
      _saveFn?.(tx).catch(() => {}); // lưu DB, bất đồng bộ, bỏ qua lỗi trùng
    }
  }
  if (store.length > MAX_STORE) store.splice(MAX_STORE);
  return added;
}

export function getTransfers() { return store; }

/* ══════════════════════════════════════════════════════════
   CHẾ ĐỘ 1: BSCScan tokentx (có API key)
   ══════════════════════════════════════════════════════════ */
async function fetchWallet(wallet, walletLabelMap, apiKey) {
  const params = new URLSearchParams({
    chainid: '56', module: 'account', action: 'tokentx',
    address: wallet.address, page: '1', offset: '30', sort: 'desc',
  });
  if (apiKey) params.set('apikey', apiKey);

  let json;
  try {
    const res  = await fetch(`${BSCSCAN}?${params}`, { signal: AbortSignal.timeout(12_000) });
    const text = await res.text();
    json = JSON.parse(text);
  } catch { return []; }

  if (json.status !== '1' || !Array.isArray(json.result)) return [];

  return json.result.map(tx => ({
    hash:            tx.hash,
    timeStamp:       parseInt(tx.timeStamp),
    from:            tx.from?.toLowerCase(),
    fromLabel:       resolveLabel(tx.from, walletLabelMap),
    to:              tx.to?.toLowerCase(),
    toLabel:         resolveLabel(tx.to, walletLabelMap),
    valueFormatted:  fmtValue(tx.value, tx.tokenDecimal),
    valueRaw:        rawValue(tx.value, tx.tokenDecimal),
    tokenSymbol:     tx.tokenSymbol,
    tokenName:       tx.tokenName,
    tokenDecimal:    tx.tokenDecimal,
    contractAddress: tx.contractAddress?.toLowerCase(),
    walletAddress:   wallet.address,
    walletLabel:     wallet.label,
  }));
}

function startBscScanMode(wallets, apiKey) {
  const CYCLE_MS  = 8_000;
  const INIT_TAKE = 5;
  const walletLabelMap = new Map(wallets.map(w => [w.address.toLowerCase(), w.label]));

  logger.info(`[Transfers] Chế độ BSCScan — ${wallets.length} ví | cycle ${CYCLE_MS / 1000}s`);

  let idx = 0;
  async function fetchNext() {
    const wallet = wallets[idx % wallets.length];
    idx++;
    try {
      const txs   = await fetchWallet(wallet, walletLabelMap, apiKey);
      const added = addToStore(txs);
      if (added > 0) {
        logger.debug(`[Transfers] ${wallet.label}: +${added} tx (tổng: ${store.length})`);
        eventBus.emit('transfers', [...store]);
      }
    } catch (err) {
      logger.debug(`[Transfers] ${wallet.label}: ${err.message}`);
    }
  }

  (async () => {
    for (let i = 0; i < Math.min(INIT_TAKE, wallets.length); i++) {
      await fetchNext();
      if (i < INIT_TAKE - 1) await new Promise(r => setTimeout(r, 2_000));
    }
    idx = INIT_TAKE;
  })().catch(err => logger.error('[Transfers] Warm-up lỗi:', err.message));

  setInterval(fetchNext, CYCLE_MS);
}

/* ══════════════════════════════════════════════════════════
   CHẾ ĐỘ 2: Suy luận từ balance_change (không có API key)
   ══════════════════════════════════════════════════════════ */
function startRpcMode(wallets) {
  logger.info(`[Transfers] Chế độ RPC — suy luận từ thay đổi số dư (${wallets.length} ví theo dõi)`);
  logger.warn('[Transfers] Không có BSCSCAN_API_KEY — giao dịch được suy luận từ biến động số dư. Thêm key để xem đầy đủ from/to/hash.');

  const walletSet = new Map(wallets.map(w => [w.address.toLowerCase(), w.label]));

  eventBus.subscribe('balance_change', (data) => {
    const addr = data.wallet?.address?.toLowerCase();
    if (!addr || !walletSet.has(addr)) return;

    let prev, curr;
    try {
      prev = typeof data.previous === 'bigint' ? data.previous : BigInt(data.previous);
      curr = typeof data.current  === 'bigint' ? data.current  : BigInt(data.current);
    } catch { return; }

    const dec   = data.token?.decimals ?? 18;
    const delta = curr - prev;
    if (delta === 0n) return;

    const absDelta    = delta < 0n ? -delta : delta;
    const absDeltaNum = Number(absDelta) / 10 ** dec;
    if (absDeltaNum < 0.0001) return;   // bỏ qua thay đổi quá nhỏ

    const isIncoming = delta > 0n;
    const ts         = Math.floor((data.timestamp ?? Date.now()) / 1000);
    // Tạo hash giả để dedup (timestamp + wallet + token)
    const fakeHash   = `rpc-${ts}-${addr.slice(2, 10)}-${data.token?.symbol}`;

    const tx = {
      hash:           fakeHash,
      timeStamp:      ts,
      from:           isIncoming ? null : addr,
      fromLabel:      isIncoming ? null : data.wallet.label,
      to:             isIncoming ? addr  : null,
      toLabel:        isIncoming ? data.wallet.label : null,
      valueFormatted: fmtFloat(absDeltaNum),
      valueRaw:       absDeltaNum,
      tokenSymbol:    data.token?.symbol ?? '?',
      tokenName:      data.token?.name   ?? data.token?.symbol ?? '?',
      tokenDecimal:   String(dec),
      contractAddress: data.token?.address ?? null,
      walletAddress:  addr,
      walletLabel:    data.wallet.label,
      _derived:       true,   // đánh dấu là suy luận từ delta
    };

    const added = addToStore([tx]);
    if (added > 0) {
      logger.debug(`[Transfers] ${data.wallet.label}: ${isIncoming ? '+' : '-'}${fmtFloat(absDeltaNum)} ${data.token?.symbol} (suy luận)`);
      eventBus.emit('transfers', [...store]);
    }
  });
}

/* ── Khởi động ──────────────────────────────────────────── */
export function startTransferService(wallets) {
  if (!wallets?.length) return;

  const apiKey = process.env.BSCSCAN_API_KEY ?? '';

  if (apiKey) {
    startBscScanMode(wallets, apiKey);
  } else {
    startRpcMode(wallets);
  }
}
