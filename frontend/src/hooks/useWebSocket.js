import { useEffect, useRef, useState } from 'react';

const BASE_RETRY_MS    = 1_000;
const MAX_RETRY_MS     = 15_000;   // giảm từ 30s → 15s
const CONNECT_TIMEOUT  = 5_000;    // 5s không mở được → thử lại
const PING_INTERVAL_MS = 25_000;   // ping mỗi 25s để duy trì kết nối

export default function useWebSocket(url) {
  const [status,      setStatus]      = useState('connecting');
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef      = useRef(null);
  const retryRef   = useRef(0);
  const isMounted  = useRef(true);
  const pingRef    = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    isMounted.current = true;

    function stopPing() {
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
    }

    function connect() {
      if (!isMounted.current) return;
      setStatus('connecting');

      const ws = new WebSocket(url);
      wsRef.current = ws;

      // Timeout nếu không kết nối được sau CONNECT_TIMEOUT
      timeoutRef.current = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
        }
      }, CONNECT_TIMEOUT);

      ws.onopen = () => {
        if (!isMounted.current) return;
        clearTimeout(timeoutRef.current);
        retryRef.current = 0;
        setStatus('connected');

        // Ping định kỳ để giữ kết nối và phát hiện mất mạng
        stopPing();
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ type: 'ping' })); } catch { /* bỏ qua */ }
          }
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (e) => {
        if (!isMounted.current) return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'pong') return;   // bỏ qua pong
          setLastMessage(msg);
        } catch { /* bỏ qua JSON lỗi */ }
      };

      ws.onclose = () => {
        if (!isMounted.current) return;
        clearTimeout(timeoutRef.current);
        stopPing();
        setStatus('reconnecting');
        const delay = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** retryRef.current);
        retryRef.current++;
        setTimeout(connect, delay);
      };

      ws.onerror = () => {
        clearTimeout(timeoutRef.current);
        setStatus('error');
      };
    }

    connect();

    return () => {
      isMounted.current = false;
      clearTimeout(timeoutRef.current);
      stopPing();
      wsRef.current?.close();
    };
  }, [url]);

  return { status, lastMessage };
}
