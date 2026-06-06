import useWebSocket from "./useWebSocket";
import useAssetStore from "./useAssetStore";
import WalletCard from "./WalletCard";
import AlertPanel from "./AlertPanel";
import EventLog from "./EventLog";
import "./App.css";

export default function App() {
  const { wallet, alerts, events, updateFromSocket } = useAssetStore();
  useWebSocket("ws://localhost:8080", updateFromSocket);

  return (
    <div className="app">
      <WalletCard balance={wallet.balance} />
      <AlertPanel alerts={alerts} />
      <EventLog events={events} />
    </div>
  );
}
