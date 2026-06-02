import { useEffect, useRef, useState } from "react";
import { toast } from "../lib/toast.js";
import "./SerialPanel.css";

export default function SerialPanel({
  onMachinePositionUpdate = null,
  isConnected = false,
  onConnect,
  onDisconnect,
  onHomingComplete,
  machinePosition = { x: 0, y: 0, z: 0 }
}) {
  const [ports, setPorts] = useState([]);
  const [path, setPath] = useState('');
  const [baud, setBaud] = useState(115200);
  const [consoleLines, setConsoleLines] = useState([]);
  const [isHoming, setIsHoming] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const inputRef = useRef(null);
  const mPosRef = useRef(machinePosition);
  const hasReceivedPosRef = useRef(false);
  const hasConnectedOnceRef = useRef(false);

  // Auto-reconnect state
  const isIntentionalDisconnectRef = useRef(false); // true when operator clicks Disconnect
  const reconnectIntervalRef = useRef(null);
  const reconnectTargetRef = useRef('');  // port path to watch for
  const baudRef = useRef(baud);           // current baud, safe inside interval closure
  const pathRef = useRef(path);           // current path, safe inside event handler closure

  // Prop refs — stable handles for closures registered once
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onHomingCompleteRef = useRef(onHomingComplete);
  useEffect(() => { onConnectRef.current = onConnect; }, [onConnect]);
  useEffect(() => { onDisconnectRef.current = onDisconnect; }, [onDisconnect]);
  useEffect(() => { onHomingCompleteRef.current = onHomingComplete; }, [onHomingComplete]);

  useEffect(() => { mPosRef.current = machinePosition; }, [machinePosition]);
  useEffect(() => { baudRef.current = baud; }, [baud]);
  useEffect(() => { pathRef.current = path; }, [path]);

  // ── Serial port list ────────────────────────────────────────────────────────

  const refresh = async () => {
    try {
      const list = await window.serial.list();
      setPorts(list);
      setPath(prev => prev || (list[0]?.path ?? ''));
    } catch (e) {
      console.error('Failed to list serial ports', e);
      setPorts([]);
      setPath('');
    }
  };

  useEffect(() => { refresh(); }, []);

  // ── Incoming serial data handler ─────────────────────────────────────────────

  useEffect(() => {
    window.serial.onData((line) => {
      const ts = new Date().toISOString();
      const isStatusPos = line.match(/X\s*:\s*([-\d.]+)/i) || line.match(/MPos:([-\d.]+)/);
      if (!isStatusPos) {
        setConsoleLines((prev) => [...prev, `[RECE] - ${ts} - ${line}`].slice(-500));
      }

      let x = null, y = null, z = null;
      const marlinMatch = line.match(/X\s*:\s*([-\d.]+).*?Y\s*:\s*([-\d.]+).*?Z\s*:\s*([-\d.]+)/i);
      if (marlinMatch) {
        x = parseFloat(marlinMatch[1]);
        y = parseFloat(marlinMatch[2]);
        z = parseFloat(marlinMatch[3]);
      } else {
        const grblMatch = line.match(/MPos:([-\d.]+),([-\d.]+),([-\d.]+)/);
        if (grblMatch) {
          x = parseFloat(grblMatch[1]);
          y = parseFloat(grblMatch[2]);
          z = parseFloat(grblMatch[3]);
        }
      }

      if (x !== null && y !== null && z !== null) {
        hasReceivedPosRef.current = true;
        if (onMachinePositionUpdate) onMachinePositionUpdate({ x, y, z });
      }

      if (line.includes('z_min:')) {
        const triggered = /z_min:\s*TRIGGERED/i.test(line);
        window.dispatchEvent(new CustomEvent(
          triggered ? 'endstop-z-probe-triggered' : 'endstop-z-probe-open'
        ));
      }
    });
  }, []);

  // ── Auto-reconnect helpers ───────────────────────────────────────────────────

  const stopAutoReconnect = () => {
    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }
    setIsReconnecting(false);
  };

  const startAutoReconnect = (targetPath) => {
    if (!targetPath) return;
    stopAutoReconnect();
    reconnectTargetRef.current = targetPath;
    setIsReconnecting(true);

    reconnectIntervalRef.current = setInterval(async () => {
      if (isIntentionalDisconnectRef.current) {
        stopAutoReconnect();
        return;
      }
      try {
        const list = await window.serial.list();
        const found = list.some(p => p.path === reconnectTargetRef.current);
        if (found) {
          stopAutoReconnect();
          await connectTo(reconnectTargetRef.current, baudRef.current);
        }
      } catch { /* ignore — port not ready yet */ }
    }, 2000);
  };

  // Cleanup poller on unmount
  useEffect(() => () => stopAutoReconnect(), []);

  // ── Connection logic ─────────────────────────────────────────────────────────

  // Core connect — used by both the button and the auto-reconnect poller.
  const connectTo = async (targetPath, targetBaud) => {
    if (!targetPath) return toast.warning("Select a serial port first.");
    try {
      hasReceivedPosRef.current = false;
      setIsHoming(false);
      await window.serial.open({ path: targetPath, baudRate: targetBaud });
      if (onConnectRef.current) onConnectRef.current();

      const isReconnect = hasConnectedOnceRef.current;
      if (!isReconnect) {
        hasConnectedOnceRef.current = true;
        toast.success('Connection established successfully.');
      }

      startStatusQuery();

      if (isReconnect) {
        // Reconnect path — skip homing, resume directly
        window.dispatchEvent(new CustomEvent('serial:connected'));
      } else {
        // First connect — home so position is known
        setTimeout(async () => {
          try {
            setIsHoming(true);
            await window.serial.writeLine('G28');
            setTimeout(() => {
              setIsHoming(false);
              if (onHomingCompleteRef.current) onHomingCompleteRef.current();
              window.dispatchEvent(new CustomEvent('serial:homing-complete'));
            }, 5000);
          } catch (e) {
            console.error(e);
            setIsHoming(false);
          }
        }, 2000);
      }
    } catch (e) {
      toast.error(`Failed to open ${targetPath}: ${e.message}`);
      // If this was an auto-reconnect attempt and the port vanished again, keep polling
      if (!isIntentionalDisconnectRef.current) {
        startAutoReconnect(targetPath);
      }
    }
  };

  // Manual connect button handler
  const connect = async () => {
    isIntentionalDisconnectRef.current = false;
    stopAutoReconnect();
    await connectTo(path, baud);
  };

  // Manual disconnect button handler — must NOT trigger auto-reconnect
  const disconnect = async () => {
    isIntentionalDisconnectRef.current = true;
    stopAutoReconnect();
    try { await window.serial.close(); } catch { }
    setIsHoming(false);
    if (onDisconnectRef.current) onDisconnectRef.current();
  };

  // ── Cable-pull handler (dispatched by AutomatedDispensingPanel) ─────────────

  useEffect(() => {
    const onConnectionLost = async () => {
      if (isIntentionalDisconnectRef.current) return;
      const targetPath = pathRef.current;
      // Close port on Electron side so it can be re-opened cleanly
      try { await window.serial.close(); } catch { }
      if (onDisconnectRef.current) onDisconnectRef.current();
      startAutoReconnect(targetPath);
    };

    window.addEventListener('serial:connection-lost', onConnectionLost);
    return () => window.removeEventListener('serial:connection-lost', onConnectionLost);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── M114 status polling ──────────────────────────────────────────────────────

  const startStatusQuery = () => {
    let consecutiveFailures = 0;
    setInterval(async () => {
      if (window.pauseSerialPolling) return; // job is running — cable-pull detected by sendGcodeWait
      try {
        await window.serial.writeLine('M114');
        consecutiveFailures = 0;
      } catch {
        consecutiveFailures++;
        // 3 consecutive failures ≈ 1.5 s — port is gone
        if (
          consecutiveFailures >= 3 &&
          !isIntentionalDisconnectRef.current &&
          reconnectIntervalRef.current === null // not already reconnecting
        ) {
          consecutiveFailures = 0;
          window.dispatchEvent(new CustomEvent('serial:connection-lost'));
        }
      }
    }, 500);
  };

  // ── Manual G-code send ───────────────────────────────────────────────────────

  const sendCommand = async (cmd) => {
    if (!isConnected) return;
    const ts = new Date().toISOString();
    setConsoleLines((prev) => [...prev, `[SEND] - ${ts} - ${cmd}`].slice(-500));
    try {
      await window.serial.writeLine(cmd);
    } catch (e) {
      toast.error(`Send failed: ${e.message || e}`);
    }
  };

  const sendLine = async () => {
    const line = inputRef.current?.value.trim();
    if (!line) return;
    inputRef.current.value = '';
    await sendCommand(line);
  };

  const sendFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    try {
      await window.serial.sendGcode(text);
    } catch (err) {
      toast.error(`Send file failed: ${err.message || err}`);
    }
    e.target.value = '';
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="panel serial-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>
          Machine Connectivity
          {isConnected && (
            <span style={{ fontSize: '0.6em', background: '#28a745', color: 'white', padding: '2px 6px', borderRadius: 4, marginLeft: 8, verticalAlign: 'middle' }}>
              CONNECTED
            </span>
          )}
          {isReconnecting && !isConnected && (
            <span style={{ fontSize: '0.6em', background: '#e3b341', color: 'black', padding: '2px 6px', borderRadius: 4, marginLeft: 8, verticalAlign: 'middle', animation: 'pulse 1.5s infinite' }}>
              RECONNECTING…
            </span>
          )}
        </h3>

        {/* Machine Position Display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isConnected && (isHoming || !hasReceivedPosRef.current) && (
            <span style={{ fontSize: '0.7em', fontWeight: 'bold', background: '#ffaa00', color: 'black', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', animation: 'pulse 1.5s infinite' }}>
              Homing...
            </span>
          )}
          {isConnected && !isHoming && hasReceivedPosRef.current && (
            <span style={{ fontSize: '0.7em', fontWeight: 'bold', background: '#00c49a', color: 'black', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
              Position Known
            </span>
          )}
          <div style={{
            background: '#222', color: '#0f0', fontFamily: 'monospace',
            padding: '4px 8px', borderRadius: 4, fontSize: '0.9em',
            display: 'flex', gap: '12px',
          }}>
            <span>X: {machinePosition.x.toFixed(2)}</span>
            <span>Y: {machinePosition.y.toFixed(2)}</span>
            <span>Z: {machinePosition.z.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex-row" style={{ marginTop: 8, paddingBottom: 16, borderBottom: '1px solid #444', flexWrap: 'wrap', gap: '8px' }}>
        <button className="btn secondary" onClick={refresh} disabled={isReconnecting}>Refresh</button>

        <select value={baud} onChange={e => setBaud(Number(e.target.value))} style={{ width: 100 }} disabled={isConnected || isReconnecting}>
          <option value={115200}>115200</option>
          <option value={250000}>250000</option>
          <option value={57600}>57600</option>
          <option value={9600}>9600</option>
        </select>

        <select value={path} onChange={e => setPath(e.target.value)} style={{ minWidth: 220, flex: 1 }} disabled={isConnected || isReconnecting}>
          {ports.length === 0
            ? <option value="">(no serial ports found)</option>
            : ports.map(p => (
              <option key={p.path} value={p.path}>{p.friendly || p.path}</option>
            ))
          }
        </select>

        <button className="btn" onClick={connect} disabled={!path || isConnected || isReconnecting}>Connect</button>
        <button className="btn secondary" onClick={disconnect} disabled={!isConnected && !isReconnecting}>Disconnect</button>

        <label className="btn">
          Send file
          <input type="file" accept=".gcode,.nc,.txt" style={{ display: 'none' }} onChange={sendFile} disabled={!isConnected} />
        </label>
      </div>

      <div className="serial-layout">
        {/* Left Panel: Control Grid */}
        <div className="control-pane">
          <h3>Control</h3>
          <div className="control-grid-5" style={{ marginTop: 'auto' }}>
            <button className="btn-dark small" onClick={() => { sendCommand('G28 X'); window.dispatchEvent(new CustomEvent('machine:homed')); }}>Home<br />X</button>
            <button className="btn-dark small" onClick={() => { sendCommand('G28 Y'); window.dispatchEvent(new CustomEvent('machine:homed')); }}>Home<br />Y</button>
            <button className="btn-dark small" onClick={() => { sendCommand('G28 Z'); window.dispatchEvent(new CustomEvent('machine:homed')); }}>Home<br />Z</button>
          </div>
        </div>

        {/* Right Panel: Formatted Console */}
        <div className="console-pane">
          <div className="console-window">
            {consoleLines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
          <div className="console-input-row">
            <button className="btn-send" onClick={sendLine} disabled={!isConnected}>Send</button>
            <input
              ref={inputRef}
              placeholder="G-code command..."
              onKeyDown={(e) => e.key === 'Enter' && sendLine()}
              disabled={!isConnected}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
