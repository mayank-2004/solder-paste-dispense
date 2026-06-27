import { useState } from 'react';

const PIN_KEY = 'glueAdminPin';
const RECOVERY_KEY = 'SWAJA0000';

export function getStoredPin() {
  return localStorage.getItem(PIN_KEY) || '1234';
}

// ── Shared inline styles ────────────────────────────────────────────────────
const OVERLAY = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const CARD = {
  background: '#0d1117', border: '1px solid #30363d', borderRadius: 10,
  padding: '28px 32px', width: 320, boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
  display: 'flex', flexDirection: 'column', gap: 14,
};
const INPUT = {
  padding: '9px 12px', background: '#161b22', border: '1px solid #30363d',
  borderRadius: 6, color: '#e6edf3', fontSize: '1.05rem', outline: 'none',
  letterSpacing: '0.25em', width: '100%', boxSizing: 'border-box',
};
const BTN_PRIMARY = {
  flex: 1, padding: '9px 0', background: 'rgba(0,200,215,0.12)',
  border: '1px solid rgba(0,200,215,0.45)', borderRadius: 6, color: '#00c8d7',
  cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.04em',
};
const BTN_SECONDARY = {
  flex: 1, padding: '9px 0', background: 'transparent',
  border: '1px solid #30363d', borderRadius: 6, color: '#8b949e',
  cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
};
const ERR = { color: '#f85149', fontSize: '0.82rem', marginTop: -6 };
const MUTED = { margin: 0, color: '#8b949e', fontSize: '0.84rem', lineHeight: 1.5 };
const TITLE = { margin: 0, color: '#e6edf3', fontSize: '1rem', fontWeight: 700 };

// ── Unlock modal (shown when operator clicks the lock button) ───────────────
export function PinUnlockModal({ onSuccess, onClose }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('unlock'); // 'unlock' | 'forgot'
  const [recovery, setRecovery] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  const tryUnlock = () => {
    if (pin === getStoredPin()) { onSuccess(); }
    else { setError('Incorrect PIN'); setPin(''); }
  };

  const tryRecovery = () => {
    if (recovery === RECOVERY_KEY) {
      localStorage.removeItem(PIN_KEY); // resets to default 1234
      onSuccess();
    } else {
      setRecoveryError('Invalid recovery key');
      setRecovery('');
    }
  };

  if (mode === 'forgot') return (
    <div style={OVERLAY}>
      <div style={CARD}>
        <h3 style={TITLE}>PIN Recovery</h3>
        <p style={MUTED}>Enter the supervisor recovery key. The PIN will be reset to the default <strong style={{ color: '#e6edf3' }}>1234</strong> — change it after logging in.</p>
        <input
          type="password" value={recovery} autoFocus style={INPUT}
          placeholder="Recovery key"
          onChange={e => { setRecovery(e.target.value); setRecoveryError(''); }}
          onKeyDown={e => e.key === 'Enter' && tryRecovery()}
        />
        {recoveryError && <span style={ERR}>{recoveryError}</span>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={BTN_PRIMARY} onClick={tryRecovery}>Reset PIN</button>
          <button style={BTN_SECONDARY} onClick={() => { setMode('unlock'); setRecovery(''); setRecoveryError(''); }}>Back</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={OVERLAY}>
      <div style={CARD}>
        <h3 style={TITLE}>🔒 Admin Unlock</h3>
        <p style={MUTED}>Enter your PIN to enable Admin mode and access machine settings.</p>
        <input
          type="password" value={pin} autoFocus style={INPUT}
          placeholder="Enter PIN" maxLength={8}
          onChange={e => { setPin(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && tryUnlock()}
        />
        {error && <span style={ERR}>{error}</span>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={BTN_PRIMARY} onClick={tryUnlock}>Unlock</button>
          <button style={BTN_SECONDARY} onClick={onClose}>Cancel</button>
        </div>
        <button
          onClick={() => setMode('forgot')}
          style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', fontSize: '0.8rem', padding: 0, textAlign: 'left' }}
        >
          Forgot PIN?
        </button>
      </div>
    </div>
  );
}

// ── Change-PIN modal (admin only, accessed from header) ─────────────────────
export function ChangePinModal({ onClose }) {
  const [step, setStep] = useState(1);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const verifyCurrentPin = () => {
    if (currentPin === getStoredPin()) { setStep(2); setError(''); }
    else { setError('Incorrect current PIN'); setCurrentPin(''); }
  };

  const validateNewPin = () => {
    if (!/^\d{4,8}$/.test(newPin)) { setError('PIN must be 4–8 digits'); return; }
    if (newPin === getStoredPin()) { setError('This PIN is already in use'); return; }
    setStep(3); setError('');
  };

  const confirmNewPin = () => {
    if (confirmPin !== newPin) { setError('PINs do not match'); setConfirmPin(''); return; }
    localStorage.setItem(PIN_KEY, newPin);
    setDone(true);
  };

  if (done) return (
    <div style={OVERLAY}>
      <div style={CARD}>
        <h3 style={{ ...TITLE, color: '#3fb950' }}>✓ PIN Changed</h3>
        <p style={MUTED}>Your admin PIN has been updated successfully.</p>
        <button style={BTN_PRIMARY} onClick={onClose}>Close</button>
      </div>
    </div>
  );

  const steps = {
    1: { title: 'Change PIN — Step 1/3', label: 'Enter your current PIN to verify identity.', value: currentPin, set: setCurrentPin, onNext: verifyCurrentPin },
    2: { title: 'Change PIN — Step 2/3', label: 'Enter a new PIN (4–8 digits).', value: newPin, set: setNewPin, onNext: validateNewPin },
    3: { title: 'Change PIN — Step 3/3', label: 'Confirm the new PIN.', value: confirmPin, set: setConfirmPin, onNext: confirmNewPin },
  };
  const s = steps[step];

  return (
    <div style={OVERLAY}>
      <div style={CARD}>
        <h3 style={TITLE}>🔑 {s.title}</h3>
        <p style={MUTED}>{s.label}</p>
        <input
          type="password" value={s.value} autoFocus style={INPUT}
          placeholder="••••" maxLength={8}
          onChange={e => { s.set(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && s.onNext()}
        />
        {error && <span style={ERR}>{error}</span>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={BTN_PRIMARY} onClick={s.onNext}>{step === 3 ? 'Save PIN' : 'Next'}</button>
          <button style={BTN_SECONDARY} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
