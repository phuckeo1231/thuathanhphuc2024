/**
 * Chuyển đổi raw BigInt (wei) → chuỗi số thập phân hiển thị
 * Ví dụ: formatBalance(1500000000000000000n, 18) → "1.500000"
 */
export function formatBalance(raw, decimals = 18, displayDecimals = 6) {
  const n = typeof raw === 'bigint' ? raw : BigInt(raw);
  const divisor = 10n ** BigInt(decimals);
  const whole = n / divisor;
  const frac = (n % divisor).toString().padStart(decimals, '0').slice(0, displayDecimals);
  return `${whole}.${frac}`;
}
