import React, { useState } from 'react';
import './MotionConfigPanel.css';
import { toast } from '../lib/toast.js';

const TABS = [
  { id: 'rapid', label: 'Rapid' },
  { id: 'soldering', label: 'Soldering' },
  { id: 'calibration', label: 'Calibration' },
  { id: 'homing', label: 'Homing' }
];

export default function MotionConfigPanel({ motionConfig, safetyManager, isConnected, onWriteSerial }) {
  const [selectedTab, setSelectedTab] = useState('rapid');
  
  const { 
    profiles, 
    activeProfileId, 
    commandedSpeed, 
    maxAllowedSpeed, 
    updateProfile, 
    activateProfile 
  } = motionConfig;

  const currentProfile = profiles[selectedTab];
  const systemState = safetyManager?.systemState || 'SAFE';

  const handleInputChange = (field, value) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;
    updateProfile(selectedTab, { [field]: numValue });
  };

  const handleActivate = () => {
    if (!isConnected) {
      toast.error('Connect to machine before activating motion profile.');
      return;
    }
    
    if (systemState === 'HALTED') {
      toast.error('Machine is halted. Cannot activate motion.');
      return;
    }

    activateProfile(selectedTab, systemState, onWriteSerial);
    toast.success(`${selectedTab.toUpperCase()} profile activated.`);
  };

  return (
    <div className="motion-config-panel">
      <div className="mc-header">
        <h2 className="mc-header-title">MOTION CONFIGURATION</h2>
      </div>

      <div className="mc-body">
        {systemState === 'WARNING' && (
          <div className="mc-safety-banner">
            ⚠️ Safety Warning Active: High-speed motion is restricted. Maximum speed capped.
          </div>
        )}
        
        {systemState === 'HALTED' && (
          <div className="mc-safety-banner halted">
            🛑 Safety Halt Active: Machine motion is completely disabled.
          </div>
        )}

        <div>
          <h3 className="mc-section-title">MOTION SETTINGS & CALIBRATION</h3>
          <div className="mc-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`mc-tab ${selectedTab === tab.id ? 'active' : ''}`}
                onClick={() => setSelectedTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mc-profile-form">
            <h4 className="mc-profile-title">{selectedTab} PROFILE</h4>

            <div className="mc-input-group">
              <div className="mc-input-row">
                <span className="mc-input-label">Speed (mm/s)</span>
                <input
                  type="number"
                  className="mc-input-field"
                  value={currentProfile.speed}
                  onChange={(e) => handleInputChange('speed', e.target.value)}
                  min="1"
                  max={maxAllowedSpeed}
                />
              </div>
              <div className="mc-input-subtext">Max: {maxAllowedSpeed} mm/s</div>
            </div>

            <div className="mc-input-group">
              <div className="mc-input-row">
                <span className="mc-input-label">Acceleration (mm/s²)</span>
                <input
                  type="number"
                  className="mc-input-field"
                  value={currentProfile.accel}
                  onChange={(e) => handleInputChange('accel', e.target.value)}
                  min="1"
                  max="5000"
                />
              </div>
            </div>

            <div className="mc-input-group">
              <div className="mc-input-row">
                <span className="mc-input-label">Deceleration (mm/s²)</span>
                <input
                  type="number"
                  className="mc-input-field"
                  value={currentProfile.decel}
                  onChange={(e) => handleInputChange('decel', e.target.value)}
                  min="1"
                  max="5000"
                />
              </div>
            </div>

            <button 
              className="mc-activate-btn" 
              onClick={handleActivate}
              disabled={systemState === 'HALTED'}
            >
              ACTIVATE {selectedTab} PROFILE
            </button>
          </div>
        </div>
      </div>

      <div className="mc-live-state">
        <h4 className="mc-live-state-title">Live Motion State</h4>
        
        <div className="mc-live-row">
          <span className="mc-live-label">ACTIVE PROFILE:</span>
          <span className="mc-pill">{activeProfileId}</span>
        </div>
        
        <div className="mc-live-row">
          <span className="mc-live-label">COMMANDED SPEED:</span>
          <span className="mc-live-value">{commandedSpeed.toFixed(1)} mm/s</span>
        </div>

        <div className="mc-live-row">
          <span className="mc-live-label">MAX ALLOWED:</span>
          <span className="mc-live-value">{maxAllowedSpeed} mm/s</span>
        </div>
      </div>
    </div>
  );
}

