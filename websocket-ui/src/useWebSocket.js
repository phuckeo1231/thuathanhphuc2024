import { useEffect, useRef } from "react";

export default function useWebSocket(url, onMessageReceived) {
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const callbackRef = useRef(onMessageReceived);

  // Cập nhật ref callback để tránh closure stale mà không cần restart socket
  useEffect(() => {
    callbackRef.current = onMessageReceived;
  }, [onMessageReceived]);

  useEffect(() => {
    let isMounted = true;

    const connect = () => {
      if (!url) return;

      console.log("Đang kết nối tới:", url);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          callbackRef.current?.(data);
        } catch (err) {
          console.error("Lỗi parse JSON:", err);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        // Exponential backoff: đợi tăng dần rồi thử lại
        const timeout = Math.min(10000, 1000 * 2 ** retryRef.current);
        console.log(`Socket đóng. Thử lại sau ${timeout}ms`);
        retryRef.current += 1;
        setTimeout(() => {
          if (isMounted) connect();
        }, timeout);
      };

      ws.onopen = () => {
        console.log("Kết nối thành công!");
        retryRef.current = 0;
      };
    };

    connect();

    return () => {
      isMounted = false;
      wsRef.current?.close();
    };
  }, [url]);
}
