/**
 * ArkhamService — lấy dữ liệu xu hướng từ intel.arkm.com
 *
 * Hai chế độ xác thực (ưu tiên theo thứ tự):
 *
 *  1. ARKHAM_COOKIE — dùng session cookie từ trình duyệt đã đăng nhập
 *     Cách lấy:
 *       a. Đăng nhập vào https://intel.arkm.com/
 *       b. Mở DevTools (F12) → tab Network
 *       c. Reload trang, click bất kỳ request nào tới intel.arkm.com
 *       d. Trong Headers → Request Headers → sao chép toàn bộ giá trị "Cookie:"
 *       e. Dán vào .env: ARKHAM_COOKIE=__session=xxx; _ga=xxx; ...
 *
 *  2. ARKHAM_API_KEY — API key chính thức (api.arkm.com)
 *     Đăng ký tại: https://info.arkm.com/api-platform
 *
 * Nếu cả hai đều trống → TrendingPanel dùng mock data tự động.
 */
import eventBus from '../core/EventBus.js';
import logger   from '../utils/logger.js';

/* ── Cấu hình ─────────────────────────────────────────────── */
const FETCH_INTERVAL    = 5 * 60 * 1_000;  // 5 phút
const INTEL_BASE        = 'https://intel.arkm.com';
const OFFICIAL_API_BASE = 'https://api.arkm.com';

/* ── Xây dựng headers ─────────────────────────────────────── */
function buildHeaders(mode) {
  const common = {
    'Accept':          'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer':         'https://intel.arkm.com/',
    'Origin':          'https://intel.arkm.com',
  };

  if (mode === 'cookie') {
    return { ...common, 'Cookie': process.env.ARKHAM_COOKIE };
  }
  if (mode === 'apikey') {
    return { ...common, 'API-Key': process.env.ARKHAM_API_KEY };
  }
  return common;
}

/* ── Phát hiện chế độ xác thực ───────────────────────────── */
function detectMode() {
  if (process.env.ARKHAM_COOKIE) return 'cookie';
  if (process.env.ARKHAM_API_KEY) return 'apikey';
  return null;
}

/* ── Chuyển đổi transfer → TrendCard ─────────────────────── */
function transferToCard(tx, idx) {
  const from   = tx.fromEntity?.name   ?? tx.fromLabel   ?? (tx.fromAddress?.slice(0, 8) + '…');
  const to     = tx.toEntity?.name     ?? tx.toLabel     ?? (tx.toAddress?.slice(0, 8)   + '…');
  const sym    = tx.tokenSymbol ?? tx.unitTokenSymbol ?? 'token';
  const usd    = Number(tx.historicalUSD ?? tx.usd ?? 0);
  const usdStr = usd >= 1e9
    ? `$${(usd / 1e9).toFixed(2)}B`
    : usd >= 1e6
    ? `$${(usd / 1e6).toFixed(2)}M`
    : usd >= 1e3
    ? `$${(usd / 1e3).toFixed(0)}K`
    : `$${usd.toFixed(0)}`;

  // Gán nhãn tiếng Việt
  const tags = [];
  if (usd >= 1_000_000) tags.push('Cá voi');
  if (tx.toEntity?.type === 'exchange') tags.push('Listing');
  if (!tags.length) tags.push('Quan trọng');
  tags.push('BSC');

  const isoTs = tx.blockTimestamp ?? tx.timestamp ?? null;
  const timeAgo = formatTimeAgo(isoTs);

  return {
    id:         idx + 1,
    tags:       [...new Set(tags)],
    headline:   `${from} chuyển ${usdStr} ${sym} đến ${to} trên BSC`,
    token:      sym,
    tokenLabel: sym,
    timeAgo,
    updates:    Math.floor(usd / 100_000) + 1,
  };
}

/* ── Chuyển đổi token → TrendCard ────────────────────────── */
function tokenToCard(token, idx) {
  const sym     = token.symbol ?? token.tokenSymbol ?? '?';
  const change  = Number(token.priceChange24h ?? token.change24h ?? 0);
  const vol     = Number(token.volume24h ?? token.volume ?? 0);
  const price   = Number(token.price ?? token.priceUsd ?? 0);

  const direction = change >= 0 ? 'tăng' : 'giảm';
  const changePct = Math.abs(change).toFixed(1);
  const priceStr  = price >= 1 ? `$${price.toFixed(2)}` : `$${price.toFixed(6)}`;
  const volStr    = vol >= 1e6 ? `$${(vol / 1e6).toFixed(1)}M` : `$${(vol / 1e3).toFixed(0)}K`;

  const tags = [];
  if (change > 15)      tags.push('Bơm');
  else if (change > 0)  tags.push('Tăng giá');
  else if (change < -15) tags.push('Bãi rác');
  else                  tags.push('Giảm giá');
  if (vol >= 5_000_000) tags.push('Cá voi');
  tags.push('BSC');

  return {
    id:         idx + 1,
    tags:       [...new Set(tags)],
    headline:   `${token.name ?? sym} ${direction} ${changePct}% — giá ${priceStr}, khối lượng ${volStr} trong 24h trên BSC`,
    token:      sym,
    tokenLabel: sym,
    timeAgo:    'Vừa cập nhật',
    updates:    Math.floor(vol / 1_000_000) + 1,
  };
}

