import React, { useState } from 'react';
import { useAdmin } from './AdminContext.jsx';
import { toast } from '../lib/toast.js';
import './FumeExtractionPanel.css';

export default function FumeExtractionPanel({
  fumeManager,       // The useFumeExtraction() hook return object
  isConnected,
  isJobRunning,
  systemStatus,      // 'READY', 'RUNNING', 'POST-RUN', 'FAULT', 'SERVICE_REQUIRED'
  liveAirflow,       // LPM (from hardware)
  pumpLoad,          // % (from hardware)
  onManualStart,
  onStop
}) {
  const { isAdmin } = useAdmin();
  const [unlocked, setUnlocked] = useState(false);

  // All state comes directly from the hook — no local mirror needed
  const {
    filterHealthPct,
    operatingHours,
    serviceThresholdHours,
    postRunDurationSec,
    minAirflowLpm,
    events,
    updateConfig,
    resetFilter,
    clearEvents,
  } = fumeManager || {};

  const handleConfigChange = (field, value) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    updateConfig?.({ [field]: num });
  };

  const handleResetFilter = () => {
    if (window.confirm("Are you sure you want to reset the HEPA filter hours?")) {
      resetFilter?.();
      toast.success("HEPA Filter life reset successfully.");
    }
  };

  const handleClearLog = () => {
    if (window.confirm("Clear all event logs?")) {
      clearEvents?.();
    }
  };

  const healthPct = filterHealthPct ?? 100;
  const healthPercentStr = healthPct.toFixed(1);
  const barColor = healthPct > 20 ? 'var(--accent-green)' : (healthPct > 5 ? 'var(--accent-orange)' : 'var(--accent-red)');

  const statusDisplay = systemStatus || 'READY';
  let badgeClass = 'status-badge ';
  if (statusDisplay === 'READY') badgeClass += 'badge-ready';
  else if (statusDisplay === 'RUNNING') badgeClass += 'badge-running';
  else if (statusDisplay === 'POST-RUN') badgeClass += 'badge-postrun';
  else badgeClass += 'badge-fault';

  return (
    <div className="fume-panel">
      <div className="fume-header">
        <h2><span className="accent-bar"></span> FUME EXTRACTION SYSTEM</h2>
      </div>

      <div className="fume-card status-card">
        <div className="status-info">
          <h3>SYSTEM STATUS</h3>
          <span className={badgeClass}>{statusDisplay}</span>
        </div>
        <div className="status-actions">
          <button 
            className="btn fume-btn" 
            onClick={onManualStart}
            disabled={!isConnected || statusDisplay === 'RUNNING' || statusDisplay === 'FAULT' || isJobRunning}
          >
            MANUAL START
          </button>
          <button 
            className="btn fume-btn-dark" 
            onClick={onStop}
            disabled={!isConnected || (statusDisplay !== 'RUNNING' && statusDisplay !== 'POST-RUN') || isJobRunning}
          >
            STOP
          </button>
        </div>
      </div>

      <div className="metrics-row">
        <div className="fume-card metric-card">
          <h3>HEPA FILTER LIFE</h3>
          <div className="metric-value-large">
            {healthPercentStr} <span className="metric-unit">%</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${healthPct}%`, backgroundColor: barColor }}></div>
          </div>
          <div className="metric-subtext">
            {(operatingHours ?? 0).toFixed(1)} / {serviceThresholdHours ?? 500} hours used
          </div>
          {unlocked && (
            <button className="btn-small reset-filter-btn" onClick={handleResetFilter}>Reset Filter</button>
          )}
        </div>

        <div className="fume-card metric-card">
          <h3>LIVE AIRFLOW</h3>
          <div className="metric-value-large">
            {liveAirflow?.toFixed(1) || '0.0'} <span className="metric-unit">LPM</span>
          </div>
          <div className="metric-subtext" style={{ color: liveAirflow < (minAirflowLpm ?? 15) && statusDisplay === 'RUNNING' ? 'var(--accent-red)' : 'inherit' }}>
            {liveAirflow < (minAirflowLpm ?? 15) ? 'Below minimum threshold' : 'Airflow optimal'}
          </div>
        </div>

        <div className="fume-card metric-card">
          <h3>VACUUM PUMP LOAD</h3>
          <div className="metric-value-large">
            {pumpLoad || 0} <span className="metric-unit">%</span>
          </div>
          <div className="metric-subtext">24V DC Extractor Motor</div>
        </div>
      </div>

      <div className="fume-header" style={{ marginTop: '20px' }}>
        <h2><span className="accent-bar"></span> SYSTEM CONFIGURATION</h2>
        <div className="unlock-toggle">
          <label className="toggle-label">
            <input 
              type="checkbox" 
              checked={unlocked} 
              onChange={e => {
                if (!isAdmin && e.target.checked) {
                  toast.error("Admin access required to unlock settings.");
                  return;
                }
                setUnlocked(e.target.checked);
              }} 
            />
            <span className="toggle-slider"></span>
          </label>
          <span style={{marginLeft: '10px', fontSize: '0.85rem'}}>UNLOCK SETTINGS</span>
        </div>
      </div>

      <div className="config-grid">
        <div className="config-item">
          <label>POST-RUN DURATION (SECONDS)</label>
          <input 
            type="number" 
            value={postRunDurationSec ?? 30} 
            disabled={!unlocked}
            onChange={e => handleConfigChange('postRunDurationSec', e.target.value)}
          />
        </div>
        <div className="config-item">
          <label>SERVICE THRESHOLD (HOURS)</label>
          <input 
            type="number" 
            value={serviceThresholdHours ?? 500} 
            disabled={!unlocked}
            onChange={e => handleConfigChange('serviceThresholdHours', e.target.value)}
          />
        </div>
        <div className="config-item">
          <label>MIN AIRFLOW ALERT (LPM)</label>
          <input 
            type="number" 
            value={minAirflowLpm ?? 15} 
            disabled={!unlocked}
            onChange={e => handleConfigChange('minAirflowLpm', e.target.value)}
          />
        </div>
      </div>

      <div className="fume-header" style={{ marginTop: '20px' }}>
        <h2><span className="accent-bar"></span> EXTRACTION EVENT LOG</h2>
        {unlocked && events.length > 0 && (
          <button className="btn-small clear-log-btn" onClick={handleClearLog}>Clear</button>
        )}
      </div>

      <div className="fume-card log-card">
        {events.length === 0 ? (
          <div className="no-events">No events logged yet.</div>
        ) : (
          <ul className="event-list">
            {events.map((ev, idx) => (
              <li key={idx} className={`event-item type-${ev.type}`}>
                <span className="event-time">{new Date(ev.timestamp).toLocaleString()}</span>
                <span className="event-msg">{ev.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}

