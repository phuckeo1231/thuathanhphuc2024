import { config as loadEnv } from 'dotenv';
loadEnv();

function makeToken(address, symbol, decimals, name) {
  return { address: address.toLowerCase(), symbol, decimals, name };
}

function makeWallet(address, label, { category = 'other', logo = '💼', website = '', description = '' } = {}) {
  return { address: address.toLowerCase(), label, category, logo, website, description };
}

/* ── Metadata cho các địa chỉ BSC nổi tiếng ─────────────────
   Dùng để làm giàu ví từ .env (vốn chỉ có address + label).   */
const KNOWN_META = new Map([
  // Binance
  ['0xf977814e90da44bfa03b6295a0616a897441acec', { category: 'exchange', logo: '🟡', website: 'https://www.binance.com', description: 'Ví nóng Binance — xử lý giao dịch nạp/rút BSC hàng ngày' }],
  ['0x21a31ee1afc51d94c2efccaa2092ad1028285549', { category: 'exchange', logo: '🟡', website: 'https://www.binance.com', description: 'Ví nóng Binance — lưu lượng giao dịch lớn, thường xuyên biến động' }],
  ['0x28c6c06298d514db089934071355e5743bf21d60', { category: 'exchange', logo: '🟡', website: 'https://www.binance.com', description: 'Ví nóng Binance — một trong các ví chính xử lý BNB và BEP-20' }],
  ['0x5a52e96bacdabb82fd05763e25335261b270efcb', { category: 'exchange', logo: '🏦', website: 'https://www.binance.com', description: 'Quỹ dự trữ Binance — lưu tài sản chiến lược dài hạn' }],
  ['0xbe0eb53f46cd790cd13851d5eff43d12404d33e8', { category: 'exchange', logo: '❄️', website: 'https://www.binance.com', description: 'Ví lạnh Binance — bảo quản số lượng lớn tài sản dài hạn' }],
  ['0xe2fc31f816a9b94326492132018c3aecc4a93ae1', { category: 'exchange', logo: '🟡', website: 'https://www.binance.com', description: 'Ví nóng Binance thế hệ mới — tăng tốc xử lý BSC transactions' }],
  ['0xb8c77482e45f1f44de1745f52c74426c631bdd52', { category: 'exchange', logo: '🪙', website: 'https://www.bnbchain.org', description: 'Contract phát hành token BNB — một trong những ví lớn nhất BSC' }],
  // OKX
  ['0x5041ed759dd4afc3a72b8192c143f72f4724081f', { category: 'exchange', logo: '⚫', website: 'https://www.okx.com', description: 'Ví nóng OKX — sàn giao dịch lớn thứ 2 thế giới theo khối lượng' }],
  ['0xcffad3200574698b78f32232aa9d63eabd290703', { category: 'exchange', logo: '⚫', website: 'https://www.okx.com', description: 'Ví nóng OKX phụ — xử lý giao dịch BSC và BEP-20' }],
  ['0x6cc5f688a315f3dc28a7781717a9a798a59fda7b', { category: 'exchange', logo: '⚫', website: 'https://www.okx.com', description: 'Ví nóng OKX mở rộng — hỗ trợ khối lượng giao dịch lớn' }],
  // Bybit
  ['0xf89d7b9c864f589bbf53a82105107622b35eaa40', { category: 'exchange', logo: '🔶', website: 'https://www.bybit.com', description: 'Ví nóng Bybit — sàn giao dịch hợp đồng tương lai hàng đầu' }],
  ['0x1db3439a222c519ab44bb1144fc28167b4fa6ee6', { category: 'exchange', logo: '🔶', website: 'https://www.bybit.com', description: 'Ví nóng Bybit phụ — xử lý thanh khoản BSC' }],
  // KuCoin
  ['0xd652776de7ad802be5ec7bebfafda37600222a1d', { category: 'exchange', logo: '🟢', website: 'https://www.kucoin.com', description: "Ví nóng KuCoin — sàn mệnh danh \"People's Exchange\"" }],
  ['0x738cf6903e6c4e699d1c2dd9ab8b67fcdb3121ea', { category: 'exchange', logo: '🟢', website: 'https://www.kucoin.com', description: 'Ví nóng KuCoin phụ — phục vụ nạp/rút token BSC' }],
  // HTX (Huobi)
  ['0xab5c66752a9e8167967685f1450532fb96d5d24f', { category: 'exchange', logo: '🔵', website: 'https://www.htx.com', description: 'Ví nóng HTX (Huobi) — sàn lâu đời thành lập năm 2013' }],
  ['0x6748f50f686bfbca6fe8ad62b22228b87f31ff2b', { category: 'exchange', logo: '🔵', website: 'https://www.htx.com', description: 'Ví nóng HTX phụ — xử lý giao dịch khu vực châu Á' }],
  // Gate.io
  ['0x0d0707963952f2fba59dd06f2b425ace40b492fe', { category: 'exchange', logo: '🚪', website: 'https://www.gate.io', description: 'Ví nóng Gate.io — sàn có danh mục token đa dạng nhất thị trường' }],
  // MEXC
  ['0x75e89d5979e4f6fba9f97c104c2f0afb3f1dcb88', { category: 'exchange', logo: '🔷', website: 'https://www.mexc.com', description: 'Ví nóng MEXC — nổi tiếng với listing token mới sớm nhất' }],
  // PancakeSwap
  ['0x73feaa1ee314f8c655e354234017be2193c9e24e', { category: 'defi', logo: '🥞', website: 'https://pancakeswap.finance', description: 'MasterChef V1 — hợp đồng farming phân phối CAKE cho liquidity providers' }],
  ['0xa5f8c5dbd5f286960b9d90548680ae5ebff07652', { category: 'defi', logo: '🥞', website: 'https://pancakeswap.finance', description: 'MasterChef V2 — phiên bản cải tiến, hỗ trợ nhiều pool farming hơn' }],
  ['0x556b9306565093c855aea9ae92a594704c2cd59e', { category: 'defi', logo: '🥞', website: 'https://pancakeswap.finance', description: 'MasterChef V3 — farming với concentrated liquidity (CLMM)' }],
  ['0x10ed43c718714eb63d5aa57b78b54704e256024e', { category: 'defi', logo: '🔄', website: 'https://pancakeswap.finance', description: 'Router V2 — định tuyến mọi giao dịch swap trên PancakeSwap' }],
  // Venus
  ['0xfd36e2c2a6789db23113685031d7f16329158384', { category: 'defi', logo: '♀️', website: 'https://venus.io', description: 'Venus Unitroller — giao thức cho vay/thế chấp BSC lớn nhất' }],
  ['0xa07c5b74c9b40447a954e1466938b865b6bbea36', { category: 'defi', logo: '♀️', website: 'https://venus.io', description: 'Venus vBNB — pool thế chấp và cho vay BNB native' }],
  // ParaSwap
  ['0xdef171fe48cf0115b1d80b88dc8eab59176fee57', { category: 'defi', logo: '⚡', website: 'https://www.paraswap.io', description: 'DEX aggregator — tổng hợp thanh khoản từ nhiều AMM để tối ưu giá' }],
  // BSC Whales
  ['0x8894e0a0c962cb723c1976a4421c95949be2d4e3', { category: 'whale', logo: '🐋', website: '', description: 'Ví cá voi ẩn danh — nắm giữ lượng lớn BNB và token blue-chip BSC' }],
  ['0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503', { category: 'whale', logo: '🐋', website: '', description: 'Cá voi lớn — thường xuyên giao dịch trên PancakeSwap' }],
  ['0x59d779bed4db1e734d3fda3172d45bc3063ecd69', { category: 'whale', logo: '🐳', website: '', description: 'Ví cá voi BSC — theo dõi để phát hiện tín hiệu dịch chuyển thị trường' }],
]);

