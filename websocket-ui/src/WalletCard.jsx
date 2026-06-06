import { useEffect, useState } from "react";

export default function WalletCard({ balance }) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 500);
    return () => clearTimeout(t);
  }, [balance]);

  return (
    <div className={`card ${flash ? "flash" : ""}`}>
      <h2>Wallet</h2>
      <p>${balance}</p>
    </div>
  );
}
