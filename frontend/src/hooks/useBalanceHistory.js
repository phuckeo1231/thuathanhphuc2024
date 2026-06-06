import { useRef } from 'react';

const MAX_POINTS = 20; // số điểm lưu trữ tối đa cho sparkline

/**
 * Lưu lịch sử số dư để vẽ biểu đồ sparkline.
 * Dùng ref thay state để tránh re-render không cần thiết.
 */
export default function useBalanceHistory() {
  const historyRef = useRef({}); // key: "walletAddr:tokenSymbol" → number[]

  function push(walletAddr, tokenSymbol, balanceStr) {
    const key = `${walletAddr}:${tokenSymbol}`;
    if (!historyRef.current[key]) historyRef.current[key] = [];
    const arr = historyRef.current[key];
    arr.push(parseFloat(balanceStr));
    if (arr.length > MAX_POINTS) arr.shift();
  }

  function get(walletAddr, tokenSymbol) {
    return historyRef.current[`${walletAddr}:${tokenSymbol}`] ?? [];
  }

  // Nạp dữ liệu từ server (gửi khi client kết nối) — khôi phục sparkline sau F5
  function init(data) {
    for (const [key, arr] of Object.entries(data)) {
      if (!Array.isArray(arr)) continue;
      historyRef.current[key] = arr.slice(-MAX_POINTS);
    }
  }

  return { push, get, init };
}
