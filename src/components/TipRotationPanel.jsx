import React, { useState } from 'react';
import { toast } from '../lib/toast.js';
import './TipRotationPanel.css';

export default function TipRotationPanel({
  rotationManager, // The useTipRotation() hook return object
  isConnected,
  isJobRunning,
  onManualHome,
  onManualRotate
}) {
  const [sliderValue, setSliderValue] = useState(0);

  const {
    isHomed,
    currentAngle,
    targetAngle,
    status
  } = rotationManager || {};

  const handleSliderChange = (e) => {
    setSliderValue(parseFloat(e.target.value));
  };

  const handleGoToAngle = () => {
    if (!isHomed) {
      toast.error('Cannot rotate tip: System is not homed.');
      return;
    }
    onManualRotate(sliderValue);
  };

  const handlePreset = (angle) => {
    if (!isHomed) {
      toast.error('Cannot rotate tip: System is not homed.');
      return;
    }
    setSliderValue(angle);
    onManualRotate(angle);
  };

  // Status badges mapping
  let statusBadgeClass = 'badge-idle';
  let statusText = 'IDLE';
  if (status === 'ROTATING') {
    statusBadgeClass = 'badge-rotating';
    statusText = 'ROTATING';
  } else if (status === 'FAULT') {
    statusBadgeClass = 'badge-fault';
    statusText = 'FAULT';
  }

  // Arc math: -45deg is 0, 135deg is 180. 180 degrees mapping.
  // wait, visually 0 is on the left (-90 deg from top), 180 is on the right (+90 deg).
  // CSS: transform: rotate(-45deg) means we can just map 0-180 to -45 to 135.
  // Actually, standard CSS for a half circle:
  // if base is -45deg, then rotation is angle - 45.
  const commandedTransform = `rotate(${(targetAngle || 0) - 45}deg)`;
  // Let's use a simpler needle transform for actual angle: -90deg is left, 90deg is right
  const actualTransform = `rotate(${(currentAngle || 0) - 90}deg)`;

  return (
    <div className="tip-rotation-panel">
      <div className="rotation-header">
        <h2><span className="accent-bar"></span> QUICK TIP ROTATION</h2>
      </div>

      <div className="rotation-card">
        <div className="status-row">
          <div className="status-badges">
            <div className="status-block">
              <span className="status-label">ROTATION STATUS</span>
              <span className={statusBadgeClass}>{statusText}</span>
            </div>
            <div className="status-block">
              <span className="status-label">HOME STATUS</span>
              <span className={`home-status ${isHomed ? 'homed' : 'not-homed'}`}>
                {isHomed ? '✓ Homed' : '⚠ Not Homed'}
              </span>
            </div>
          </div>
          <button 
            className="btn-home" 
            onClick={onManualHome}
            disabled={!isConnected || status === 'ROTATING' || isJobRunning}
          >
            HOME ROTATION
          </button>
        </div>

        {!isHomed && (
          <div className="alert-banner">
            <strong>⚠ Not Homed —</strong> Tip rotation position is unknown. Click <em>Home Rotation</em> to establish the 0° reference.
          </div>
        )}

        <div className="display-section">
          {/* Arc Display */}
          <div className="arc-display">
            <div className="arc-bg"></div>
            {isHomed && (
              <div className="arc-value" style={{ transform: commandedTransform, borderColor: '#2ea8ff' }}></div>
            )}
            {isHomed && currentAngle !== null && (
              <div className="arc-needle" style={{ transform: actualTransform, backgroundColor: '#3fb950' }}></div>
            )}
          </div>

          <div className="metrics-block">
            <div className="metric-item">
              <span className="metric-label">CURRENT ANGLE</span>
              <div className="metric-value">
                {isHomed && currentAngle !== null ? currentAngle.toFixed(1) : '--'}
                <span className="metric-unit">°</span>
              </div>
              <div className="metric-legend">
                <span className="legend-dot actual"></span> Actual (encoder feedback)
              </div>
            </div>

            <div className="metric-item" style={{ marginTop: '10px' }}>
              <span className="metric-label">TARGET ANGLE</span>
              <div className="metric-value commanded">
                {isHomed ? (targetAngle || 0).toFixed(1) : '--'}
                <span className="metric-unit">°</span>
              </div>
              <div className="metric-legend">
                <span className="legend-dot commanded"></span> Commanded
              </div>
            </div>
          </div>
        </div>

        <div className="manual-control-section">
          <div className="manual-header">
            <span className="accent-tick"></span>
            <h3>MANUAL ROTATION CONTROL</h3>
          </div>

          <div className="slider-container">
            <span className="slider-label">0°</span>
            <input 
              type="range" 
              className="angle-slider"
              min="0" 
              max="180" 
              step="1"
              value={sliderValue}
              onChange={handleSliderChange}
              disabled={!isHomed || !isConnected || isJobRunning}
            />
            <span className="slider-label">180°</span>
            <span className="slider-val-readout">{sliderValue.toFixed(1)}°</span>
          </div>

          <div className="presets-row">
            <button 
              className="btn-goto"
              onClick={handleGoToAngle}
              disabled={!isHomed || !isConnected || isJobRunning}
            >
              GO TO ANGLE
            </button>
            
            {[0, 30, 45, 90, 135, 180].map(angle => (
              <button
                key={angle}
                className="btn-preset"
                onClick={() => handlePreset(angle)}
                disabled={!isHomed || !isConnected || isJobRunning}
              >
                {angle}°
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

