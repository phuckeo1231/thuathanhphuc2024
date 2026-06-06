import { useState, useEffect } from 'react';

const API_GLOBAL = '/api/alert-settings';
const API_WALLET = (addr) => `/api/alert-settings/wallet/${addr}`;

export default function WalletAlertSettingsModal({ wallet, onClose }) {
  const [global, setGlobal]       = useState({ thresholdBnb: 1, changePercent: 10 });
  const [override, setOverride]   = useState(false);   // dùng cài đặt riêng?
  const [threshold, setThreshold] = useState(1);
  const [percent,   setPercent]   = useState(10);

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [status,  setStatus]  = useState(null); // { type: 'ok'|'err', msg }

  /* Tải cài đặt toàn cục + override của ví này */
  useEffect(() => {
    Promise.all([
      fetch(API_GLOBAL).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(API_WALLET(wallet.address)).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([g, w]) => {
      if (g) setGlobal(g);
      if (w) {
        setOverride(w.hasOverride ?? false);
        setThreshold(w.thresholdBnb  ?? g?.thresholdBnb  ?? 1);
        setPercent(  w.changePercent ?? g?.changePercent  ?? 10);
      } else if (g) {
        setThreshold(g.thresholdBnb);
        setPercent(g.changePercent);
      }
    }).finally(() => setLoading(false));
  }, [wallet.address]);

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      if (!override) {
        /* Xóa override — quay về cài đặt chung */
        await fetch(API_WALLET(wallet.address), { method: 'DELETE' });
      } else {
        await fetch(API_WALLET(wallet.address), {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ thresholdBnb: threshold, changePercent: percent }),
        });
      }
      setStatus({ type: 'ok', msg: '✓ Đã lưu thành công!' });
      setTimeout(onClose, 900);
    } catch {
      setStatus({ type: 'err', msg: 'Không thể kết nối backend' });
    } finally {
      setSaving(false);
    }
  }

  const label = wallet.label || `${wallet.address.slice(0, 8)}…`;

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <h2 style={S.title}>🔔 Ngưỡng cảnh báo</h2>
            <p style={S.subtitle}>{label}</p>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={S.loadingWrap}>Đang tải...</div>
        ) : (
          <div style={S.body}>

            {/* Cài đặt chung (tham chiếu) */}
            <div style={S.section}>
              <div style={S.sectionTitle}>Cài đặt chung (mặc định)</div>
              <div style={S.refRow}>
                <span style={S.refLabel}>Ngưỡng số dư tối thiểu</span>
                <span style={S.refVal}>{global.thresholdBnb} BNB</span>
              </div>
              <div style={S.refRow}>
                <span style={S.refLabel}>Biến động tối thiểu</span>
                <span style={S.refVal}>{global.changePercent}%</span>
              </div>
            </div>

            {/* Toggle override */}
            <div style={S.section}>
              <label style={S.toggleRow}>
                <div style={S.toggleInfo}>
                  <span style={S.toggleLabel}>Ghi đè cài đặt riêng cho ví này</span>
                  <span style={S.toggleDesc}>Bật để đặt ngưỡng khác với cài đặt chung</span>
                </div>
                <div
                  style={{ ...S.track, background: override ? 'var(--accent)' : 'var(--border)' }}
                  onClick={() => setOverride(v => !v)}
                >
                  <div style={{ ...S.thumb, transform: override ? 'translateX(18px)' : 'translateX(2px)' }} />
                </div>
              </label>
            </div>

            {/* Override fields */}
            {override && (
              <div style={S.section}>
                <div style={S.sectionTitle}>Cài đặt riêng</div>

                <div style={S.fieldRow}>
                  <div style={S.fieldInfo}>
                    <span style={S.toggleLabel}>Ngưỡng số dư tối thiểu</span>
                    <span style={S.toggleDesc}>Cảnh báo CAO khi số dư xuống dưới mức này</span>
                  </div>
                  <div style={S.numWrap}>
                    <input
                      type="number" style={S.numInput}
                      value={threshold} min={0} step={0.1}
                      onChange={e => setThreshold(Number(e.target.value))}
                    />
                    <span style={S.unit}>BNB</span>
                  </div>
                </div>

                <div style={S.fieldRow}>
                  <div style={S.fieldInfo}>
                    <span style={S.toggleLabel}>Biến động % tối thiểu</span>
                    <span style={S.toggleDesc}>Cảnh báo khi số dư thay đổi vượt ngưỡng này</span>
                  </div>
                  <div style={S.numWrap}>
                    <input
                      type="number" style={S.numInput}
                      value={percent} min={1} max={100} step={1}
                      onChange={e => setPercent(Number(e.target.value))}
                    />
                    <span style={S.unit}>%</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Footer */}
        <div style={S.footer}>
          {status && (
            <span style={status.type === 'ok' ? S.success : S.error}>{status.msg}</span>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button style={S.cancelBtn} onClick={onClose}>Hủy</button>
            <button
              style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1 }}
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? 'Đang lưu...' : '💾 Lưu'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 2000, backdropFilter: 'blur(3px)',
  },
  modal: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, width: 460, maxWidth: '95vw',
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(0,0,0,.7)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '18px 22px 14px', borderBottom: '1px solid var(--border)',
  },
  title:    { fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 },
  subtitle: { fontSize: 12, color: 'var(--accent)', marginTop: 3, fontWeight: 600 },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--muted)',
    fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
  },
  loadingWrap: { padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 },
  body: { flex: 1, overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column' },
  section: {
    padding: '14px 0', borderBottom: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' },
  refRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  refLabel: { fontSize: 12, color: 'var(--muted)' },
  refVal:   { fontSize: 12, color: 'var(--text)', fontWeight: 600, fontFamily: 'monospace' },
  toggleRow:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' },
  toggleInfo: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  toggleLabel: { fontSize: 13, color: 'var(--text)', fontWeight: 500 },
  toggleDesc:  { fontSize: 11, color: 'var(--muted)' },
  track: { width: 38, height: 22, borderRadius: 11, position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 },
  thumb: { position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.3)', transition: 'transform .2s' },
  fieldRow:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  fieldInfo: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  numWrap:   { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  numInput: {
    width: 72, background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '5px 8px', color: 'var(--text)', fontSize: 13,
    outline: 'none', textAlign: 'right',
  },
  unit: { fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' },
  footer: {
    display: 'flex', alignItems: 'center', padding: '14px 22px',
    borderTop: '1px solid var(--border)', gap: 8,
  },
  error:     { fontSize: 12, color: 'var(--red)', flex: 1 },
  success:   { fontSize: 12, color: 'var(--green)', flex: 1 },
  cancelBtn: {
    background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7,
    color: 'var(--text)', fontSize: 13, padding: '7px 14px', cursor: 'pointer',
  },
  saveBtn: {
    background: 'var(--accent)', border: 'none', borderRadius: 7,
    color: '#0a0b0e', fontSize: 13, fontWeight: 700, padding: '7px 16px', cursor: 'pointer',
  },
};
