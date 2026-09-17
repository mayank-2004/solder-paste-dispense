import React, { useState } from 'react';
import './OperatorDashboard.css';

export default function OperatorDashboard({
  isSerialConnected,
  isJobRunning,
  systemState, // From safetyManager
  motionConfig,
  payloadManager,
  tipManager,
  fluxManager,
  fumeStatus,
  fumeAirflow,
  fumePumpLoad,
  tipCleanerStatus,
  tipCleaner,
  tipRotation,
  machinePos,
  safetyManager,
  jobStatistics,
  maintenanceManager
}) {
  const [view, setView] = useState('OVERVIEW'); // 'OVERVIEW', 'SUCCESS_FAILURE', 'ANALYTICS'

  // --- Real-time Derived State ---

  // 1. Fume Manager
  const fumeAirflowVal = fumeAirflow || 0;
  const fumeLoadVal = fumePumpLoad || 0;
  let fumeColor = '#00e676';
  let fumeStateText = fumeStatus || 'READY';
  if (fumeStatus === 'FAULT') fumeColor = '#f85149';
  else if (fumeStatus === 'POST-RUN') fumeColor = '#ffab00';

  // 2. Flux Manager
  const fluxGross = fluxManager?.state?.currentGrossWeight || 0;
  const fluxTare = fluxManager?.state?.settings?.tareWeight || 0;
  const fluxNet = Math.max(0, fluxGross - fluxTare);
  const fluxLevel = fluxManager?.levelPct != null ? Math.round(fluxManager.levelPct) : 100;
  let fluxColor = '#00e676';
  let fluxStateText = 'NORMAL';
  if (fluxLevel <= 5) { fluxColor = '#f85149'; fluxStateText = 'EMPTY'; }
  else if (fluxLevel <= 20) { fluxColor = '#ffab00'; fluxStateText = 'LOW'; }

  // 3. Payload Manager
  const payloadWeight = payloadManager?.lastConfirmedPayload || 0;
  const payloadSysState = payloadManager?.systemState || 'NORMAL';
  let payloadColor = payloadSysState === 'OVERLOAD' ? '#f85149' : '#00e676';

  // 4. Tip & Cleaner Manager
  const activeTip = tipManager?.tips?.find(t => t.id === tipManager?.activeTipId);
  const tipName = activeTip ? activeTip.name : "None";
  const tipStatus = tipManager?.status || 'UNKNOWN';
  const padsCleaned = tipCleaner?.padsSinceLastClean || 0;
  let tipColor = tipStatus === 'ERROR' ? '#f85149' : (tipStatus === 'VERIFIED' ? '#00e676' : '#ffab00');

  // 5. Machine Position
  const mX = machinePos?.x?.toFixed(3) || "0.000";
  const mY = machinePos?.y?.toFixed(3) || "0.000";
  const mZ = machinePos?.z?.toFixed(3) || "0.000";
  const isOnline = isSerialConnected;

  const activeAlarms = safetyManager?.activeFaults || [];

  // --- Restored Original Derived State ---
  const machineStateText = isSerialConnected ? "ONLINE" : "OFFLINE";
  const operationState = isJobRunning ? "RUNNING" : (systemState === 'SAFE' ? "STANDBY" : "IDLE");
  const motionState = motionConfig?.activeProfile?.name || "Rapid";
  const motionSpeed = motionConfig?.activeProfile?.maxVelocity || 150;
  const totalPads = jobStatistics?.totalPads || "-";
  
  // Format the time properly
  let cycleTimeDisplay = "-";
  if (jobStatistics) {
    if (jobStatistics.totalTimeSeconds) {
      cycleTimeDisplay = `${jobStatistics.totalTimeSeconds}s`;
    } else if (jobStatistics.estimatedTime) {
      cycleTimeDisplay = `${jobStatistics.estimatedTime}m`;
    }
  }

  // Analytics Derived
  const analytics = {
    totalComponents: totalPads,
    pathLength: jobStatistics?.totalDistance ? `${jobStatistics.totalDistance} mm` : "-",
    totalGlue: "-",
    avgCycleTime: cycleTimeDisplay
  };

  // --- Nozzle Health Derived State ---
  const maxPads = maintenanceManager?.settings?.maxDispensesBeforeCleaning || 100;
  const dispenses = maintenanceManager?.dispenseCount || 0;
  const wearScore = Math.round(Math.max(0, 1 - (dispenses / maxPads)) * 50);
  const qualityScore = 50; // Mocked until we have SPC jobs integrated
  const nozzleHealthTotal = Math.round(wearScore + qualityScore);

  const maxHours = maintenanceManager?.settings?.maxHoursBeforeCleaning || 4;
  const lastCleaningTime = maintenanceManager?.lastCleaningTime || Date.now();
  const hoursSinceClean = Math.max(0, (Date.now() - lastCleaningTime) / (1000 * 60 * 60)).toFixed(1);
  const hoursRemaining = Math.max(0, maxHours - hoursSinceClean).toFixed(1);

  const MetricCard = ({ title, value, unit, statusColor, statusText, subtext, topAccent, style }) => (
    <div className={`metric-card ${topAccent || ''}`} style={style}>
      <div className="metric-header">
        {title}
        <div style={{ display: 'flex', alignItems: 'center', color: statusColor }}>
          <div className="status-dot" style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}`, width: 6, height: 6 }}></div>
          <span style={{ fontSize: '9px', fontWeight: 700, marginLeft: '6px' }}>{statusText}</span>
        </div>
      </div>
      <div className="metric-value" style={{ color: statusColor === '#2979ff' || statusColor === '#ffab00' || statusColor === '#00e676' ? '#fff' : statusColor }}>
        {value} <span style={{ fontSize: '11px', color: '#7a849c', fontWeight: 'normal' }}>{unit}</span>
      </div>
      <div className="metric-subtext">{subtext}</div>
    </div>
  );

  const renderOverview = () => (
    <>
      <div className="header-top">
        <div>
          <div className="dashboard-breadcrumbs">CONTROL ROOM / OVERVIEW</div>
          <h1>System Metrics Dashboard</h1>
          <p className="subtitle">Real-time telemetry and status values synchronized directly with physical hardware.</p>
        </div>
        <div className="metric-card" style={{ width: '250px', flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '12px 16px', borderTop: 'none' }}>
          <div className="status-dot" style={{ backgroundColor: isSerialConnected ? '#00e676' : '#f85149', width: 12, height: 12 }}></div>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{isSerialConnected ? 'ONLINE' : 'OFFLINE'}</div>
            <div style={{ color: '#7a849c', fontSize: '11px' }}>{isSerialConnected ? 'Machine connected' : 'Controller disconnected'}</div>
          </div>
        </div>
      </div>

      <div className="dashboard-features-container">
        <div className="dashboard-grid">
          <MetricCard
            title="MACHINE STATE"
            value={machineStateText} unit=""
            statusColor={isSerialConnected ? '#00e676' : '#f85149'}
            statusText={isSerialConnected ? 'READY' : 'OFFLINE'}
            subtext={isSerialConnected ? 'Connected and ready' : 'Connect controller to continue'}
          />

          <MetricCard
            title="ACTIVE OPERATION"
            value={operationState} unit=""
            statusColor={operationState === 'RUNNING' ? '#00e676' : (operationState === 'STANDBY' ? '#2979ff' : '#ffab00')}
            statusText={operationState}
            subtext={systemState === 'HALTED' ? 'Safety interlock: motion limited' : 'idle'}
          />

          <MetricCard
            title="MOTION STATE"
            value={motionState} unit=""
            statusColor="#2979ff"
            statusText="READY"
            subtext={`Speed: ${motionSpeed} mm/s`}
            topAccent="border-top-blue"
          />

          <MetricCard
            title="FUME EXTRACTOR"
            value={fumeAirflowVal.toFixed(1)}
            unit="LPM"
            statusColor={fumeColor}
            statusText={fumeStateText}
            subtext={`Pump Load: ${fumeLoadVal.toFixed(1)}%`}
          />

          <MetricCard
            title="FLUX TANK"
            value={fluxNet.toFixed(2)}
            unit="g (Net)"
            statusColor={fluxColor}
            statusText={fluxStateText}
            subtext={`Level: ${fluxLevel}% | Gross: ${fluxGross.toFixed(2)}g`}
            topAccent="border-top-green"
          />

          <MetricCard
            title="HEAD PAYLOAD"
            value={payloadWeight.toFixed(2)}
            unit="kg"
            statusColor={payloadColor}
            statusText={payloadSysState}
            subtext={payloadSysState === 'OVERLOAD' ? 'Exceeds capacity limits' : 'Within capacity limits'}
            topAccent="border-top-green"
          />

          <MetricCard
            title="SOLDERING TIP"
            value={tipName}
            unit=""
            statusColor={tipColor}
            statusText={tipStatus}
            subtext={`Pads Since Clean: ${padsCleaned} | Auto-clean active`}
          />

          <MetricCard
            title="TIP CLEANER"
            value={tipCleanerStatus || "IDLE"} unit=""
            statusColor={tipCleanerStatus === 'RUNNING' ? '#00e676' : '#ffab00'}
            statusText={tipCleanerStatus || "IDLE"}
            subtext="500 pads until next clean"
          />

          <MetricCard
            title="TIP ROTATION"
            value={tipRotation?.status || "IDLE"} unit=""
            statusColor={tipRotation?.status === 'RUNNING' ? '#00e676' : '#ffab00'}
            statusText={tipRotation?.status || "IDLE"}
            subtext={tipRotation?.isHomed ? "Homed — Ready" : "Not homed — position unknown"}
            topAccent="border-top-orange"
          />

          <MetricCard
            title="CAMERA SYSTEM"
            value="STANDBY" unit=""
            statusColor="#2979ff"
            statusText="WAITING"
            subtext="Awaiting fiducial alignment"
            topAccent="border-top-blue"
          />

          <MetricCard 
            title="PRODUCTION COUNT"
            value={totalPads} unit=""
            statusColor={jobStatistics ? "#fff" : "#fff"}
            statusText="IDLE"
            subtext={jobStatistics ? "Pads in current recipe" : "Load a paste layer to calculate"}
          />

          <MetricCard
            title="CYCLE TIME"
            value={cycleTimeDisplay} unit=""
            statusColor={jobStatistics ? "#fff" : "#fff"}
            statusText="WAITING"
            subtext={jobStatistics ? "Waiting for job data" : "Waiting for job data"}
          />
        </div>
      </div>

      <div className="dashboard-features-container">
        <div className="telemetry-row">
          <div className="telemetry-col" style={{ flex: 1.5 }}>
            <MetricCard 
              title="LIVE POSITION"
              value={`X: ${mX}`}
              unit="mm"
              statusColor={isOnline ? '#00e676' : '#7a849c'}
              statusText={isOnline ? 'LIVE' : 'STANDBY'}
              subtext={`Y: ${mY} mm | Z: ${mZ} mm`}
              topAccent="border-top-blue"
              style={{ height: '110px' }}
            />
            <div className="metric-card" style={{ flexGrow: 1 }}>
              <div className="telemetry-card-header">
                <span>GLUE SUPPLY</span>
                <span style={{ color: '#00e676' }}>BACKGROUND TRACKING</span>
              </div>
              <div className={`metric-value ${fluxLevel > 20 ? 'val-green' : 'value-red'}`} style={{ color: fluxLevel > 20 ? '#00e676' : '#f85149' }}>
                {fluxNet.toFixed(1)} g
              </div>
              <div className="metric-subtext">{Math.max(0, (fluxGross - fluxNet).toFixed(1))} g used of {(fluxGross).toFixed(1)} g stock</div>
              <div className="glue-progress-bg">
                <div className="glue-progress-fill" style={{ width: `${fluxLevel}%`, backgroundColor: fluxLevel > 20 ? '#00e676' : '#f85149' }}></div>
              </div>
              <table className="supply-table">
                <tbody>
                  <tr>
                    <td>Used</td><td>{Math.max(0, (fluxGross - fluxNet)).toFixed(1)} g</td>
                    <td>Remaining</td><td>{fluxNet.toFixed(1)} g</td>
                  </tr>
                  <tr>
                    <td>Remaining %</td><td>{fluxLevel.toFixed(1)}%</td>
                    <td>Job pads</td><td>{jobStatistics?.totalComponents || 0}</td>
                  </tr>
                  <tr>
                    <td>Job volume</td><td>{jobStatistics?.totalGlue || '0.00'} g</td>
                    <td>After job</td><td>{Math.max(0, fluxNet - (jobStatistics?.totalGlue || 0)).toFixed(1)} g</td>
                  </tr>
                  <tr>
                    <td>After job %</td><td>{Math.max(0, ((fluxNet - (jobStatistics?.totalGlue || 0)) / (fluxGross || 1)) * 100).toFixed(1)}%</td>
                    <td>Total stock</td><td>{fluxGross.toFixed(1)} g</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="telemetry-col" style={{ flex: 1 }}>
            <div className="metric-card" style={{ height: '110px' }}>
              <div className="telemetry-card-header">
                <span>OPERATOR ATTENTION</span>
                <span style={{ color: '#5c677d', cursor: 'pointer' }}>CLEAR</span>
              </div>
              {activeAlarms.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#00e676', fontSize: '18px' }}>✓</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>No active alarms</span>
                </div>
              ) : (
                <div style={{ color: '#f85149', fontWeight: 600 }}>
                  {activeAlarms.map(a => <div key={a.id}>⚠️ {a.message}</div>)}
                </div>
              )}
            </div>

            <div className="metric-card" style={{ flexGrow: 1 }}>
              <div className="telemetry-card-header">
                <span>NOZZLE HEALTH</span>
                <span style={{ color: '#00e676' }}>BACKGROUND MONITOR</span>
              </div>
              <div className="health-gauge-container">
                <div className="health-circular-gauge" style={{ '--health': nozzleHealthTotal }}>
                  <div className="health-circular-inner">{nozzleHealthTotal}</div>
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: nozzleHealthTotal >= 50 ? '#00e676' : '#f85149' }}>
                    {nozzleHealthTotal >= 80 ? 'GOOD' : (nozzleHealthTotal >= 50 ? 'FAIR' : 'POOR')}
                  </div>
                  <div className="metric-subtext">{nozzleHealthTotal >= 50 ? 'Nozzle healthy' : 'Clean required'}</div>
                </div>
              </div>
              <div className="metric-subtext" style={{ marginBottom: 12 }}>Wear {wearScore}/50 · Quality {qualityScore}/50</div>
              <table className="supply-table">
                <tbody>
                  <tr>
                    <td>Dispenses</td><td>{dispenses}</td>
                    <td>Remaining pads</td><td>{Math.max(0, maxPads - dispenses)}</td>
                  </tr>
                  <tr>
                    <td>Hours since clean</td><td>{hoursSinceClean}h</td>
                    <td>Hours remaining</td><td>{hoursRemaining}h</td>
                  </tr>
                  <tr>
                    <td>Max pads</td><td>{maxPads}</td>
                    <td>Max hours</td><td>{maxHours}</td>
                  </tr>
                  <tr>
                    <td>SPC jobs</td><td>0</td>
                    <td>Last cleaned</td><td>{new Date(maintenanceManager?.lastCleaningTime || Date.now()).toLocaleDateString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <div className="telemetry-card-header" style={{ marginBottom: 16 }}>OPERATOR VIEWS</div>
          <div className="nav-buttons" style={{ marginTop: 0 }}>
            <div className="nav-btn" onClick={() => setView('SUCCESS_FAILURE')}>
              <div className="nav-btn-title">Success / Failure</div>
              <div className="nav-btn-sub">Cycle outcome and job diagnostics</div>
              <div className="nav-btn-status">STANDBY</div>
            </div>
            <div className="nav-btn" onClick={() => setView('ANALYTICS')}>
              <div className="nav-btn-title">Analytics</div>
              <div className="nav-btn-sub">Cycle timing and production metrics</div>
              <div className="nav-btn-status">WAITING</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderSuccessFailure = () => (
    <>
      <div className="dashboard-breadcrumbs">QUALITY GATE / CYCLE OUTCOME</div>
      <h1>Operation Result</h1>
      <p className="subtitle">Review the last dispensing operation and decide the next operator action.</p>

      <div className="dashboard-features-container">
        <div className="metric-card" style={{ padding: '24px', marginBottom: '16px', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid #5c677d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#5c677d' }}>
            -
          </div>
          <div>
            <div className="metric-header" style={{ marginBottom: 4 }}>OPERATION STATUS</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#5c677d', letterSpacing: '1px' }}>NO RESULT</div>
            <div className="metric-subtext" style={{ marginTop: 8 }}>Complete a dispensing cycle to generate an outcome.</div>
          </div>
        </div>

        <div className="telemetry-row" style={{ marginBottom: 0 }}>
          <div className="metric-card" style={{ flex: 2 }}>
            <div className="telemetry-card-header">
              <span>OPERATION DETAILS</span>
              <span style={{ color: '#00e676' }}>REAL CYCLE REPORT</span>
            </div>
            <table className="details-table">
              <tbody>
                <tr>
                  <td>Components dispensed</td><td>-</td>
                </tr>
                <tr>
                  <td>Total glue used</td><td>-</td>
                </tr>
                <tr>
                  <td>Cycle duration</td><td>-</td>
                </tr>
                <tr>
                  <td>Average dwell</td><td>-</td>
                </tr>
                <tr>
                  <td>Base pressure</td><td>-</td>
                </tr>
                <tr>
                  <td>Dot verification</td><td style={{ color: '#00e676' }}>Not enabled</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="metric-card" style={{ flex: 1, justifyContent: 'flex-start' }}>
            <div className="telemetry-card-header">
              <span>NEXT ACTION</span>
            </div>
            <div className="metric-subtext" style={{ marginBottom: 20 }}>
              Check machine readiness, load a job, and run the operation monitor.
            </div>
            <button className="btn-primary" style={{ marginBottom: 12 }}>
              ▶ OPEN OPERATION MONITOR
            </button>
            <button className="btn-secondary" onClick={() => setView('OVERVIEW')}>
              RETURN TO DASHBOARD
            </button>
          </div>
        </div>
      </div>
    </>
  );

  const renderAnalytics = () => (
    <>
      <div className="dashboard-breadcrumbs">REPORTING / PERFORMANCE</div>
      <h1>Production Analytics</h1>
      <p className="subtitle">Current recipe metrics and machine utilization indicators.</p>

      <div className="dashboard-features-container">
        <div className="dashboard-grid">
          <MetricCard 
            title="COMPONENTS" value={analytics.totalComponents} unit="" 
            statusColor="#2979ff" statusText="" subtext={jobStatistics ? "Current job sequence" : "No job loaded"} topAccent=""
          />
          <MetricCard
            title="PATH LENGTH" value={analytics.pathLength} unit=""
            statusColor="#2979ff" statusText="" subtext="Planned travel distance" topAccent=""
          />
          <MetricCard
            title="GLUE USED" value={analytics.totalGlue} unit=""
            statusColor="#2979ff" statusText="" subtext="Available after completion" topAccent=""
          />
          <MetricCard
            title="CYCLE TIME" value={analytics.avgCycleTime} unit=""
            statusColor="#2979ff" statusText="" subtext="Calculated estimate" topAccent=""
          />
        </div>

        <div className="telemetry-row" style={{ marginBottom: 0, marginTop: 16 }}>
          <div className="metric-card" style={{ flex: 2 }}>
            <div className="telemetry-card-header">
              <span>CYCLE TREND</span>
              <span style={{ color: '#00e676' }}>LAST 7 RUN WINDOWS</span>
            </div>
            <div className="analytics-bars">
              <div className="analytics-bar-column"><div className="analytics-bar" style={{ height: '40%' }}></div><div className="bar-label">R1</div></div>
              <div className="analytics-bar-column"><div className="analytics-bar" style={{ height: '60%' }}></div><div className="bar-label">R2</div></div>
              <div className="analytics-bar-column"><div className="analytics-bar" style={{ height: '45%' }}></div><div className="bar-label">R3</div></div>
              <div className="analytics-bar-column"><div className="analytics-bar" style={{ height: '80%' }}></div><div className="bar-label">R4</div></div>
              <div className="analytics-bar-column"><div className="analytics-bar" style={{ height: '55%' }}></div><div className="bar-label">R5</div></div>
              <div className="analytics-bar-column"><div className="analytics-bar" style={{ height: '70%' }}></div><div className="bar-label">R6</div></div>
              <div className="analytics-bar-column"><div className="analytics-bar" style={{ height: '30%' }}></div><div className="bar-label">R7</div></div>
            </div>
          </div>
          <div className="metric-card" style={{ flex: 1, justifyContent: 'flex-start' }}>
            <div className="telemetry-card-header">
              <span>JOB BREAKDOWN</span>
              <span style={{ color: '#00e676' }}>LIVE MODEL</span>
            </div>
            <table className="details-table" style={{ marginTop: '16px' }}>
              <tbody>
                <tr><td>Safe path moves</td><td>{totalPads}</td></tr>
                <tr><td>High-clearance moves</td><td>0</td></tr>
                <tr><td>Success rate</td><td style={{ color: jobStatistics ? '#00e676' : '#7a849c', fontWeight: 600 }}>{jobStatistics ? 'READY' : '-'}</td></tr>
                <tr><td>Downtime tracking</td><td style={{ color: '#00e676' }}>AVAILABLE</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="action-bar">
        <span className="metric-subtext" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          Load a Gerber paste layer and calculate a dispensing sequence to populate analytics.
        </span>
        <button className="btn-secondary" onClick={() => setView('OVERVIEW')}>RETURN TO DASHBOARD</button>
        <button className="btn-primary">OPEN OPERATION MONITOR</button>
      </div>
    </>
  );

  return (
    <div className="dashboard-container">
      {view === 'OVERVIEW' && renderOverview()}
      {view === 'SUCCESS_FAILURE' && renderSuccessFailure()}
      {view === 'ANALYTICS' && renderAnalytics()}
    </div>
  );
}
