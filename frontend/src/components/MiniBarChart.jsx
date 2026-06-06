/**
 * Biểu đồ cột nhỏ thuần SVG — dùng trong thẻ thống kê.
 * Nhận mảng số và vẽ các cột theo tỉ lệ.
 */
export default function MiniBarChart({ data, color = '#00c9b1', width = 80, height = 32 }) {
  if (!data || data.length === 0) return null;

  const max   = Math.max(...data, 1);
  const gap   = 2;
  const bars  = data.length;
  const barW  = Math.floor((width - gap * (bars - 1)) / bars);

  return (
    <svg width={width} height={height} className="mini-bar-chart" aria-hidden="true">
      {data.map((v, i) => {
        const barH = Math.max(2, Math.round((v / max) * height));
        const x    = i * (barW + gap);
        const y    = height - barH;
        return (
          <rect
            key={i}
            x={x} y={y}
            width={barW} height={barH}
            fill={color}
            opacity={0.75 + (v / max) * 0.25}
            rx={1}
          />
        );
      })}
    </svg>
  );
}
