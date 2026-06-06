import { useState, useEffect } from 'react';

const API         = '/api/alert-settings';
const DISCORD_API = '/api/discord-settings';
const LS          = 'alertSettings_v1';

const DEFAULTS = {
  /* backend */
  thresholdBnb:  1,
  changePercent: 10,
  /* frontend */
  showHigh:      true,
  showMedium:    true,
  showLow:       true,
  soundEnabled:  false,
  maxHistory:    20,
  autoHideSec:   0,
};

const DISCORD_DEFAULTS = {
  webhookUrl:  '',
  enabled:     false,
  sendHigh:    true,
  sendMedium:  true,
  sendLow:     false,
};

export function loadAlertSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

function saveLocal(settings) {
  localStorage.setItem(LS, JSON.stringify(settings));
}

/* ── Toggle switch ── */
function Toggle({ value, onChange, label, desc, color = 'var(--accent)' }) {
  return (
    <label style={S.toggleRow}>
      <div style={S.toggleInfo}>
        <span style={S.toggleLabel}>{label}</span>
        {desc && <span style={S.toggleDesc}>{desc}</span>}
      </div>
      <div
        style={{ ...S.track, background: value ? color : 'var(--border)' }}
        onClick={() => onChange(!value)}
      >
        <div style={{ ...S.thumb, transform: value ? 'translateX(18px)' : 'translateX(2px)' }} />
      </div>
    </label>
  );
}

/* ── Number input ── */
function NumInput({ label, desc, value, onChange, min, max, step = 1, unit }) {
  return (
    <div style={S.fieldRow}>
      <div style={S.fieldInfo}>
        <span style={S.toggleLabel}>{label}</span>
        {desc && <span style={S.toggleDesc}>{desc}</span>}
      </div>
      <div style={S.numWrap}>
        <input
          type="number"
          style={S.numInput}
          value={value}
          min={min} max={max} step={step}
          onChange={e => onChange(Number(e.target.value))}
        />
        {unit && <span style={S.unit}>{unit}</span>}
      </div>
    </div>
  );
}