function enrichMeta(address) {
  return KNOWN_META.get(address.toLowerCase()) ?? {};
}

/* ── Đọc danh sách ví từ env (WALLET_1, WALLET_2...) ────────
   Ví từ .env được làm giàu tự động nếu địa chỉ có trong KNOWN_META. */
function readWallets() {
  const wallets = [];
  let i = 1;
  while (process.env[`WALLET_${i}`]) {
    const addr  = process.env[`WALLET_${i}`].trim();
    const label = process.env[`WALLET_${i}_LABEL`] ?? `Ví BSC ${i}`;
    wallets.push(makeWallet(addr, label, enrichMeta(addr)));
    i++;
  }

  // Ví mặc định khi không có .env
  if (wallets.length === 0) {
    for (const [address, meta] of KNOWN_META) {
      wallets.push(makeWallet(address, meta._label ?? labelFromMeta(address, meta), meta));
    }
  }
  return wallets;
}

function labelFromMeta(address, meta) {
  // Sinh label từ website + category nếu không có _label
  const site = meta.website?.replace(/https?:\/\/(?:www\.)?/, '').split('/')[0] ?? '';
  return site ? `${site} Wallet` : `${address.slice(0, 8)}…`;
}

export default {
  PORT:             parseInt(process.env.PORT ?? '8080'),
  MONGODB_URI:      process.env.MONGODB_URI ?? 'mongodb://localhost:27017/bsc-monitor',
  PROVIDER_TYPE:    process.env.PROVIDER_TYPE ?? 'bscscan',
  BSC_HTTP_URL:     process.env.BSC_HTTP_URL ?? 'https://bsc-dataseed.binance.org',
  BSC_WS_URL:       process.env.BSC_WS_URL   ?? 'wss://bsc.publicnode.com',
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS ?? '15000'),
  BSCSCAN_POLL_MS:  parseInt(process.env.BSCSCAN_POLL_MS  ?? '120000'),
  BSCSCAN_CONCURRENCY: parseInt(process.env.BSCSCAN_CONCURRENCY ?? '10'),
  BSCSCAN_STAGGER_MS:  parseInt(process.env.BSCSCAN_STAGGER_MS  ?? '50'),

  ALERT_THRESHOLD_RAW:       BigInt(process.env.ALERT_THRESHOLD_RAW ?? '1000000000000000000'),
  ALERT_CHANGE_PERCENT:      parseFloat(process.env.ALERT_CHANGE_PERCENT ?? '1'),
  ALERT_ABSOLUTE_CHANGE_RAW: BigInt(process.env.ALERT_ABSOLUTE_CHANGE_RAW ?? '100000000000000000000'), // 100 BNB/token

  wallets: readWallets(),

  tokens: [
    makeToken('0x55d398326f99059fF775485246999027B3197955', 'USDT', 18, 'Tether USD'),
    makeToken('0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 'USDC', 18, 'USD Coin'),
    makeToken('0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', 'CAKE', 18, 'PancakeSwap Token'),
  ],
};
