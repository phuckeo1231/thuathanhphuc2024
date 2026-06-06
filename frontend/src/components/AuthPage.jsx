import { useState, useEffect, useRef } from 'react';

/* ── Helpers ────────────────────────────────────────────────── */
function hashPassword(pw) {
  // Đơn giản hoá dùng btoa — phù hợp cho demo frontend
  return btoa(encodeURIComponent(pw + '__bsc_2024'));
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem('bsc_users') || '[]'); }
  catch { return []; }
}

function saveUsers(users) {
  localStorage.setItem('bsc_users', JSON.stringify(users));
}

export function createSession(username) {
  const session = {
    username,
    token: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 ngày
  };
  localStorage.setItem('bsc_session', JSON.stringify(session));
  return session;
}

export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem('bsc_session') || 'null');
    if (s && s.expiresAt > Date.now()) return s;
  } catch {}
  return null;
}

export function clearSession() {
  localStorage.removeItem('bsc_session');
}

/* ── Mật khẩu mạnh ─────────────────────────────────────────── */
function passwordStrength(pw) {
  if (pw.length < 6) return { level: 0, label: '' };
  let score = 0;
  if (pw.length >= 8)             score++;
  if (/[A-Z]/.test(pw))          score++;
  if (/[0-9]/.test(pw))          score++;
  if (/[^A-Za-z0-9]/.test(pw))  score++;
  if (score <= 1) return { level: 1, label: 'Yếu' };
  if (score === 2) return { level: 2, label: 'Trung bình' };
  if (score === 3) return { level: 3, label: 'Mạnh' };
  return { level: 4, label: 'Rất mạnh' };
}

const STRENGTH_COLOR = ['', '#e74c3c', '#f39c12', '#2ecc71', '#00b894'];

