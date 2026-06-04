import { useState, useEffect, useRef } from 'react';
import { computeNozzleHealth } from '../lib/maintenance/nozzleMaintenance.js';

function HealthRing({ score }) {
  const color = score >= 75 ? '#3fb950' : score >= 50 ? '#e3b341' : '#f85149';
  const deg = Math.round((score / 100) * 360);
  return (
    <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%',
        background: `conic-gradient(${color} 0deg ${deg}deg, #21262d ${deg}deg 360deg)`,
      }} />
      <div style={{
        position: 'absolute', inset: 8, borderRadius: '50%',
        background: '#0d1117',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color, fontWeight: 700, fontSize: '0.9em', lineHeight: 1 }}>{score}</span>
      </div>
    </div>
  );
}

export default function MaintenanceManager({ manager, onPurge, isPurging = false, spcJobs = [] }) {
  const [status, setStatus] = useState(() => manager?.getMaintenanceStatus() ?? null);
  const [showAlert, setShowAlert] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const wasCleaningNeeded = useRef(false);

  useEffect(() => {
    if (!manager) return;
    setStatus(manager.getMaintenanceStatus());
    const interval = setInterval(() => {
      const s = manager.getMaintenanceStatus();
      setStatus(s);
      if (s.needsCleaning && !wasCleaningNeeded.current) {
        wasCleaningNeeded.current = true;
        setShowAlert(true);
      } else if (!s.needsCleaning) {
        wasCleaningNeeded.current = false;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [manager]);

  if (!status) return null;

  const health = computeNozzleHealth(status, spcJobs);
  const ringColor = health >= 75 ? '#3fb950' : health >= 50 ? '#e3b341' : '#f85149';
  const healthLabel = health >= 75 ? 'Nozzle healthy'
    : health >= 50 ? 'Clean nozzle soon'
    : health >= 25 ? 'Clean nozzle now'
    : 'Poor dot quality — consider replacement';

  const markCleaned = () => {
    manager.markCleaned();
    setStatus(manager.getMaintenanceStatus());
    wasCleaningNeeded.current = false;
    setShowAlert(false);
  };

  return (
    <>
      {/* Cleaning required dialog */}
      {showAlert && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#161b22', border: '1px solid #f85149', borderRadius: 10,
            padding: '24px 28px', maxWidth: 360, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <h4 style={{ color: '#f85149', margin: '0 0 10px 0', fontSize: '1em' }}>
              ⚠ Nozzle Cleaning Required
            </h4>
            <p style={{ color: '#c9d1d9', fontSize: '0.86em', margin: '0 0 8px 0', lineHeight: 1.5 }}>
              The nozzle has reached its cleaning threshold
              ({status.dispenseCount} pads / {status.hoursSinceLastCleaning}h since last clean).
            </p>
            <p style={{ color: '#8b949e', fontSize: '0.82em', margin: '0 0 18px 0' }}>
              Clean the nozzle now and click <strong style={{ color: '#e6edf3' }}>Mark Cleaned</strong> to reset the counter,
              or dismiss to continue anyway.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" style={{ flex: 1 }} onClick={markCleaned}>
                ✓ Mark Cleaned
              </button>
              <button className="btn secondary" style={{ flex: 1 }} onClick={() => setShowAlert(false)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline widget */}
      <div style={{
        marginTop: 12, padding: '10px 12px',
        background: health < 50 ? 'rgba(220,50,50,0.08)' : health < 75 ? 'rgba(227,179,65,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${health < 50 ? '#f85149' : health < 75 ? '#e3b341' : '#30363d'}`,
        borderRadius: 8,
      }}>
        {/* Header: ring + title/score/buttons */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <HealthRing score={health} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
              <span style={{ fontWeight: 600, fontSize: '0.85em', color: '#e6edf3' }}>🔧 Nozzle Maintenance</span>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  className="btn secondary"
                  style={{ fontSize: '0.75em', padding: '2px 8px', height: 'auto' }}
                  onClick={() => setShowSettings(s => !s)}
                  title="Configure thresholds"
                >⚙</button>
                <button
                  className="btn secondary"
                  style={{ fontSize: '0.75em', padding: '2px 10px', height: 'auto' }}
                  onClick={markCleaned}
                >✓ Mark Cleaned</button>
              </div>
            </div>
            <div style={{ marginTop: 3, fontSize: '0.8em', color: ringColor, fontWeight: 600 }}>
              {healthLabel}
            </div>
            <div style={{ marginTop: 2, fontSize: '0.72em', color: '#8b949e' }}>
              Score: {health}/100{spcJobs.length > 0 ? ` · last ${Math.min(5, spcJobs.length)} job${spcJobs.length === 1 ? '' : 's'}` : ' · no SPC data yet'}
            </div>
          </div>
        </div>

        {showSettings && (
          <div style={{ marginBottom: 10, padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6 }}>
            <div style={{ fontSize: '0.76em', color: '#8b949e', marginBottom: 6, fontWeight: 600 }}>Cleaning Thresholds</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ flex: 1, minWidth: 100, fontSize: '0.76em', color: '#8b949e' }}>
                Max pads
                <input
                  type="number" min="10" max="10000" step="50"
                  defaultValue={status.settings.maxDispensesBeforeCleaning}
                  style={{ display: 'block', width: '100%', marginTop: 3, padding: '2px 6px', background: '#161b22', border: '1px solid #30363d', borderRadius: 4, color: '#e6edf3', fontSize: '0.95em' }}
                  onBlur={e => {
                    const v = parseInt(e.target.value);
                    if (v >= 10) { manager.updateSettings({ maxDispensesBeforeCleaning: v }); setStatus(manager.getMaintenanceStatus()); }
                  }}
                />
              </label>
              <label style={{ flex: 1, minWidth: 100, fontSize: '0.76em', color: '#8b949e' }}>
                Max hours
                <input
                  type="number" min="1" max="168" step="1"
                  defaultValue={status.settings.maxHoursBeforeCleaning}
                  style={{ display: 'block', width: '100%', marginTop: 3, padding: '2px 6px', background: '#161b22', border: '1px solid #30363d', borderRadius: 4, color: '#e6edf3', fontSize: '0.95em' }}
                  onBlur={e => {
                    const v = parseInt(e.target.value);
                    if (v >= 1) { manager.updateSettings({ maxHoursBeforeCleaning: v }); setStatus(manager.getMaintenanceStatus()); }
                  }}
                />
              </label>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, fontSize: '0.78em', color: '#8b949e', flexWrap: 'wrap', marginBottom: 8 }}>
          <span>
            <span style={{ color: status.dispensesRemaining === 0 ? '#f85149' : '#e6edf3', fontWeight: 600 }}>
              {status.dispenseCount}
            </span>
            {' '}/ {status.settings.maxDispensesBeforeCleaning} pads
          </span>
          <span>
            <span style={{ color: status.hoursRemaining === 0 ? '#f85149' : '#e6edf3', fontWeight: 600 }}>
              {status.hoursSinceLastCleaning}h
            </span>
            {' '}since cleaned
          </span>
          {!status.needsCleaning && (
            <span style={{ color: '#3fb950' }}>{status.dispensesRemaining} pads remaining</span>
          )}
        </div>

        {status.needsCleaning && (
          <button
            className="btn danger full-width"
            style={{ fontSize: '0.78em', marginBottom: 6 }}
            onClick={() => setShowAlert(true)}
          >
            ⚠ View Cleaning Alert
          </button>
        )}

        {onPurge && (
          <button
            className="btn secondary full-width"
            style={{ fontSize: '0.78em', marginTop: 2, opacity: isPurging ? 0.6 : 1 }}
            disabled={isPurging}
            onClick={onPurge}
          >
            {isPurging ? '⏳ Purging...' : '💧 Purge Nozzle Now'}
          </button>
        )}

        <div style={{ marginTop: 6, fontSize: '0.72em', color: '#6e7681', textAlign: 'right' }}>
          Last cleaned: {new Date(status.lastCleaningTime).toLocaleString()}
        </div>
      </div>
    </>
  );
}
