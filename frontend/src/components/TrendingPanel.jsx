import { useState, useEffect, useRef, useCallback } from 'react';
import { useMonitor } from '../context/MonitorContext.jsx';

/* ── Màu sắc tag ─────────────────────────────────────────── */
const TAG_COLORS = {
  'Giảm giá':  { bg: 'rgba(231,76,60,.25)',   color: '#ff6b6b' },
  'Tăng giá':  { bg: 'rgba(46,204,113,.2)',   color: '#2ecc71' },
  'Bơm':       { bg: 'rgba(52,152,219,.2)',   color: '#74b9ff' },
  'Bãi rác':   { bg: 'rgba(127,140,141,.2)',  color: '#b2bec3' },
  'Quan trọng':{ bg: 'rgba(155,89,182,.3)',   color: '#a29bfe' },
  'Cá voi':    { bg: 'rgba(0,184,148,.2)',    color: '#00b894' },
  'Cảm xúc':   { bg: 'rgba(253,203,110,.2)', color: '#fdcb6e' },
  'Hack':      { bg: 'rgba(214,48,49,.3)',    color: '#ff7675' },
  'Listing':   { bg: 'rgba(240,185,11,.2)',   color: '#f0b90b' },
  'BSC':       { bg: 'rgba(240,185,11,.15)',  color: '#f0b90b' },
};

function Tag({ label }) {
  const style = TAG_COLORS[label] ?? { bg: 'rgba(99,110,114,.2)', color: '#636e72' };
  return (
    <span className="trend-tag" style={{ background: style.bg, color: style.color }}>
      {label}
    </span>
  );
}

