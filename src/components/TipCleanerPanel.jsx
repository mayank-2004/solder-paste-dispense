import React, { useState } from 'react';
import { toast, showConfirm } from '../lib/toast.js';
import './TipCleanerPanel.css';

export default function TipCleanerPanel({
  tipCleaner,
  isConnected,
  isJobRunning,
  systemStatus, // 'IDLE', 'CLEANING', 'FAULT'
  onManualStart
}) {
  const [unlocked, setUnlocked] = useState(false);

  const {
    padsSinceLastClean,
    totalLifetimeCleans,
    lastCleanedAt,
    cleaningIntervalPads,
    events,
    progressPct,
    padsRemaining,
    updateConfig,
    clearEvents
  } = tipCleaner || {};

  const handleConfigChange = (field, value) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return;
    updateConfig?.({ [field]: num });
  };

  const handleClearLog = async () => {
    const confirmed = await showConfirm("Clear all event logs?");
    if (confirmed) {
      clearEvents?.();
    }
  };
  
  const handleStartClean = async () => {
      if(!isConnected) {
          toast.warning("Machine not connected.");
          return;
      }
      if(isJobRunning) {
          toast.warning("Cannot start tip cleaning while a job is running.");
          return;
      }
      
      const confirmed = await showConfirm("Start tip cleaning cycle?");
      if(confirmed && onManualStart) {
          onManualStart();
      }
  }

  const formatTime = (ts) => {
    if (!ts) return 'Never';
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };
  
  const formatEventTime = (ts) => {
      if(!ts) return '';
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour12: false });
  }

  const statusDisplay = systemStatus || 'IDLE';
  let badgeClass = 'status-badge ';
  if (statusDisplay === 'IDLE') badgeClass += 'badge-idle';
  else if (statusDisplay === 'CLEANING') badgeClass += 'badge-cleaning';
  else badgeClass += 'badge-fault';

  return (
    <div className="tip-panel">
      <div className="tip-header">
        <h2><span className="accent-bar"></span> AUTOMATIC TIP CLEANER</h2>
      </div>

      <div className="tip-card status-card">
        <div className="status-info">
          <h3>MECHANISM STATUS</h3>
          <span className={badgeClass}>
              {statusDisplay === 'IDLE' && <span style={{marginRight: '6px'}}>💤</span>}
              {statusDisplay === 'CLEANING' && <span style={{marginRight: '6px'}}>🔄</span>}
              {statusDisplay === 'FAULT' && <span style={{marginRight: '6px'}}>⚠️</span>}
              {statusDisplay}
          </span>
        </div>
        <div className="status-actions">
          <button 
            className="btn tip-btn" 
            onClick={handleStartClean}
            disabled={!isConnected || statusDisplay === 'CLEANING' || isJobRunning}
          >
            START CLEAN CYCLE
          </button>
        </div>
      </div>

      <div className="metrics-row">
        <div className="tip-card metric-card">
          <h3>INTERVAL PROGRESS</h3>
          <div className="metric-value-large" style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            {padsSinceLastClean} <span className="metric-unit">/ {cleaningIntervalPads} pads</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progressPct ?? 0}%`, backgroundColor: 'var(--accent-cyan)' }}></div>
          </div>
          <div className="metric-subtext">
            {padsRemaining} pads remaining
          </div>
        </div>

        <div className="tip-card metric-card">
          <h3>LIFETIME CLEANS</h3>
          <div className="metric-value-large">
            {totalLifetimeCleans}
          </div>
          <div className="metric-subtext">Total auto-cleaning cycles</div>
        </div>

        <div className="tip-card metric-card">
          <h3>LAST CLEANED AT</h3>
          <div className="metric-value-large" style={{ fontSize: lastCleanedAt ? '1.2rem' : '2rem' }}>
            {formatTime(lastCleanedAt)}
          </div>
          <div className="metric-subtext">Timestamp of last successful cycle</div>
        </div>
      </div>

      <div className="tip-header" style={{ marginTop: '20px' }}>
        <h2><span className="accent-bar"></span> CLEANING CONFIGURATION</h2>
        <div className="unlock-toggle">
          <label className="toggle-label">
            <input 
              type="checkbox" 
              checked={unlocked} 
              onChange={e => setUnlocked(e.target.checked)} 
            />
            <span className="toggle-slider"></span>
          </label>
          <span style={{marginLeft: '10px', fontSize: '0.85rem'}}>UNLOCK SETTINGS</span>
        </div>
      </div>

      <div className="config-grid">
        <div className="config-item">
          <label>CLEANING INTERVAL (PADS)</label>
          <input 
            type="number" 
            value={cleaningIntervalPads ?? 500} 
            disabled={!unlocked}
            onChange={e => handleConfigChange('cleaningIntervalPads', e.target.value)}
          />
        </div>
      </div>

      <div className="tip-header" style={{ marginTop: '20px' }}>
        <h2><span className="accent-bar"></span> TIP CLEANING EVENT LOG</h2>
        {unlocked && events?.length > 0 && (
          <button className="btn-small clear-log-btn" onClick={handleClearLog}>Clear</button>
        )}
      </div>

      <div className="tip-card log-card">
        {!events || events.length === 0 ? (
          <div className="no-events">No events logged yet.</div>
        ) : (
          <ul className="event-list">
            {events.map((ev, idx) => {
                let statusText = 'INFO';
                let statusColor = '#8b949e';
                
                if(ev.type === 'success') {
                    statusText = 'DONE';
                    statusColor = 'var(--accent-green)';
                } else if (ev.type === 'error') {
                    statusText = 'FAIL';
                    statusColor = 'var(--accent-red)';
                } else if (ev.type === 'warning') {
                    statusText = 'WARN';
                    statusColor = 'var(--accent-orange)';
                }
                
                return (
                  <li key={idx} className={`event-item type-${ev.type}`}>
                    <span className="event-time" style={{ width: '80px', display: 'inline-block'}}>{formatEventTime(ev.timestamp)}</span>
                    <span className="event-status" style={{ color: statusColor, width: '60px', display: 'inline-block', fontWeight: 'bold' }}>{statusText}</span>
                    <span className="event-msg">{ev.message}</span>
                  </li>
                );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

