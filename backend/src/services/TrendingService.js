/**
 * TrendingService — dữ liệu xu hướng thời gian thực
 *
 * Nguồn dữ liệu (miễn phí, không cần API key):
 *  1. Binance WebSocket stream — ticker 24h của các token BSC (real-time)
 *  2. CoinGecko /search/trending   — top coin đang được tìm kiếm nhiều nhất
 *
 * Luồng:
 *   Binance WS tick → cập nhật tickerMap
 *   Mỗi 30s         → merge với CoinGecko → emit 'trending'
 *   Mỗi 5 phút      → re-fetch CoinGecko (cache ngắn hạn)
 */
import { WebSocket }  from 'ws';
import eventBus       from '../core/EventBus.js';
import logger         from '../utils/logger.js';

/* ── Các cặp token BSC trên Binance ──────────────────────── */
const BSC_TOKENS = [
  { symbol: 'BNBUSDT',    name: 'BNB',          short: 'BNB'   },
  { symbol: 'CAKEUSDT',   name: 'PancakeSwap',   short: 'CAKE'  },
  { symbol: 'BAKEUSDT',   name: 'BakeryToken',   short: 'BAKE'  },
  { symbol: 'XVSUSDT',    name: 'Venus',         short: 'XVS'   },
  { symbol: 'ALPACAUSDT', name: 'Alpaca Finance', short: 'ALPACA'},
  { symbol: 'TWTUSDT',    name: 'Trust Wallet',  short: 'TWT'   },
];

const BINANCE_WS   = 'wss://stream.binance.com:9443/stream?streams='
  + BSC_TOKENS.map(t => `${t.symbol.toLowerCase()}@ticker`).join('/');
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/search/trending';

const BROADCAST_MS  = 30_000;        // gửi tới frontend mỗi 30s
const CG_REFRESH_MS = 5 * 60_000;   // re-fetch CoinGecko mỗi 5 phút
const WS_RECONNECT  = 10_000;        // reconnect Binance WS sau 10s nếu lỗi

/* ── State ────────────────────────────────────────────────── */
const tickerMap  = new Map();   // symbol → Binance ticker data
let   cgCoins    = [];          // CoinGecko trending coins

/* ── Nhãn tiếng Việt ──────────────────────────────────────── */
function buildTags(changePct, volumeUSDT) {
  const tags = [];
  const c = parseFloat(changePct);
  const v = parseFloat(volumeUSDT);

  if      (c >= 20)   tags.push('Bơm');
  else if (c >= 5)    tags.push('Tăng giá');
  else if (c <= -20)  tags.push('Bãi rác');
  else if (c <= -5)   tags.push('Giảm giá');
  else                tags.push('Cảm xúc');

  if (v >= 50_000_000) tags.push('Cá voi');
  tags.push('BSC');
  return tags;
}

