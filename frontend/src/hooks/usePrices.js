/**
 * usePrices — lấy giá token theo thời gian thực từ Binance REST API
 * Refresh tự động mỗi 60 giây.
 */
import { useState, useEffect } from 'react';

/* ── Giá cố định cho stablecoin ─────────────────────────────── */
const STABLE = { USDT: 1, USDC: 1, BUSD: 1, DAI: 1, TUSD: 1 };

/* ── Map symbol → cặp Binance ──────────────────────────────── */
const BINANCE_PAIRS = {
  BNB:    'BNBUSDT',
  CAKE:   'CAKEUSDT',
  BAKE:   'BAKEUSDT',
  XVS:    'XVSUSDT',
  ALPACA: 'ALPACAUSDT',
  TWT:    'TWTUSDT',
  ETH:    'ETHUSDT',
  BTC:    'BTCUSDT',
};
const REVERSE = Object.fromEntries(
  Object.entries(BINANCE_PAIRS).map(([sym, pair]) => [pair, sym])
);

export default function usePrices() {
  const [prices, setPrices] = useState({ ...STABLE });

  async function fetchPrices() {
    try {
      const pairs = Object.values(BINANCE_PAIRS);
      const url   = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(pairs))}`;
      const res   = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      const data  = await res.json();

      const result = { ...STABLE };
      for (const item of data) {
        const sym = REVERSE[item.symbol];
        if (!sym) continue;
        result[sym]          = parseFloat(item.lastPrice);
        result[`${sym}_24h`] = parseFloat(item.priceChangePercent);
      }
      setPrices(result);
    } catch { /* bỏ qua lỗi mạng */ }
  }

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, 60_000);
    return () => clearInterval(id);
  }, []);

  return prices;
}