export default function AlertSettingsModal({ onClose, onSave }) {
  const [settings,  setSettings]  = useState(loadAlertSettings);
  const [discord,   setDiscord]   = useState(DISCORD_DEFAULTS);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState(null);
  const [testing,   setTesting]   = useState(false);
  const [testMsg,   setTestMsg]   = useState(null);

  /* Tải cài đặt backend hiện tại */
  useEffect(() => {
    fetch(API)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setSettings(prev => ({
            ...prev,
            thresholdBnb:  data.thresholdBnb  ?? prev.thresholdBnb,
            changePercent: data.changePercent  ?? prev.changePercent,
          }));
        }
      })
      .catch(() => {});

    fetch(DISCORD_API)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setDiscord(prev => ({ ...prev, ...data })); })
      .catch(() => {});
  }, []);

  function set(key, val) {
    setSettings(prev => ({ ...prev, [key]: val }));
  }
  function setDsc(key, val) {
    setDiscord(prev => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const [r1, r2] = await Promise.all([
        fetch(API, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            thresholdBnb:  settings.thresholdBnb,
            changePercent: settings.changePercent,
          }),
        }),
        fetch(DISCORD_API, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(discord),
        }),
      ]);
      if (!r1.ok || !r2.ok) throw new Error('Backend lỗi');

      saveLocal(settings);
      onSave?.(settings);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
    } catch {
      setError('Không thể kết nối backend. Cài đặt hiển thị đã được lưu cục bộ.');
      saveLocal(settings);
      onSave?.(settings);
      setTimeout(() => { setError(null); onClose(); }, 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch('/api/discord-test', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ webhookUrl: discord.webhookUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');
      setTestMsg({ ok: true, text: '✓ Đã gửi tin nhắn kiểm tra thành công!' });
    } catch (err) {
      setTestMsg({ ok: false, text: `✗ Lỗi: ${err.message}` });
    } finally {
      setTesting(false);
      setTimeout(() => setTestMsg(null), 5000);
    }
  }

  function handleReset() {
    setSettings({ ...DEFAULTS });
  }

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div>
            <h2 style={S.title}>⚙ Cài đặt cảnh báo</h2>
            <p style={S.subtitle}>Tùy chỉnh ngưỡng và cách hiển thị cảnh báo</p>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={S.body}>

          {/* ── Phần 1: Ngưỡng kích hoạt ── */}
          <div style={S.section}>
            <div style={S.sectionHeader}>
              <span style={S.sectionIcon}>🎯</span>
              <span style={S.sectionTitle}>Ngưỡng kích hoạt cảnh báo</span>
              <span style={S.sectionBadge}>Backend</span>
            </div>
            <div style={S.sectionDesc}>Thay đổi được áp dụng ngay cho tất cả ví đang theo dõi</div>

            <NumInput
              label="Ngưỡng số dư tối thiểu"
              desc="Cảnh báo CAO khi số dư ví giảm xuống dưới mức này"
              value={settings.thresholdBnb}
              onChange={v => set('thresholdBnb', v)}
              min={0} step={0.1} unit="BNB"
            />
            <NumInput
              label="Biến động % tối thiểu"
              desc="Cảnh báo khi số dư thay đổi vượt ngưỡng này trong 1 lần"
              value={settings.changePercent}
              onChange={v => set('changePercent', v)}
              min={1} max={100} unit="%"
            />
          </div>

          {/* ── Phần 2: Bộ lọc hiển thị ── */}
          <div style={S.section}>
            <div style={S.sectionHeader}>
              <span style={S.sectionIcon}>🔔</span>
              <span style={S.sectionTitle}>Bộ lọc mức cảnh báo</span>
              <span style={{ ...S.sectionBadge, background: 'rgba(52,152,219,.15)', color: 'var(--blue)' }}>Giao diện</span>
            </div>
            <div style={S.sectionDesc}>Chọn loại cảnh báo muốn hiển thị</div>

            <Toggle
              label="Cảnh báo CAO"
              desc="Số dư giảm xuống dưới ngưỡng tối thiểu"
              value={settings.showHigh}
              onChange={v => set('showHigh', v)}
              color="var(--red)"
            />
            <Toggle
              label="Cảnh báo VỪA"
              desc="Biến động lớn (≥ 2× ngưỡng %)"
              value={settings.showMedium}
              onChange={v => set('showMedium', v)}
              color="var(--orange)"
            />
            <Toggle
              label="Cảnh báo THẤP"
              desc="Biến động thông thường vượt ngưỡng %"
              value={settings.showLow}
              onChange={v => set('showLow', v)}
              color="var(--blue)"
            />
          </div>

          {/* ── Phần 3: Thông báo ── */}
          <div style={S.section}>
            <div style={S.sectionHeader}>
              <span style={S.sectionIcon}>🔊</span>
              <span style={S.sectionTitle}>Thông báo & Hiển thị</span>
              <span style={{ ...S.sectionBadge, background: 'rgba(52,152,219,.15)', color: 'var(--blue)' }}>Giao diện</span>
            </div>

            <Toggle
              label="Âm thanh thông báo"
              desc="Phát tiếng beep khi có cảnh báo mới"
              value={settings.soundEnabled}
              onChange={v => set('soundEnabled', v)}
            />

            <div style={S.fieldRow}>
              <div style={S.fieldInfo}>
                <span style={S.toggleLabel}>Tự động ẩn cảnh báo</span>
                <span style={S.toggleDesc}>0 = không tự ẩn</span>
              </div>
              <select
                style={S.select}
                value={settings.autoHideSec}
                onChange={e => set('autoHideSec', Number(e.target.value))}
              >
                <option value={0}>Không tự ẩn</option>
                <option value={30}>Sau 30 giây</option>
                <option value={60}>Sau 1 phút</option>
                <option value={300}>Sau 5 phút</option>
              </select>
            </div>
          </div>

          {/* ── Phần 4: Discord Webhook ── */}
          <div style={{ ...S.section, borderBottom: 'none' }}>
            <div style={S.sectionHeader}>
              <span style={S.sectionIcon}>💬</span>
              <span style={S.sectionTitle}>Discord Webhook</span>
              <span style={{ ...S.sectionBadge, background: 'rgba(88,101,242,.18)', color: '#7289da' }}>Backend</span>
            </div>
            <div style={S.sectionDesc}>Gửi cảnh báo trực tiếp vào kênh Discord của bạn</div>

            <Toggle
              label="Bật thông báo Discord"
              desc="Cảnh báo sẽ được gửi qua webhook khi được kích hoạt"
              value={discord.enabled}
              onChange={v => setDsc('enabled', v)}
              color="#7289da"
            />

            <div style={S.fieldRow}>
              <div style={S.fieldInfo}>
                <span style={S.toggleLabel}>Webhook URL</span>
                <span style={S.toggleDesc}>Lấy tại: Kênh Discord → Chỉnh sửa → Tích hợp → Webhook</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                style={{ ...S.webhookInput, flex: 1 }}
                placeholder="https://discord.com/api/webhooks/ID/TOKEN"
                value={discord.webhookUrl}
                onChange={e => setDsc('webhookUrl', e.target.value)}
                spellCheck={false}
              />
              <button
                style={{ ...S.testBtn, opacity: testing ? 0.7 : 1 }}
                onClick={handleTest}
                disabled={testing || !discord.webhookUrl}
                title="Gửi tin nhắn kiểm tra"
              >
                {testing ? '...' : 'Kiểm tra'}
              </button>
            </div>
            {testMsg && (
              <div style={{ fontSize: 12, color: testMsg.ok ? 'var(--green)' : 'var(--red)', marginTop: -4 }}>
                {testMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
              <Toggle
                label="Cảnh báo CAO"
                value={discord.sendHigh}
                onChange={v => setDsc('sendHigh', v)}
                color="var(--red)"
              />
              <Toggle
                label="Cảnh báo VỪA"
                value={discord.sendMedium}
                onChange={v => setDsc('sendMedium', v)}
                color="var(--orange)"
              />
              <Toggle
                label="Cảnh báo THẤP"
                value={discord.sendLow}
                onChange={v => setDsc('sendLow', v)}
                color="var(--blue)"
              />
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div style={S.footer}>
          {error && <span style={S.error}>{error}</span>}
          {saved && <span style={S.success}>✓ Đã lưu thành công!</span>}

          <button style={S.resetBtn} onClick={handleReset}>Đặt lại mặc định</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.cancelBtn} onClick={onClose}>Hủy</button>
            <button
              style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1 }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Đang lưu...' : '💾 Lưu cài đặt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ── */
const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, backdropFilter: 'blur(3px)',
  },
  modal: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, width: 520, maxWidth: '95vw',
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(0,0,0,.7)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
  },
  title:    { fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 },
  subtitle: { fontSize: 12, color: 'var(--muted)', marginTop: 3 },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--muted)',
    fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
    transition: 'color .15s',
  },

  body: { flex: 1, overflowY: 'auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 0 },

  section: {
    padding: '18px 0',
    borderBottom: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  sectionIcon:   { fontSize: 16 },
  sectionTitle:  { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  sectionBadge:  {
    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
    background: 'rgba(240,185,11,.15)', color: 'var(--accent)',
  },
  sectionDesc: { fontSize: 11, color: 'var(--muted)', marginTop: -6 },

  toggleRow:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' },
  toggleInfo:  { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  toggleLabel: { fontSize: 13, color: 'var(--text)', fontWeight: 500 },
  toggleDesc:  { fontSize: 11, color: 'var(--muted)' },
  track: {
    width: 38, height: 22, borderRadius: 11,
    position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0,
  },
  thumb: {
    position: 'absolute', top: 2, width: 18, height: 18,
    borderRadius: '50%', background: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,.3)', transition: 'transform .2s',
  },

  fieldRow:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  fieldInfo: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  numWrap:   { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  numInput: {
    width: 72, background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '5px 8px', color: 'var(--text)', fontSize: 13,
    outline: 'none', textAlign: 'right',
  },
  unit: { fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' },
  select: {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '5px 8px', color: 'var(--text)',
    fontSize: 12, outline: 'none', flexShrink: 0,
  },

  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 24px', borderTop: '1px solid var(--border)', gap: 8, flexWrap: 'wrap',
  },
  error:     { fontSize: 12, color: 'var(--red)', flex: 1 },
  success:   { fontSize: 12, color: 'var(--green)', flex: 1 },
  resetBtn: {
    background: 'none', border: '1px solid var(--border)', borderRadius: 7,
    color: 'var(--muted)', fontSize: 12, padding: '6px 12px', cursor: 'pointer',
  },
  cancelBtn: {
    background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7,
    color: 'var(--text)', fontSize: 13, padding: '7px 16px', cursor: 'pointer',
  },
  saveBtn: {
    background: 'var(--accent)', border: 'none', borderRadius: 7,
    color: '#0a0b0e', fontSize: 13, fontWeight: 700, padding: '7px 18px', cursor: 'pointer',
  },
  webhookInput: {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '6px 10px', color: 'var(--text)', fontSize: 12,
    outline: 'none', fontFamily: 'monospace',
  },
  testBtn: {
    background: 'rgba(88,101,242,.18)', border: '1px solid rgba(88,101,242,.4)',
    borderRadius: 6, color: '#7289da', fontSize: 12, fontWeight: 600,
    padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
  },
};
