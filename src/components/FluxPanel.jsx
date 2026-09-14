import React from 'react';
import './FluxPanel.css';
import { toast, showConfirm } from '../lib/toast.js';

export default function FluxPanel({
  fluxManager,
  isConnected,
  isJobRunning,
  onDispense,
  onClean,
  onRefill
}) {

  // Destructure flat state and actions from the hook
  const {
    currentWeight,
    totalDispenses,
    cyclesSinceLastClean,
    lastDispensedTime,
    lastCleanedTime,
    settings,
    levelPct,
    levelState,
    recordDispense,
    markCleaned,
    markRefilled,
    updateSettings,
  } = fluxManager || {};

  const handleUpdateSettings = (key, val) => {
    updateSettings?.({ [key]: val });
  };

  const handleDispense = async () => {
    if (!isConnected) {
      toast.warning("Machine not connected.");
      return;
    }
    if (levelState === 'EMPTY') {
      toast.error("Flux tank is empty! Please refill before dispensing.");
      return;
    }
    const confirmed = await showConfirm("Dispense flux manually?");
    if (confirmed) {
      onDispense();
      recordDispense?.();
    }
  };

  const handleClean = async () => {
    if (!isConnected) {
      toast.warning("Machine not connected.");
      return;
    }
    const confirmed = await showConfirm("Run cleaning cycle?");
    if (confirmed) {
      onClean();
      toast.success("Cleaning cycle started.");
    }
  };

  const handleRefill = async () => {
    const confirmed = await showConfirm("Mark flux tank as refilled?");
    if (confirmed) {
      onRefill();
      toast.success("Flux tank refilled.");
    }
  };

  let statusText = 'NORMAL';
  let statusClass = 'normal';
  if (levelState === 'EMPTY') { statusText = 'EMPTY'; statusClass = 'error'; }
  else if (levelState === 'LOW') { statusText = 'LOW'; statusClass = 'warning'; }
  else if (levelState === 'CLEAN_REQ') { statusText = 'CLEAN REQ'; statusClass = 'warning'; }

  const formatTime = (ts) => {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="flux-panel">
      <div className="section">
        <h3>FLUX SPRAYING SYSTEM</h3>
        <div className="flux-level-card">
          <div className="level-info">
            <div className="level-text">FLUX TANK LEVEL (LIQUID ONLY)</div>
            <div className={`status-badge ${statusClass}`}>{statusText}</div>
            <div className="weight-text">{Math.max(0, (currentWeight ?? 0) - (settings?.emptyWeight ?? 0)).toFixed(1)} g</div>
          </div>
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${levelPct ?? 0}%`, backgroundColor: levelState === 'EMPTY' ? '#f44336' : levelState === 'LOW' ? '#ff9800' : '#4caf50' }}></div>
            <div className="progress-text">{(levelPct ?? 0).toFixed(0)}% remaining</div>
          </div>
          <div className="activity-info">
            <div className="activity-text">ACTIVITY</div>
            <div className="activity-badge">
              {isJobRunning ? (
                <><span className="dot busy" style={{backgroundColor: '#ff9800'}}></span> Active</>
              ) : (
                <><span className="dot idle"></span> Idle</>
              )}
            </div>
          </div>
          <div className="warning-banner">
            ⚠️ No load cell feedback — software estimate
          </div>
        </div>
      </div>

      <div className="section">
        <h3>MANUAL CONTROLS</h3>
        <div className="control-buttons">
          <button className="btn primary dispense-btn" onClick={handleDispense}>
            💧 DISPENSE FLUX
          </button>
          <button className="btn clean-btn" onClick={handleClean}>
            🔄 RUN CLEAN CYCLE
          </button>
          <button className="btn refill-btn" onClick={handleRefill}>
            ✅ MARK AS REFILLED
          </button>
        </div>
        <div className="stats-text">
          Last cleaned: {formatTime(lastCleanedTime)}<br/>
          Last dispensed: {formatTime(lastDispensedTime)}<br/>
          Total dispenses: {totalDispenses} | Cycles since last clean: {cyclesSinceLastClean}/{settings?.cleanInterval ?? 0}
        </div>
      </div>

      <div className="section">
        <h3>CONFIGURATION (LOAD CELL)</h3>
        <div className="config-grid">
          <div className="config-item">
            <label>EMPTY (TARE) WEIGHT (G)</label>
            <input 
              type="number" 
              value={settings?.emptyWeight ?? ''} 
              onChange={e => handleUpdateSettings('emptyWeight', Number(e.target.value))} 
            />
          </div>
          <div className="config-item">
            <label>FULL CAPACITY WEIGHT (G)</label>
            <input 
              type="number" 
              value={settings?.fullWeight ?? ''} 
              onChange={e => handleUpdateSettings('fullWeight', Number(e.target.value))} 
            />
          </div>
          <div className="config-item">
            <label>LOW LEVEL THRESHOLD (%)</label>
            <input 
              type="number" 
              value={settings?.lowThresholdPercent ?? ''} 
              onChange={e => handleUpdateSettings('lowThresholdPercent', Number(e.target.value))} 
            />
          </div>
          <div className="config-item">
            <label>CLEAN CYCLE INTERVAL (DISPENSES)</label>
            <input 
              type="number" 
              value={settings?.cleanInterval ?? ''} 
              onChange={e => handleUpdateSettings('cleanInterval', Number(e.target.value))} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
