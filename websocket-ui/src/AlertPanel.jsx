export default function AlertPanel({ alerts }) {
  return (
    <div className="card">
      <h2>Alerts</h2>
      {alerts.map((a, i) => (
        <div key={i} className={`alert ${a.level}`}>
          {a.message}
        </div>
      ))}
    </div>
  );
}
