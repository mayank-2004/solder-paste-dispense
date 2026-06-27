import { useState } from 'react';
import { PinUnlockModal, ChangePinModal } from './AdminAuth.jsx';

export default function AppHeader({ mPos, isSerialConnected, isEmergencyStopped, onStop, onReset, isAdmin, onUnlock, onLock }) {
  const [showUnlock, setShowUnlock] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);

  return (
    <header className="app-header">
      <div className="app-logo">
        <div className="app-logo-icon">🔧</div>
        <div>
          <div className="app-logo-text">SolderPaste Dispenser</div>
          <div className="app-logo-sub">Motion Control System</div>
        </div>
      </div>
      <div className="header-divider" />
      <div className="header-dro">
        <div className="dro-axis">
          <span className="dro-label">X</span>
          <span className="dro-value">{mPos.x.toFixed(3)}</span>
          <span className="dro-unit">mm</span>
        </div>
        <div className="dro-sep" />
        <div className="dro-axis">
          <span className="dro-label">Y</span>
          <span className="dro-value">{mPos.y.toFixed(3)}</span>
          <span className="dro-unit">mm</span>
        </div>
        <div className="dro-sep" />
        <div className="dro-axis">
          <span className="dro-label">Z</span>
          <span className="dro-value">{(mPos.z ?? 0).toFixed(3)}</span>
          <span className="dro-unit">mm</span>
        </div>
      </div>
      <div className="header-spacer" />
      <div className="header-right">
        {/* Mode indicator + lock/unlock */}
        <div className="mode-btn-group">
          <button
            className={`mode-btn ${isAdmin ? 'mode-admin' : 'mode-operator'}`}
            onClick={() => isAdmin ? onLock() : setShowUnlock(true)}
            title={isAdmin ? 'Click to lock — return to Operator mode' : 'Click to unlock Admin mode'}
          >
            <span className="mode-icon">{isAdmin ? '🔓' : '🔒'}</span>
            <span className="mode-label">{isAdmin ? 'ADMIN' : 'OPERATOR'}</span>
          </button>
          {isAdmin && (
            <button
              className="mode-btn mode-changepin"
              onClick={() => setShowChangePin(true)}
              title="Change admin PIN"
              style={{color: "#58a6ff"}}
            >
              Change PIN
            </button>
          )}
        </div>

        <div className="header-divider" />

        <div className={`status-pill ${isSerialConnected ? 'connected' : 'disconnected'}`}>
          <span className="pill-dot" />
          {isSerialConnected ? 'CONNECTED' : 'OFFLINE'}
        </div>
        <button
          className={`estop-btn ${isEmergencyStopped ? 'triggered' : ''}`}
          onClick={isEmergencyStopped ? onReset : onStop}
          title={isEmergencyStopped ? 'Click to RESET machine' : 'Emergency Stop'}
        >
          <span className="estop-dot" />
          {isEmergencyStopped ? 'RESET' : 'E-STOP'}
        </button>
      </div>

      {showUnlock && (
        <PinUnlockModal
          onSuccess={() => { onUnlock(); setShowUnlock(false); }}
          onClose={() => setShowUnlock(false)}
        />
      )}
      {showChangePin && (
        <ChangePinModal onClose={() => setShowChangePin(false)} />
      )}
    </header>
  );
}
