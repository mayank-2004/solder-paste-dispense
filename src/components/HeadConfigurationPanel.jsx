import React, { useState, useEffect } from 'react';
import './HeadConfigurationPanel.css';

export default function HeadConfigurationPanel({ payloadManager, isConnected, onWriteSerial }) {
  const {
    configuredPayload,
    warningThreshold,
    lastConfirmedPayload,
    lastSyncTime,
    maxCapacity,
    remainingMargin,
    marginPercent,
    status,
    applyPayload,
    applyThreshold,
    forceSync
  } = payloadManager;

  const [localPayload, setLocalPayload] = useState(configuredPayload.toString());
  const [localThreshold, setLocalThreshold] = useState(warningThreshold.toString());

  // Keep local inputs in sync with upstream changes (if any)
  useEffect(() => {
    setLocalPayload(configuredPayload.toString());
  }, [configuredPayload]);

  useEffect(() => {
    setLocalThreshold(warningThreshold.toString());
  }, [warningThreshold]);

  const handleApplyPayload = async () => {
    const success = await applyPayload(localPayload);
    if (!success) {
      setLocalPayload(configuredPayload.toString());
    }
  };

  const handleApplyThreshold = () => {
    const success = applyThreshold(localThreshold);
    if (!success) {
      setLocalThreshold(warningThreshold.toString());
    }
  };

  const fillPercentage = Math.min(100, (configuredPayload / maxCapacity) * 100);
  const thresholdPercentage = Math.min(100, (warningThreshold / maxCapacity) * 100);

  return (
    <div className="head-config-panel">
      <div className="hc-header">
        <h2 className="hc-header-title">HEAD CONFIGURATION</h2>
      </div>

      <div className="hc-body">
        
        <div className="hc-section">
          <h3 className="hc-section-title">HEAD CONFIGURATION & PAYLOAD</h3>

          <div className="hc-status-grid">
            <div className="hc-status-item">
              <span className="hc-status-label">Payload Status</span>
              <span className={`hc-pill ${status.toLowerCase()}`}>
                {status.replace('_', ' ')}
              </span>
            </div>
            
            <div className="hc-status-item">
              <span className="hc-status-label">Remaining Margin</span>
              <span className="hc-status-value">
                {remainingMargin.toFixed(2)} kg ({marginPercent.toFixed(0)}%)
              </span>
            </div>
            
            <div className="hc-status-item">
              <span className="hc-status-label">Max Capacity</span>
              <span className="hc-status-value">
                {maxCapacity.toFixed(2)} kg
              </span>
            </div>
          </div>

          <div className="hc-progress-container">
            <div className="hc-progress-bar-bg">
              <div 
                className={`hc-progress-bar-fill ${status.toLowerCase()}`}
                style={{ width: `${fillPercentage}%` }}
              />
              <div 
                className="hc-progress-tick"
                style={{ left: `${thresholdPercentage}%` }}
                title={`Warning Threshold: ${warningThreshold} kg`}
              />
            </div>
            <div className="hc-progress-labels">
              <span>0 kg</span>
              <span>{maxCapacity.toFixed(0)} kg</span>
            </div>
          </div>

          <h4 className="hc-subtitle">Configuration</h4>
          
          <div className="hc-input-row">
            <span className="hc-input-label">Configured Payload (kg)</span>
            <div className="hc-input-group">
              <input 
                type="number" 
                className="hc-input" 
                value={localPayload}
                onChange={e => setLocalPayload(e.target.value)}
                min="0"
                max={maxCapacity}
                step="0.1"
              />
              <button className="hc-btn hc-btn-primary" onClick={handleApplyPayload}>APPLY</button>
            </div>
          </div>

          <div className="hc-input-row" style={{ marginBottom: '8px' }}>
            <span className="hc-input-label">Warning Threshold (kg)</span>
            <div className="hc-input-group">
              <input 
                type="number" 
                className="hc-input" 
                value={localThreshold}
                onChange={e => setLocalThreshold(e.target.value)}
                min="0.1"
                max={maxCapacity}
                step="0.1"
              />
              <button className="hc-btn" onClick={handleApplyThreshold}>SET</button>
            </div>
          </div>
          <p className="hc-help-text">Trigger a warning when payload exceeds this value.</p>

          <h4 className="hc-subtitle" style={{ marginTop: '32px' }}>Embedded Synchronization</h4>
          <div className="hc-footer">
            <div style={{ display: 'flex', gap: '32px' }}>
              <span className="hc-footer-text">
                Last Confirmed: <span className="hc-footer-val">
                  {lastConfirmedPayload !== null ? `${lastConfirmedPayload.toFixed(2)} kg` : 'Unconfirmed'}
                </span>
              </span>
              <span className="hc-footer-text">
                Last Sync: <span className="hc-footer-val">
                  {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Never'}
                </span>
              </span>
            </div>
            <button 
              className="hc-btn" 
              onClick={() => forceSync(onWriteSerial)}
              disabled={!isConnected}
            >
              FORCE SYNC
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}

