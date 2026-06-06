import { useMemo } from 'react';
import MiniBarChart  from './MiniBarChart.jsx';
import { useMonitor } from '../context/MonitorContext.jsx';

function mockHistory(seed, length = 12, peak = null) {
  const arr = [];
  let v = seed % 8 + 2;
  for (let i = 0; i < length; i++) {
    v = Math.max(1, Math.min(10, v + ((seed * (i + 1)) % 5) - 2));
    arr.push(v);
  }
  if (peak !== null) arr[arr.length - 1] = peak;
  return arr;
}

function StatCard({ label, value, subtitle, chartData, chartColor, highlight }) {
  return (
    <div className={`stat-card ${highlight ? 'stat-card--highlight' : ''}`}>
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-subtitle">{subtitle}</div>
      <div className="stat-chart">
        <MiniBarChart data={chartData} color={chartColor} width={88} height={30} />
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="stat-card-skeleton">
      <div className="skel sks-label" />
      <div className="skel sks-value" />
      <div className="skel sks-sub" />
      <div className="skel sks-chart" />
    </div>
  );
}

export default function StatsBar({ wallets, tokens, recentChanges, alerts, wsStatus }) {
  const { transfers } = useMonitor();

  /* ── Đếm giao dịch hôm nay + phân bổ theo giờ (12 cột × 2h) ── */
  const { todayCount, hourlyBuckets } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startSec = start.getTime() / 1000;

    const buckets = Array(12).fill(0);
    let count = 0;

    for (const t of transfers) {
      if (t.timeStamp >= startSec) {
        count++;
        const hours  = (t.timeStamp - startSec) / 3600;
        const bucket = Math.min(11, Math.floor(hours / 2));
        buckets[bucket]++;
      }
    }
    return { todayCount: count, hourlyBuckets: buckets };
  }, [transfers]);

  const walletHistory = useMemo(() => mockHistory(7,  12, wallets.length), [wallets.length]);
  const tokenHistory  = useMemo(() => mockHistory(13, 12, tokens.length),  [tokens.length]);
  const alertHistory  = useMemo(() => mockHistory(19, 12, alerts.length),  [alerts.length]);

  /* Biểu đồ theo giờ: nếu chưa có dữ liệu thì dùng mock */
  const txChartData = useMemo(
    () => todayCount > 0 ? hourlyBuckets : mockHistory(3, 12, recentChanges.length),
    [todayCount, hourlyBuckets, recentChanges.length],
  );

  const stats = [
    {
      label:      'TỔNG VÍ\nGIÁM SÁT',
      value:      wallets.length,
      subtitle:   'Factory instances',
      chartData:  walletHistory,
      chartColor: '#00c9b1',
    },
    {
      label:      'TOKEN\nBEP20',
      value:      tokens.length,
      subtitle:   'Đang theo dõi',
      chartData:  tokenHistory,
      chartColor: '#00c9b1',
    },
    {
      label:      'GIAO DỊCH\nHÔM NAY',
      value:      todayCount,
      subtitle:   todayCount > 0 ? 'Phân bổ theo 2h/cột' : 'Chưa có giao dịch',
      chartData:  txChartData,
      chartColor: todayCount > 0 ? '#7c6af7' : '#00c9b1',
    },
    {
      label:      'CẢNH BÁO\nHÔM NAY',
      value:      alerts.length,
      subtitle:   'Observer events',
      chartData:  alertHistory,
      chartColor: alerts.length > 0 ? '#e74c3c' : '#00c9b1',
      highlight:  alerts.length > 0,
    },
  ];

  const isLoading = (wsStatus === 'connecting' || wsStatus === 'reconnecting') && wallets.length === 0;

  return (
    <div className="stats-bar">
      {isLoading
        ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        : stats.map((s, i) => <StatCard key={i} {...s} />)
      }
    </div>
  );
}
