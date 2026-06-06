export default function EventLog({ events }) {
  return (
    <div className="card">
      <h2>Event Log</h2>
      <ul>
        {events.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
