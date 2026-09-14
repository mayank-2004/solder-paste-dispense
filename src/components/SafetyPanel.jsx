import React from 'react';
import './SafetyPanel.css';
import { toast } from '../lib/toast.js';

export default function SafetyPanel({ safetyManager, isConnected, onSimulateFault }) {
  const { 
    activeFaults, 
    faultHistory, 
    systemState, 
    hasCriticalFault, 
    clearFault, 
    clearAllFaults, 
    clearHistory 
  } = safetyManager;

  const handleTestEstop = () => {
    if (onSimulateFault) {
      onSimulateFault('E001');
    } else {
      safetyManager.triggerFault('E001', 'Operator manual E-Stop test');
    }
  };

  // Mock sensor states based on active faults
  const isLightCurtainFault = activeFaults.some(f => f.code === 'E003');
  const isEstopActive = activeFaults.some(f => f.code === 'E001');
  const isLimitFault = activeFaults.some(f => f.code === 'E004');
  const isSpoolLow = activeFaults.some(f => f.code === 'W001');

  return (
    <div className="safety-panel">
      <h2 className="panel-title">🛡️ SAFETY & DIAGNOSTICS</h2>

      {/* Main Status Banner */}
      <div className={`system-state-banner ${systemState.toLowerCase()}`}>
        <div>
          <h3>
            {systemState === 'SAFE' && '✅ SYSTEM SAFE'}
            {systemState === 'WARNING' && '⚠️ SYSTEM WARNING'}
            {systemState === 'HALTED' && '🛑 SYSTEM HALTED'}
          </h3>
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            {systemState === 'SAFE' 
              ? 'All interlocks closed, motion permitted.'
              : systemState === 'WARNING'
                ? 'Non-critical alerts present. Operation can continue.'
                : 'Critical failure detected. Motion and heating disabled.'}
          </span>
        </div>
        <button 
          className="btn-estop" 
          onClick={handleTestEstop}
          title="Simulate E-Stop"
        >
          STOP
        </button>
      </div>

      {/* Sensor Mimic Panel */}
      <div className="safety-section">
        <h4 className="safety-section-title">HARDWARE SENSORS</h4>
        <div className="sensor-grid">
          <div className="sensor-item">
            <div className={`sensor-indicator ${isLightCurtainFault ? 'fault' : ''}`} />
            <span className="sensor-label">Light Curtain</span>
          </div>
          <div className="sensor-item">
            <div className={`sensor-indicator ${isEstopActive ? 'fault' : ''}`} />
            <span className="sensor-label">E-Stop Button</span>
          </div>
          <div className="sensor-item">
            <div className={`sensor-indicator ${isLimitFault ? 'fault' : ''}`} />
            <span className="sensor-label">Axis Limits</span>
          </div>
          <div className="sensor-item">
            <div className={`sensor-indicator ${isSpoolLow ? 'warn' : ''}`} />
            <span className="sensor-label">Wire Spool</span>
          </div>
        </div>
      </div>

      {/* Active Faults */}
      <div className="safety-section">
        <h4 className="safety-section-title">
          ACTIVE FAULTS
          {activeFaults.length > 0 && (
            <button className="btn-clear" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={clearAllFaults}>
              CLEAR ALL
            </button>
          )}
        </h4>
        
        {activeFaults.length === 0 ? (
          <div style={{ color: '#8b949e', fontStyle: 'italic', fontSize: '0.9rem', padding: '12px' }}>
            No active faults.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeFaults.map(fault => (
              <div key={fault.id} className={`fault-card type-${fault.type}`}>
                <div className="fault-info">
                  <span className="fault-code">{fault.code} - {fault.type}</span>
                  <span className="fault-message">{fault.message}</span>
                  <span className="fault-time">{new Date(fault.timestamp).toLocaleTimeString()}</span>
                </div>
                <button className="btn-clear" onClick={() => clearFault(fault.id)}>
                  RECOVER
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fault History */}
      <div className="safety-section" style={{ flexGrow: 1 }}>
        <h4 className="safety-section-title">
          FAULT HISTORY
          {faultHistory.length > 0 && (
            <button className="btn-clear" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={clearHistory}>
              CLEAR LOG
            </button>
          )}
        </h4>
        {faultHistory.length === 0 ? (
          <div style={{ color: '#8b949e', fontStyle: 'italic', fontSize: '0.9rem', padding: '12px' }}>
            No historical faults logged.
          </div>
        ) : (
          <div style={{ overflowY: 'auto', maxHeight: '250px' }}>
            <table className="history-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Code</th>
                  <th>Message</th>
                  <th>Cleared</th>
                </tr>
              </thead>
              <tbody>
                {faultHistory.map(fault => (
                  <tr key={fault.id}>
                    <td>{new Date(fault.timestamp).toLocaleTimeString()}</td>
                    <td>{fault.code}</td>
                    <td>{fault.message}</td>
                    <td>{new Date(fault.clearedAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

