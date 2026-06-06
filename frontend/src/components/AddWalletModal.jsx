import { useState, useEffect, useRef } from 'react';

const API = '/api/wallets';
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

export default function AddWalletModal({ onClose }) {
  const [address, setAddress] = useState('');
  const [label,   setLabel]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const inputRef = useRef(null);

  // Focus ô địa chỉ khi mở
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Đóng bằng Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const trimAddr  = address.trim();
  const isValid   = ADDR_RE.test(trimAddr);
  const isDirty   = trimAddr.length > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid || loading) return;
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ address: trimAddr, label: label.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Lỗi không xác định'); return; }
      onClose();
    } catch {
      setError('Không thể kết nối tới server — kiểm tra backend đang chạy');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">+ Thêm ví theo dõi</span>
          <button className="modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="modal-form">

          {/* Địa chỉ */}
          <div className="modal-field">
            <label className="modal-label">Địa chỉ ví BSC</label>
            <input
              ref={inputRef}
              className={`modal-input ${isDirty && !isValid ? 'modal-input--err' : ''} ${isDirty && isValid ? 'modal-input--ok' : ''}`}
              placeholder="0x..."
              value={address}
              onChange={e => { setAddress(e.target.value); setError(''); }}
              spellCheck={false}
            />
            {isDirty && !isValid && (
              <span className="modal-hint modal-hint--err">Địa chỉ không hợp lệ — cần 0x + 40 ký tự hex</span>
            )}
            {isDirty && isValid && (
              <span className="modal-hint modal-hint--ok">Địa chỉ hợp lệ ✓</span>
            )}
          </div>

          {/* Nhãn */}
          <div className="modal-field">
            <label className="modal-label">Nhãn <span className="modal-label-opt">(tuỳ chọn)</span></label>
            <input
              className="modal-input"
              placeholder="VD: Ví của tôi, Binance..."
              value={label}
              onChange={e => setLabel(e.target.value)}
              maxLength={40}
            />
          </div>

          {error && <div className="modal-error">{error}</div>}

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn--cancel" onClick={onClose}>
              Huỷ
            </button>
            <button
              type="submit"
              className="modal-btn modal-btn--submit"
              disabled={!isValid || loading}
            >
              {loading ? (
                <><span className="modal-spinner" />Đang thêm...</>
              ) : (
                '+ Thêm ví'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