/* ── Dữ liệu mẫu (có thể thay bằng API) ─────────────────── */
const MOCK_TRENDS = [
  {
    id: 1,
    tags: ['Tăng giá', 'Quan trọng'],
    headline: 'BNB (BNB) tăng 3.06% — giá $645.06, khối lượng $104.9M trong 24h',
    token: '🟡', tokenLabel: 'BNB',
    timeAgo: 'Vừa xong', updates: 105,
  },
  {
    id: 2,
    tags: ['Cảm xúc', 'BSC'],
    headline: 'PancakeSwap (CAKE) tăng 2.51% — giá $1.64, khối lượng $5.9M trong 24h',
    token: '🥞', tokenLabel: 'CAKE',
    timeAgo: 'Vừa xong', updates: 6,
  },
  {
    id: 3,
    tags: ['Tăng giá', 'BSC'],
    headline: 'Venus (XVS) tăng 15.30% — giá $3.09, khối lượng $7.8M trong 24h',
    token: '🔵', tokenLabel: 'XVS',
    timeAgo: 'Vừa xong', updates: 8,
  },
  {
    id: 4,
    tags: ['Bơm', 'Quan trọng'],
    headline: 'RaveDAO (RAVE) tăng 27.6% — nằm trong top xu hướng tìm kiếm toàn cầu — giá $20.92',
    token: '🎵', tokenLabel: 'RAVE',
    timeAgo: '24 giờ trước', updates: 3,
  },
  {
    id: 5,
    tags: ['Tăng giá', 'Quan trọng'],
    headline: 'OpenVPP (OVPP) tăng 18.2% — nằm trong top xu hướng tìm kiếm toàn cầu — giá $0.022079',
    token: '🔋', tokenLabel: 'OVPP',
    timeAgo: '24 giờ trước', updates: 3,
  },
  {
    id: 6,
    tags: ['Hack', 'Quan trọng'],
    headline: 'Giao thức DeFi trên BSC bị khai thác 2,4 triệu USD qua lỗ hổng flash loan',
    token: '⚠️', tokenLabel: 'DeFi',
    timeAgo: '5 giờ trước', updates: 31,
  },
  {
    id: 7,
    tags: ['Quan trọng', 'Cá voi'],
    headline: 'BTC tăng vọt 4% lên 74.786 USD; Cá voi mất hàng triệu đô trong đợt thanh lý',
    token: '🟠', tokenLabel: 'BTC',
    timeAgo: '20 giờ trước', updates: 8,
  },
  {
    id: 8,
    tags: ['Cảm xúc'],
    headline: 'Giá XRP tăng lên 1,38 USD khi tâm lý xã hội đạt mức cao nhất trong 30 ngày',
    token: '❌', tokenLabel: 'XRP',
    timeAgo: '1 giờ trước', updates: 26,
  },
  {
    id: 9,
    tags: ['Listing', 'BSC'],
    headline: 'PancakeSwap ra mắt pool CAKE/BNB mới với APR 120% — cơ hội cho nhà đầu tư',
    token: '🥞', tokenLabel: 'CAKE',
    timeAgo: '3 giờ trước', updates: 12,
  },
  {
    id: 10,
    tags: ['Giảm giá', 'Bãi rác'],
    headline: 'Token SAFE2 mất 65% giá trị sau khi nhóm phát triển rút toàn bộ thanh khoản',
    token: '🔴', tokenLabel: 'SAFE2',
    timeAgo: '2 giờ trước', updates: 44,
  },
  {
    id: 11,
    tags: ['Tăng giá', 'Cá voi'],
    headline: 'ETH vượt ngưỡng $3,200 — dòng tiền tổ chức đổ vào ETH ETF đạt kỷ lục tuần',
    token: '💎', tokenLabel: 'ETH',
    timeAgo: '4 giờ trước', updates: 19,
  },
  {
    id: 12,
    tags: ['BSC', 'Listing'],
    headline: 'BiSwap (BSW) niêm yết trên Binance — khối lượng giao dịch tăng 340% trong 1h',
    token: '🔄', tokenLabel: 'BSW',
    timeAgo: '6 giờ trước', updates: 57,
  },
  {
    id: 13,
    tags: ['Cá voi', 'Quan trọng'],
    headline: 'Ví cá voi chuyển 12,000 BNB (~$7.7M) vào Binance — tín hiệu bán có thể xảy ra',
    token: '🐋', tokenLabel: 'BNB',
    timeAgo: '8 giờ trước', updates: 22,
  },
  {
    id: 14,
    tags: ['Giảm giá', 'Bơm'],
    headline: 'PEPE giảm 18% sau khi pump lên ATH — nhiều nhà đầu tư bị thanh lý đòn bẩy 10x',
    token: '🐸', tokenLabel: 'PEPE',
    timeAgo: '10 giờ trước', updates: 73,
  },
  {
    id: 15,
    tags: ['BSC', 'Quan trọng'],
    headline: 'Binance Smart Chain xử lý 5.2 triệu giao dịch/ngày — mức cao kỷ lục Q1 2025',
    token: '⛓️', tokenLabel: 'BSC',
    timeAgo: '12 giờ trước', updates: 15,
  },
  {
    id: 16,
    tags: ['Tăng giá', 'BSC'],
    headline: 'TWT (Trust Wallet Token) tăng 9.4% sau thông báo tích hợp ví với Samsung Pay',
    token: '👜', tokenLabel: 'TWT',
    timeAgo: '14 giờ trước', updates: 9,
  },
  {
    id: 17,
    tags: ['Hack', 'Quan trọng'],
    headline: 'Cầu nối cross-chain bị tấn công — thiệt hại ước tính 8.1 triệu USD trên BSC',
    token: '🌉', tokenLabel: 'Bridge',
    timeAgo: '16 giờ trước', updates: 88,
  },
  {
    id: 18,
    tags: ['Cảm xúc', 'Cá voi'],
    headline: 'SOL vượt $185 — chỉ số Fear & Greed đạt 78 (Tham lam cực độ) lần đầu trong 6 tháng',
    token: '☀️', tokenLabel: 'SOL',
    timeAgo: '18 giờ trước', updates: 34,
  },
  {
    id: 19,
    tags: ['Tăng giá', 'Quan trọng'],
    headline: 'DOGE tăng 22% sau khi Elon Musk đăng ảnh biểu tượng Dogecoin trên X — cộng đồng sôi sục',
    token: '🐕', tokenLabel: 'DOGE',
    timeAgo: '30 phút trước', updates: 142,
  },
  {
    id: 20,
    tags: ['BSC', 'Listing'],
    headline: 'ApeSwap (BANANA) niêm yết cặp mới BANANA/USDT — thanh khoản ban đầu $2.1M',
    token: '🍌', tokenLabel: 'BANANA',
    timeAgo: '45 phút trước', updates: 11,
  },
  {
    id: 21,
    tags: ['Hack', 'Quan trọng'],
    headline: 'Rug pull phát hiện trên BSC — token MOONRISE rút 1.8M USD thanh khoản trong 3 phút',
    token: '🌙', tokenLabel: 'MOONRISE',
    timeAgo: '1 giờ trước', updates: 67,
  },
  {
    id: 22,
    tags: ['Cá voi', 'BSC'],
    headline: 'Địa chỉ ví lớn tích lũy 4.2 triệu CAKE (~$6.9M) trong 48h — tín hiệu tăng giá',
    token: '🥞', tokenLabel: 'CAKE',
    timeAgo: '2 giờ trước', updates: 28,
  },
  {
    id: 23,
    tags: ['Tăng giá', 'Quan trọng'],
    headline: 'ADA (Cardano) tăng 11.3% sau khi Hydra Layer-2 xử lý thành công 1 triệu TPS trên testnet',
    token: '💙', tokenLabel: 'ADA',
    timeAgo: '3 giờ trước', updates: 41,
  },
  {
    id: 24,
    tags: ['Giảm giá', 'Cảm xúc'],
    headline: 'LUNA Classic (LUNC) giảm 14% — cộng đồng chia rẽ về đề xuất đốt token tuần này',
    token: '🌕', tokenLabel: 'LUNC',
    timeAgo: '5 giờ trước', updates: 53,
  },
  {
    id: 25,
    tags: ['BSC', 'Quan trọng'],
    headline: 'Alpaca Finance (ALPACA) công bố buyback & burn 500,000 ALPACA — giá tăng 8.7%',
    token: '🦙', tokenLabel: 'ALPACA',
    timeAgo: '7 giờ trước', updates: 17,
  },
  {
    id: 26,
    tags: ['Cá voi', 'Quan trọng'],
    headline: 'Quỹ đầu tư Grayscale mua thêm 6,200 BTC trong tuần — tổng nắm giữ vượt 320,000 BTC',
    token: '🏦', tokenLabel: 'BTC',
    timeAgo: '9 giờ trước', updates: 62,
  },
  {
    id: 27,
    tags: ['Tăng giá', 'BSC'],
    headline: 'LINK (Chainlink) tăng 7.2% — tích hợp oracle mới với 15 dự án DeFi trên BSC',
    token: '🔗', tokenLabel: 'LINK',
    timeAgo: '11 giờ trước', updates: 23,
  },
  {
    id: 28,
    tags: ['Bơm', 'Bãi rác'],
    headline: 'Token ẩn danh TURBO pump 180% trong 2h rồi dump 90% — cảnh báo bẫy thanh khoản',
    token: '💣', tokenLabel: 'TURBO',
    timeAgo: '13 giờ trước', updates: 99,
  },
];

