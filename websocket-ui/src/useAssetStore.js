import { useState } from "react";

export default function useAssetStore() {
  const [wallet, setWallet] = useState({ balance: 0 });
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);

  const updateFromSocket = (data) => {
    if (data.balance !== undefined) {
      setWallet({ balance: data.balance });
    }
    if (data.alert) {
      setAlerts((prev) => [data.alert, ...prev]);
    }
    if (data.event) {
      setEvents((prev) => [data.event, ...prev]);
    }
  };

  return { wallet, alerts, events, updateFromSocket };
}
