import React, { useState, useEffect } from 'react';
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
  const [_, forceRender] = useState({});

  useEffect(() => {
    // Re-render when fluxManager state changes. This is a bit hacky, but works.
    const interval = setInterval(() => forceRender({}), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateSettings = (key, val) => {
    fluxManager.updateSettings({ [key]: val });
    forceRender({});
  };

  const handleDispense = async () => {
    if (!isConnected) {
      toast.warning("Machine not connected.");
      return;
    }
    const status = fluxManager.getStatus();
    if (status === 'EMPTY') {
      toast.error("Flux tank is empty! Please refill before dispensing.");
      return;
    }
    const confirmed = await showConfirm("Dispense flux manually?");
    if (confirmed) {
      onDispense();
      fluxManager.recordDispense();
      forceRender({});
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
      fluxManager.markCleaned();
      forceRender({});
      toast.success("Cleaning cycle completed.");
    }
  };

  const handleRefill = async () => {
    const confirmed = await showConfirm("Mark flux tank as refilled?");
    if (confirmed) {
      onRefill();
      fluxManager.markRefilled();
      forceRender({});
      toast.success("Flux tank refilled.");
    }
  };

  const status = fluxManager.getStatus();
  const percent = fluxManager.getLevelPercent();
  const currentWeight = fluxManager.currentWeight.toFixed(1);

  let statusText = 'NORMAL';
  let statusClass = 'normal';
  if (status === 'EMPTY') { statusText = 'EMPTY'; statusClass = 'error'; }
  else if (status === 'LOW') { statusText = 'LOW'; statusClass = 'warning'; }
  else if (status === 'CLEAN_REQ') { statusText = 'CLEAN REQ'; statusClass = 'warning'; }

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
            <div className="level-text">FLUX TANK LEVEL</div>
            <div className={`status-badge ${statusClass}`}>{statusText}</div>
            <div className="weight-text">{currentWeight} g</div>
          </div>
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${percent}%`, backgroundColor: status === 'EMPTY' ? '#f44336' : status === 'LOW' ? '#ff9800' : '#4caf50' }}></div>
            <div className="progress-text">{percent.toFixed(0)}% remaining</div>
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
          Last cleaned: {formatTime(fluxManager.lastCleanedTime)}<br/>
          Last dispensed: {formatTime(fluxManager.lastDispensedTime)}<br/>
          Total dispenses: {fluxManager.totalDispenses} | Cycles since last clean: {fluxManager.cyclesSinceLastClean}/{fluxManager.settings.cleanInterval}
        </div>
      </div>

      <div className="section">
        <h3>CONFIGURATION (LOAD CELL)</h3>
        <div className="config-grid">
          <div className="config-item">
            <label>EMPTY (TARE) WEIGHT (G)</label>
            <input 
              type="number" 
              value={fluxManager.settings.emptyWeight} 
              onChange={e => handleUpdateSettings('emptyWeight', Number(e.target.value))} 
            />
          </div>
          <div className="config-item">
            <label>FULL WEIGHT (G)</label>
            <input 
              type="number" 
              value={fluxManager.settings.fullWeight} 
              onChange={e => handleUpdateSettings('fullWeight', Number(e.target.value))} 
            />
          </div>
          <div className="config-item">
            <label>LOW LEVEL THRESHOLD (%)</label>
            <input 
              type="number" 
              value={fluxManager.settings.lowThresholdPercent} 
              onChange={e => handleUpdateSettings('lowThresholdPercent', Number(e.target.value))} 
            />
          </div>
          <div className="config-item">
            <label>CLEAN CYCLE INTERVAL (DISPENSES)</label>
            <input 
              type="number" 
              value={fluxManager.settings.cleanInterval} 
              onChange={e => handleUpdateSettings('cleanInterval', Number(e.target.value))} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