/* ── Card đơn lẻ ─────────────────────────────────────────── */
function TrendCard({ item }) {
  return (
    <div className="trend-card">
      <div className="trend-card-tags">
        {item.tags.map(t => <Tag key={t} label={t} />)}
      </div>

      <p className="trend-headline">{item.headline}</p>

      <div className="trend-footer">
        <div className="trend-meta-left">
          <span className="trend-token" title={item.tokenLabel}>
            Mã thông báo: {item.token}
          </span>
          {item.extra && (
            <span className="trend-token">{item.extra}</span>
          )}
        </div>
        <div className="trend-meta-right">
          <span className="trend-time">{item.timeAgo}</span>
          <span className="trend-sep">|</span>
          <span className="trend-updates">{item.updates} bản cập nhật</span>
        </div>
      </div>
    </div>
  );
}

/* ── Panel chính ─────────────────────────────────────────── */
export default function TrendingPanel() {
  const { trends: arkhamTrends } = useMonitor();
  const [mockTrends, setMockTrends] = useState(MOCK_TRENDS);
  const [pulse, setPulse] = useState(false);
  const [canLeft,   setCanLeft]   = useState(false);
  const [canRight,  setCanRight]  = useState(true);
  const [thumbStyle, setThumbStyle] = useState({ width: '30%', marginLeft: '0%' });
  const trackRef = useRef(null);

  const isLive    = arkhamTrends.length > 0;
  const displayed = isLive ? arkhamTrends : mockTrends;

  const SCROLL_BY = 320;

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanLeft(scrollLeft > 4);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 4);
    // cập nhật thanh tiến trình
    const ratio     = clientWidth / scrollWidth;
    const thumbW    = Math.max(ratio * 100, 8);
    const thumbLeft = (scrollLeft / scrollWidth) * 100;
    setThumbStyle({ width: `${thumbW}%`, marginLeft: `${thumbLeft}%` });
  }, []);

  // Gắn scroll + wheel + drag với passive flags đúng
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    updateArrows();

    // Wheel → cuộn ngang (passive:false để preventDefault hoạt động)
    function onWheel(e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // đã cuộn ngang tự nhiên
      e.preventDefault();
      el.scrollLeft += e.deltaY * 1.5;
    }

    // Drag-to-scroll
    let startX = 0, startScroll = 0, dragging = false;
    function onMouseDown(e) {
      dragging = true;
      startX = e.pageX - el.offsetLeft;
      startScroll = el.scrollLeft;
      el.style.cursor = 'grabbing';
    }
    function onMouseMove(e) {
      if (!dragging) return;
      e.preventDefault();
      el.scrollLeft = startScroll - (e.pageX - el.offsetLeft - startX);
    }
    function onMouseUp() {
      dragging = false;
      el.style.cursor = 'grab';
    }

    el.addEventListener('scroll',    updateArrows,  { passive: true });
    el.addEventListener('wheel',     onWheel,       { passive: false });
    el.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);

    return () => {
      el.removeEventListener('scroll',    updateArrows);
      el.removeEventListener('wheel',     onWheel);
      el.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
  }, [displayed, updateArrows]);

  function scrollLeft()  { trackRef.current?.scrollBy({ left: -SCROLL_BY, behavior: 'smooth' }); }
  function scrollRight() { trackRef.current?.scrollBy({ left:  SCROLL_BY, behavior: 'smooth' }); }

  useEffect(() => {
    if (!isLive) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(t);
  }, [arkhamTrends]);

  useEffect(() => {
    if (isLive) return;
    const timer = setInterval(() => {
      setPulse(true);
      setMockTrends(prev =>
        prev.map(t => ({ ...t, updates: t.updates + Math.floor(Math.random() * 3) }))
      );
      setTimeout(() => setPulse(false), 600);
    }, 30_000);
    return () => clearInterval(timer);
  }, [isLive]);

  return (
    <section className="trending-panel">
      <div className="trending-header">
        <h2 className="trending-title">XU HƯỚNG NỔI BẬT</h2>
        <span className={`trending-live ${pulse ? 'trending-live--pulse' : ''}`}>
          <span className="trending-live-dot" />
          {isLive ? 'BINANCE LIVE' : 'TRỰC TIẾP'}
        </span>
      </div>

      <div className="trending-scroll-wrapper">
        <button
          className={`trending-arrow trending-arrow--left ${canLeft ? '' : 'trending-arrow--disabled'}`}
          onClick={scrollLeft}
          title="Xu hướng trước"
        >
          <span className="trending-arrow-icon">‹</span>
        </button>

        <div className="trending-track" ref={trackRef}>
          {displayed.map(item => (
            <TrendCard key={item.id} item={item} />
          ))}
        </div>

        <button
          className={`trending-arrow trending-arrow--right ${canRight ? '' : 'trending-arrow--disabled'}`}
          onClick={scrollRight}
          title="Xu hướng tiếp theo"
        >
          <span className="trending-arrow-icon">›</span>
        </button>
      </div>

      {/* ── Thanh tiến trình cuộn ── */}
      <div className="trending-scrollbar">
        <div className="trending-scrollbar-thumb" style={thumbStyle} />
      </div>
    </section>
  );
}
