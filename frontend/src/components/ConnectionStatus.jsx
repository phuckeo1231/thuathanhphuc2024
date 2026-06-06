const STATUS = {
  connected:    { color: '#2ecc71', label: 'Đã kết nối' },
  connecting:   { color: '#f1c40f', label: 'Đang kết nối...' },
  reconnecting: { color: '#e67e22', label: 'Đang kết nối lại...' },
  error:        { color: '#e74c3c', label: 'Lỗi kết nối' },
};

export default function ConnectionStatus({ status }) {
  const { color, label } = STATUS[status] ?? STATUS.connecting;
  return (
    <div className="connection-status">
      <span className="status-dot" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
