/**
 * Sparkline thuần SVG — không dùng thư viện bên ngoài.
 * Nhận mảng số thực và vẽ đường gấp khúc trên canvas SVG nhỏ.
 */
export default function BalanceChart({ data, width = 80, height = 24 }) {
  if (!data || data.length < 2) return null;

  const min   = Math.min(...data);
  const max   = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Màu đường: xanh nếu điểm cuối >= điểm đầu, đỏ nếu ngược lại
  const stroke = data[data.length - 1] >= data[0] ? '#2ecc71' : '#e74c3c';

  return (
    <svg width={width} height={height} className="sparkline" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