function formatTimeAgo(isoTs) {
  if (!isoTs) return 'Vừa xong';
  const diff = Date.now() - new Date(isoTs).getTime();
  const m    = Math.floor(diff / 60_000);
  const h    = Math.floor(diff / 3_600_000);
  if (m < 1)  return 'Vừa xong';
  if (m < 60) return `${m} phút trước`;
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

/* ── Fetch bằng cookie (web session) ─────────────────────── */
async function fetchWithCookie() {
  // Thử endpoint transfers (giao dịch lớn trên BSC)
  const urls = [
    `${INTEL_BASE}/api/transfers?chain=bsc&usd_gte=100000&limit=6&sortBy=blockTimestamp&sortDir=desc`,
    `${INTEL_BASE}/api/token/top?chain=bsc&limit=6`,
    `${INTEL_BASE}/api/intelligence/transfers?chain=bsc&limit=6`,
  ];

  const headers = buildHeaders('cookie');

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });

      if (res.status === 401 || res.status === 403) {
        logger.warn('[Arkham] Cookie hết hạn hoặc không hợp lệ — hãy cập nhật ARKHAM_COOKIE');
        return null;
      }

      if (!res.ok) continue;

      const json = await res.json();
      logger.debug(`[Arkham] cookie endpoint: ${url} → keys: ${Object.keys(json).join(', ')}`);

      // Xử lý tuỳ cấu trúc response
      const transfers = json.transfers ?? json.data?.transfers ?? [];
      if (Array.isArray(transfers) && transfers.length > 0) {
        return transfers.slice(0, 6).map(transferToCard);
      }

      const tokens = json.tokens ?? json.data?.tokens ?? json.data ?? [];
      if (Array.isArray(tokens) && tokens.length > 0) {
        return tokens.slice(0, 6).map(tokenToCard);
      }

    } catch (err) {
      logger.debug(`[Arkham] cookie fetch ${url}: ${err.message}`);
    }
  }

  return null;
}

/* ── Fetch bằng API key (official) ───────────────────────── */
async function fetchWithApiKey() {
  const urls = [
    `${OFFICIAL_API_BASE}/transfers?chain=bsc&usd_gte=100000&limit=6&sortBy=blockTimestamp&sortDir=desc`,
    `${OFFICIAL_API_BASE}/token/top?chain=bsc&limit=6`,
  ];

  const headers = buildHeaders('apikey');

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });

      if (res.status === 401 || res.status === 403) {
        logger.warn('[Arkham] API key không hợp lệ — kiểm tra ARKHAM_API_KEY');
        return null;
      }

      if (!res.ok) continue;

      const json = await res.json();
      logger.debug(`[Arkham] apikey endpoint: ${url} → keys: ${Object.keys(json).join(', ')}`);

      const transfers = json.transfers ?? json.data?.transfers ?? [];
      if (Array.isArray(transfers) && transfers.length > 0) {
        return transfers.slice(0, 6).map(transferToCard);
      }

      const tokens = json.tokens ?? json.data?.tokens ?? json.data ?? [];
      if (Array.isArray(tokens) && tokens.length > 0) {
        return tokens.slice(0, 6).map(tokenToCard);
      }

    } catch (err) {
      logger.debug(`[Arkham] apikey fetch ${url}: ${err.message}`);
    }
  }

  return null;
}

/* ── Fetch chính ──────────────────────────────────────────── */
async function fetchTrending(mode) {
  try {
    if (mode === 'cookie') return await fetchWithCookie();
    if (mode === 'apikey') return await fetchWithApiKey();
  } catch (err) {
    logger.error(`[Arkham] Lỗi không xác định: ${err.message}`);
  }
  return null;
}

/* ── Khởi động service ────────────────────────────────────── */
export function startArkhamService() {
  const mode = detectMode();

  if (!mode) {
    logger.warn('[Arkham] Chưa cấu hình xác thực — TrendingPanel dùng mock data');
    logger.warn('[Arkham] Đặt ARKHAM_COOKIE hoặc ARKHAM_API_KEY trong .env để dùng dữ liệu thực');
    return;
  }

  logger.info(`[Arkham] Khởi động với chế độ: ${mode.toUpperCase()} — cập nhật mỗi 5 phút`);

  const run = async () => {
    const trends = await fetchTrending(mode);
    if (trends && trends.length > 0) {
      eventBus.emit('trending', trends);
      logger.info(`[Arkham] Broadcast ${trends.length} xu hướng BSC (${mode})`);
    } else {
      logger.warn('[Arkham] Không lấy được dữ liệu — kiểm tra ARKHAM_COOKIE hoặc endpoint');
    }
  };

  run();
  setInterval(run, FETCH_INTERVAL);
}
