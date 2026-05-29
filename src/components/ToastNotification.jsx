import { useState, useEffect } from 'react';

const TYPE_STYLE = {
  info:    { bg: '#1c2333', border: '#388bfd', icon: 'ℹ',  color: '#79c0ff' },
  success: { bg: '#0d2d1d', border: '#3fb950', icon: '✓',  color: '#3fb950' },
  warning: { bg: '#2d1f00', border: '#d29922', icon: '⚠',  color: '#e3b341' },
  error:   { bg: '#3d1010', border: '#f85149', icon: '✕',  color: '#f85149' },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

    const onToast = (e) => {
      const t = e.detail;
      setToasts(prev => [...prev, t]);
      if (!t.sticky && t.duration > 0) {
        setTimeout(() => dismiss(t.id), t.duration);
      }
    };

    window.addEventListener('app:toast', onToast);
    return () => window.removeEventListener('app:toast', onToast);
  }, []);

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      maxWidth: 400, pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const s = TYPE_STYLE[t.type] || TYPE_STYLE.info;
        return (
          <div key={t.id} style={{
            padding: '11px 14px',
            borderRadius: 6,
            background: s.bg,
            border: `1px solid ${s.border}`,
            color: '#e6edf3',
            fontSize: '0.87em',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            pointerEvents: 'all',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ color: s.color, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>{s.icon}</span>
            <span style={{ flex: 1, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {t.message}
            </span>
            <button
              onClick={() => dismiss(t.id)}
              style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '0 2px', fontSize: '1.1em', lineHeight: 1, flexShrink: 0 }}
            >×</button>
          </div>
        );
      })}
    </div>
  );
}

export function ConfirmDialog() {
  const [pending, setPending] = useState(null);

  useEffect(() => {
    const onConfirm = (e) => setPending(e.detail);
    window.addEventListener('app:confirm', onConfirm);
    return () => window.removeEventListener('app:confirm', onConfirm);
  }, []);

  if (!pending) return null;

  const respond = (yes) => {
    pending.resolve(yes);
    setPending(null);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
        padding: '22px 24px', maxWidth: 420, width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      }}>
        <p style={{
          color: '#e6edf3', fontSize: '0.92em', lineHeight: 1.6,
          whiteSpace: 'pre-wrap', margin: '0 0 20px 0',
        }}>
          {pending.message}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={() => respond(false)} style={{ fontSize: '0.85em' }}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => respond(true)} style={{ fontSize: '0.85em' }}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