/* ── AuthPage ───────────────────────────────────────────────── */
export default function AuthPage({ onLogin }) {
  const [mode,      setMode]      = useState('login');
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [remember,  setRemember]  = useState(true);
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const usernameRef = useRef(null);

  const strength = mode === 'register' ? passwordStrength(password) : null;

  useEffect(() => {
    usernameRef.current?.focus();
    setError('');
    setSuccess('');
  }, [mode]);

  function switchMode(m) {
    setMode(m);
    setUsername('');
    setPassword('');
    setConfirmPw('');
    setError('');
    setSuccess('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    const u = username.trim();
    const p = password;

    // Validate
    if (!u) return setError('Vui lòng nhập tên đăng nhập');
    if (u.length < 3) return setError('Tên đăng nhập phải có ít nhất 3 ký tự');
    if (/\s/.test(u)) return setError('Tên đăng nhập không được chứa khoảng trắng');
    if (!p) return setError('Vui lòng nhập mật khẩu');
    if (p.length < 6) return setError('Mật khẩu phải có ít nhất 6 ký tự');

    if (mode === 'register') {
      if (confirmPw !== p) return setError('Mật khẩu xác nhận không khớp');
    }

    setLoading(true);
    setError('');

    // Mô phỏng độ trễ mạng
    await new Promise(r => setTimeout(r, 700));

    try {
      const users = getUsers();

      if (mode === 'register') {
        if (users.find(u2 => u2.username.toLowerCase() === u.toLowerCase())) {
          return setError('Tên đăng nhập đã được sử dụng');
        }
        saveUsers([...users, {
          username: u,
          passwordHash: hashPassword(p),
          createdAt: Date.now(),
        }]);
        setSuccess('Tạo tài khoản thành công! Đang chuyển hướng...');
        await new Promise(r => setTimeout(r, 800));
        onLogin(createSession(u));
      } else {
        const found = users.find(u2 => u2.username.toLowerCase() === u.toLowerCase());
        if (!found || found.passwordHash !== hashPassword(p)) {
          return setError('Tên đăng nhập hoặc mật khẩu không đúng');
        }
        onLogin(createSession(u));
      }
    } finally {
      setLoading(false);
    }
  }

  // Demo: thêm tài khoản mẫu nếu chưa có user nào
  function loginDemo() {
    const users = getUsers();
    const demo = { username: 'demo', passwordHash: hashPassword('demo123'), createdAt: Date.now() };
    if (!users.find(u => u.username === 'demo')) saveUsers([...users, demo]);
    setUsername('demo');
    setPassword('demo123');
    setMode('login');
    setError('');
  }

  return (
    <div className="auth-page">

      {/* ── Bên trái: Branding ── */}
      <div className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-logo-wrap">
            <span className="auth-logo">◈</span>
          </div>
          <h1 className="auth-brand-title">BSC Asset Monitor</h1>
          <p className="auth-brand-desc">
            Theo dõi ví, token và giao dịch trên Binance Smart Chain theo thời gian thực.
          </p>

          <ul className="auth-features">
            {[
              { icon: '📡', text: 'Dữ liệu blockchain thời gian thực' },
              { icon: '🔔', text: 'Cảnh báo biến động số dư tức thì' },
              { icon: '📊', text: 'Trình sàng lọc 500+ token BSC' },
              { icon: '🐋', text: 'Theo dõi ví cá voi & sàn giao dịch' },
            ].map(f => (
              <li key={f.text} className="auth-feature">
                <span className="auth-feature-icon">{f.icon}</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>

          <div className="auth-brand-badges">
            <span className="auth-badge">BSC Mainnet</span>
            <span className="auth-badge">Binance WS</span>
            <span className="auth-badge">CoinGecko</span>
          </div>
        </div>
      </div>

      {/* ── Bên phải: Form ── */}
      <div className="auth-right">
        <div className="auth-card">

          {/* Tabs */}
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
              onClick={() => switchMode('login')}
            >
              Đăng nhập
            </button>
            <button
              className={`auth-tab ${mode === 'register' ? 'auth-tab--active' : ''}`}
              onClick={() => switchMode('register')}
            >
              Đăng ký
            </button>
          </div>

          {/* Form */}
          <form className="auth-form" onSubmit={handleSubmit} noValidate>

            {/* Tên đăng nhập */}
            <div className="auth-field">
              <label className="auth-label">Tên đăng nhập</label>
              <div className="auth-input-wrap">
                <span className="auth-input-prefix">@</span>
                <input
                  ref={usernameRef}
                  className="auth-input"
                  type="text"
                  placeholder="Nhập tên đăng nhập..."
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  autoComplete="username"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Mật khẩu */}
            <div className="auth-field">
              <label className="auth-label">Mật khẩu</label>
              <div className="auth-input-wrap">
                <span className="auth-input-prefix">🔒</span>
                <input
                  className="auth-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu..."
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="auth-pw-eye"
                  onClick={() => setShowPw(s => !s)}
                  tabIndex={-1}
                  title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>

              {/* Thanh độ mạnh mật khẩu */}
              {mode === 'register' && password.length > 0 && (
                <div className="auth-strength">
                  <div className="auth-strength-bars">
                    {[1,2,3,4].map(n => (
                      <span
                        key={n}
                        className="auth-strength-bar"
                        style={{ background: n <= strength.level ? STRENGTH_COLOR[strength.level] : undefined }}
                      />
                    ))}
                  </div>
                  {strength.label && (
                    <span className="auth-strength-label" style={{ color: STRENGTH_COLOR[strength.level] }}>
                      {strength.label}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Xác nhận mật khẩu — chỉ khi đăng ký */}
            {mode === 'register' && (
              <div className="auth-field">
                <label className="auth-label">Xác nhận mật khẩu</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-prefix">🔒</span>
                  <input
                    className={`auth-input ${confirmPw && confirmPw !== password ? 'auth-input--err' : ''} ${confirmPw && confirmPw === password ? 'auth-input--ok' : ''}`}
                    type={showPw ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu..."
                    value={confirmPw}
                    onChange={e => { setConfirmPw(e.target.value); setError(''); }}
                    autoComplete="new-password"
                  />
                  {confirmPw && (
                    <span className="auth-input-check">
                      {confirmPw === password ? '✓' : '✗'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Ghi nhớ đăng nhập */}
            {mode === 'login' && (
              <div className="auth-options">
                <label className="auth-remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>
                <button type="button" className="auth-forgot">Quên mật khẩu?</button>
              </div>
            )}

            {/* Thông báo lỗi / thành công */}
            {error   && <div className="auth-msg auth-msg--err">⚠ {error}</div>}
            {success && <div className="auth-msg auth-msg--ok">✓ {success}</div>}

            {/* Nút submit */}
            <button type="submit" className="auth-submit" disabled={loading || !!success}>
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  {mode === 'login' ? 'Đang đăng nhập...' : 'Đang tạo tài khoản...'}
                </>
              ) : (
                mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'
              )}
            </button>

            {/* Demo nhanh */}
            {mode === 'login' && (
              <button type="button" className="auth-demo-btn" onClick={loginDemo}>
                Dùng tài khoản Demo
              </button>
            )}

            {/* Chuyển mode */}
            <p className="auth-switch">
              {mode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'Đăng ký ngay →' : 'Đăng nhập →'}
              </button>
            </p>

          </form>
        </div>

        <p className="auth-footer">
          ◈ BSC Asset Monitor · Dữ liệu: BSCScan &amp; Binance
        </p>
      </div>

    </div>
  );
}