function fmtUSD(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPrice(p) {
  const n = parseFloat(p);
  return n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(6)}`;
}

/* ── Chuyển Binance ticker → TrendCard ───────────────────── */
function binanceToCard(info, ticker, idx) {
  const c   = parseFloat(ticker.P);   // % thay đổi 24h
  const vol = parseFloat(ticker.q);   // khối lượng USDT 24h
  const dir = c >= 0 ? 'tăng' : 'giảm';
  const pct = Math.abs(c).toFixed(2);

  return {
    id:         idx + 1,
    tags:       buildTags(c, vol),
    headline:   `${info.name} (${info.short}) ${dir} ${pct}% — giá ${fmtPrice(ticker.c)}, khối lượng ${fmtUSD(vol)} trong 24h`,
    token:      info.short,
    tokenLabel: info.short,
    timeAgo:    'Cập nhật vừa xong',
    updates:    Math.floor(vol / 1_000_000) + 1,
    _changePct: c,   // dùng để sort, không hiển thị
  };
}

/* ── Chuyển CoinGecko coin → TrendCard ───────────────────── */
function cgToCard(coin, idx) {
  const item = coin.item;
  const c    = item.data?.price_change_percentage_24h?.usd ?? 0;
  const dir  = c >= 0 ? 'tăng' : 'giảm';
  const pct  = Math.abs(c).toFixed(1);
  const sym  = item.symbol.toUpperCase();

  const tags = [];
  if      (c >= 20)  tags.push('Bơm');
  else if (c >= 5)   tags.push('Tăng giá');
  else if (c <= -20) tags.push('Bãi rác');
  else if (c <= -5)  tags.push('Giảm giá');
  else               tags.push('Cảm xúc');
  tags.push('Quan trọng');

  const priceStr = item.data?.price
    ? fmtPrice(item.data.price)
    : 'N/A';

  return {
    id:         idx + 100,
    tags:       [...new Set(tags)],
    headline:   `${item.name} (${sym}) ${dir} ${pct}% — nằm trong top xu hướng tìm kiếm toàn cầu ${priceStr !== 'N/A' ? `· giá ${priceStr}` : ''}`,
    token:      sym,
    tokenLabel: sym,
    timeAgo:    '24 giờ qua',
    updates:    (item.score ?? 0) + 1,
    _changePct: c,
  };
}

/* ── Merge & sort ─────────────────────────────────────────── */
function buildTrendCards() {
  const binanceCards = [];
  BSC_TOKENS.forEach((info, idx) => {
    const ticker = tickerMap.get(info.symbol);
    if (ticker) binanceCards.push(binanceToCard(info, ticker, idx));
  });

  const cgCards = cgCoins.slice(0, 3).map(cgToCard);

  // Ghép Binance (ưu tiên) + CoinGecko, lấy 6 card nhiều biến động nhất
  const all = [...binanceCards, ...cgCards]
    .sort((a, b) => Math.abs(b._changePct) - Math.abs(a._changePct))
    .slice(0, 6)
    .map((card, i) => ({ ...card, id: i + 1 }));

  return all;
}

/* ── Fetch CoinGecko ──────────────────────────────────────── */
async function fetchCoinGecko() {
  try {
    const res = await fetch(COINGECKO_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return;
    const json = await res.json();
    cgCoins = json.coins ?? [];
    logger.debug(`[Trending] CoinGecko: ${cgCoins.length} coin xu hướng`);
  } catch (err) {
    logger.warn(`[Trending] CoinGecko fetch thất bại: ${err.message}`);
  }
}

/* ── Binance WebSocket ────────────────────────────────────── */
function connectBinanceWS(onReady) {
  const ws = new WebSocket(BINANCE_WS);

  ws.on('open', () => {
    logger.info('[Trending] Kết nối Binance WebSocket thành công');
    onReady?.();
  });

  ws.on('message', (raw) => {
    try {
      const msg  = JSON.parse(raw);
      const data = msg.data;
      if (data?.e === '24hrTicker') {
        tickerMap.set(data.s, data);
      }
    } catch { /* bỏ qua */ }
  });

  ws.on('error', (err) => {
    logger.warn(`[Trending] Binance WS lỗi: ${err.message}`);
  });

  ws.on('close', () => {
    logger.warn(`[Trending] Binance WS ngắt kết nối — thử lại sau ${WS_RECONNECT / 1000}s`);
    setTimeout(() => connectBinanceWS(), WS_RECONNECT);
  });

  return ws;
}

/* ── Fetch ban đầu qua REST (trước khi WS sẵn sàng) ─────── */
async function fetchBinanceREST() {
  try {
    const syms = JSON.stringify(BSC_TOKENS.map(t => t.symbol));
    const url  = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(syms)}`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return;
    const list = await res.json();
    list.forEach(t => tickerMap.set(t.symbol, t));
    logger.info(`[Trending] Binance REST: nạp ${tickerMap.size} ticker ban đầu`);
  } catch (err) {
    logger.warn(`[Trending] Binance REST thất bại: ${err.message}`);
  }
}

/* ── Khởi động service ────────────────────────────────────── */
export async function startTrendingService() {
  logger.info('[Trending] Khởi động TrendingService (Binance WS + CoinGecko)');

  // 1. Nạp dữ liệu ban đầu song song
  await Promise.all([fetchBinanceREST(), fetchCoinGecko()]);

  // Broadcast ngay lập tức lần đầu
  const initial = buildTrendCards();
  if (initial.length > 0) {
    eventBus.emit('trending', initial);
    logger.info(`[Trending] Broadcast ban đầu: ${initial.length} xu hướng`);
  }

  // 2. Kết nối Binance WebSocket (real-time)
  connectBinanceWS();

  // 3. Broadcast mỗi 30s từ dữ liệu WebSocket
  setInterval(() => {
    const cards = buildTrendCards();
    if (cards.length > 0) {
      eventBus.emit('trending', cards);
    }
  }, BROADCAST_MS);

  // 4. Re-fetch CoinGecko mỗi 5 phút
  setInterval(fetchCoinGecko, CG_REFRESH_MS);
}
