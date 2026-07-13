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
  const [baud, setBaud] = useState(250000);
  const consoleEndRef = useRef(null);
  const [consoleLines, setConsoleLines] = useState([]);
  const [isHoming, setIsHoming] = useState(false);

  const inputRef = useRef(null);
  const mPosRef = useRef(machinePosition);
  const hasReceivedPosRef = useRef(false);
  const hasConnectedOnceRef = useRef(false);
  const marlinBootCbRef = useRef(null);
  const statusQueryIntervalRef = useRef(null); // M114 polling interval
  const bootToastIdRef = useRef(null);         // holds the waiting-for-boot toast ID
  const bootFallbackRef = useRef(null);        // setTimeout handle — cleared on disconnect
  const awaitingOkRef = useRef(null);          // one-shot callback fired on next Marlin 'ok'
  const lateHomingCbRef = useRef(null);        // recovery callback for late 'start' signals

  // Auto-reconnect state
  const isIntentionalDisconnectRef = useRef(false); // true when operator clicks Disconnect
  const connectRef = useRef(null);     // always-current ref to connect fn for auto-reconnect
  const isConnectedRef = useRef(isConnected);
  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);
  const baudRef = useRef(baud);
  const pathRef = useRef(path);

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

  // Native cable-pull detection — fires the moment SerialPort emits 'close' in main process
  useEffect(() => {
    if (!window.serial?.onDisconnect) return;
    const remove = window.serial.onDisconnect(() => {
      if (statusQueryIntervalRef.current) { clearInterval(statusQueryIntervalRef.current); statusQueryIntervalRef.current = null; }
      setIsHoming(false);
      hasReceivedPosRef.current = false;
      marlinBootCbRef.current = null;  // cancel any pending boot detection
      window.pauseSerialPolling = false;
      const handler = onDisconnectRef.current;
      if (handler) handler();
    });
    return remove;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-reconnect — when the port reappears after a cable pull, reconnect without operator click
  useEffect(() => {
    if (!window.serial?.onPortAppeared) return;
    const remove = window.serial.onPortAppeared(({ path: portPath, baudRate }) => {
      if (isConnectedRef.current) return; // already connected, ignore
      setPath(portPath);
      setBaud(baudRate);
      toast.info('Machine detected — reconnecting automatically…');
      setTimeout(() => { connectRef.current?.(); }, 1500);
    });
    return remove;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Incoming serial data handler ─────────────────────────────────────────────

  useEffect(() => {
    const removeDataListener = window.serial.onData((line) => {
      const ts = new Date().toLocaleTimeString();
      const trimmed = line.trim();

      // Show ALL lines in console — position lines shown dimmed so they don't dominate
      const isStatusPos = trimmed.match(/^X\s*:/i) || trimmed.match(/^MPos:/);
      setConsoleLines((prev) => [
        ...prev,
        { text: `[${ts}] ${trimmed}`, dim: !!isStatusPos }
      ].slice(-500));

      // Parse position
      let x = null, y = null, z = null;
      const marlinMatch = trimmed.match(/X\s*:\s*([-\d.]+).*?Y\s*:\s*([-\d.]+).*?Z\s*:\s*([-\d.]+)/i);
      if (marlinMatch) {
        x = parseFloat(marlinMatch[1]);
        y = parseFloat(marlinMatch[2]);
        z = parseFloat(marlinMatch[3]);
      } else {
        const grblMatch = trimmed.match(/MPos:([-\d.]+),([-\d.]+),([-\d.]+)/);
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

      if (trimmed.includes('z_min:')) {
        const triggered = /z_min:\s*TRIGGERED/i.test(trimmed);
        window.dispatchEvent(new CustomEvent(
          triggered ? 'endstop-z-probe-triggered' : 'endstop-z-probe-open'
        ));
      }

      // ── Boot detection — same pattern as glue dispensing app ───────────────
      if (marlinBootCbRef.current) {
        const isReady = /\bstart\b/i.test(trimmed)
          || /marlin/i.test(trimmed)
          || /^ok\b/i.test(trimmed);
        if (isReady) {
          const cb = marlinBootCbRef.current;
          marlinBootCbRef.current = null;
          cb();
        }
      } else if (/\bstart\b/i.test(trimmed) && lateHomingCbRef.current) {
        // Recovery path: 'start' arrived AFTER the 12s fallback fired (e.g. 6 min clone bootloader delay).
        // The earlier G28 was swallowed by the bootloader; re-home now that Marlin is alive.
        console.log('[Boot] Late "start" detected — re-triggering homing');
        const fn = lateHomingCbRef.current;
        lateHomingCbRef.current = null;
        fn(true); // isLateRecovery = true
      }

      // ── Homing ok-waiter (G28 / M400 completion) ────────────────────
      if (awaitingOkRef.current && /^ok\b/i.test(trimmed)) {
        const cb = awaitingOkRef.current;
        awaitingOkRef.current = null;
        cb();
      }
    });
    return removeDataListener;
  }, []);

  // Auto-scroll console
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLines]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (statusQueryIntervalRef.current) clearInterval(statusQueryIntervalRef.current);
  }, []);

  // ── Connection logic ─────────────────────────────────────────────────────────

  const connectTo = async (targetPath, targetBaud) => {
    if (!targetPath) return toast.warning("Select a serial port first.");
    try {
      hasReceivedPosRef.current = false;
      awaitingOkRef.current = null;
      setIsHoming(false);
      await window.serial.open({ path: targetPath, baudRate: targetBaud });
      if (onConnectRef.current) onConnectRef.current();

      const isReconnect = hasConnectedOnceRef.current;
      if (!isReconnect) hasConnectedOnceRef.current = true;
      // Inject a visible diagnostic marker into the console
      // (Removed hardcoded console line for Port Opened)

      // Show waiting toast
      if (bootToastIdRef.current) toast.dismiss(bootToastIdRef.current);
      bootToastIdRef.current = toast.info(
        <span>Waiting for board<span className="loading-dots"></span></span>,
        { sticky: true }
      );

      // ── Dynamic Boot Detection (identical pattern to glue dispensing app) ────────
      // Arduino resets on USB connect (DTR). Wait for Marlin's "start" / version / "ok".
      // Falls back to 12 s if no boot message received (same as glue app). 
      let bootHandled = false;

      const onMarlinReady = async (isLateRecovery = false) => {
        if (bootHandled && !isLateRecovery) return;
        bootHandled = true;
        clearTimeout(bootFallback);          // cancel the 12s fallback

        if (bootToastIdRef.current) {
          toast.dismiss(bootToastIdRef.current);
          bootToastIdRef.current = null;
        }

        console.log('[Boot] Marlin ready — starting homing sequence');
        // Start M114 polling first (same as glue app), then pause during G28
        startStatusQuery();
        await new Promise(r => setTimeout(r, 500));

        try {
          setIsHoming(true);
          // (Removed hardcoded console line for Sending G28 Auto-Home)
          window.pauseSerialPolling = true;
          await new Promise(r => setTimeout(r, 300));

          await window.serial.writeLine('G28');
          await window.serial.writeLine('M400');
          
          // ── Wait for G28 completion via awaitingOkRef (same as glue app) ──────
          const homingTimeout = setTimeout(() => {
            awaitingOkRef.current = null;
            window.pauseSerialPolling = false;
            setConsoleLines((prev) => [...prev, {
              text: `[${new Date().toLocaleTimeString()}] Homing timed out after 120s!`,
              dim: false, info: true
            }]);
            setIsHoming(false);
            if (onHomingCompleteRef.current) onHomingCompleteRef.current();
            window.dispatchEvent(new CustomEvent('serial:homing-complete'));
            window.dispatchEvent(new CustomEvent('machine:homed'));
          }, 120000);

          let okPhase = 0;
          const resolveHoming = () => {
            okPhase++;
            if (okPhase < 2) {
              awaitingOkRef.current = resolveHoming; // wait for second ok (M400)
            } else {
              clearTimeout(homingTimeout);
              window.pauseSerialPolling = false;
              setConsoleLines((prev) => [...prev, {
                text: `[${new Date().toLocaleTimeString()}] Homing Complete!`,
                dim: false, info: true
              }]);
              toast.success('Machine is ready!');
              setIsHoming(false);
              if (onHomingCompleteRef.current) onHomingCompleteRef.current();
              window.dispatchEvent(new CustomEvent('serial:homing-complete'));
              window.dispatchEvent(new CustomEvent('machine:homed'));
            }
          };
          awaitingOkRef.current = resolveHoming;
        } catch (e) {
          console.error('[Homing]', e);
          window.pauseSerialPolling = false;
          setIsHoming(false);
        }
      };

      marlinBootCbRef.current = onMarlinReady;
      lateHomingCbRef.current = onMarlinReady;

      // 12s fallback — same timeout as glue dispensing app
      // If no boot signal arrives in 12s, proceed anyway (board may already be running Marlin)
      
      const bootFallback = setTimeout(() => {
        bootFallbackRef.current = null;
        if (!bootHandled) {
          console.warn('[Boot] No Marlin boot signal in 12 s — using fallback timing');
          marlinBootCbRef.current = null;
          // Note: we do NOT clear lateHomingCbRef here! We leave it active so if "start" 
          // arrives 6 minutes later due to clone bootloader, it can re-trigger homing.
          onMarlinReady();
        }
      }, 12000);
      bootFallbackRef.current = bootFallback; // store handle so disconnect can cancel it
    } catch (e) {
      console.error('[Connect]', e); 
      toast.error(`Connect failed: ${e?.message || e}`);
    }
  };

  connectRef.current = connectTo; // always points to the latest connect closure

  // Manual connect button handler
  const connect = async () => {
    isIntentionalDisconnectRef.current = false;
    await connectTo(path, baud);
  };

  // Manual disconnect button handler
  const disconnect = async () => {
    isIntentionalDisconnectRef.current = true;
    stopStatusQuery();
    try { await window.serial.close(); } catch { }
    setIsHoming(false);
    marlinBootCbRef.current = null;
    awaitingOkRef.current = null;
    lateHomingCbRef.current = null;
    clearTimeout(bootFallbackRef.current);
    bootFallbackRef.current = null;
    if (bootToastIdRef.current) {
      toast.dismiss(bootToastIdRef.current);
      bootToastIdRef.current = null;
    }
    window.pauseSerialPolling = false;
    if (onDisconnectRef.current) onDisconnectRef.current();
  };


  // ── M114 status polling ──────────────────────────────────────────────────────

  const stopStatusQuery = () => {
    if (statusQueryIntervalRef.current) {
      clearInterval(statusQueryIntervalRef.current);
      statusQueryIntervalRef.current = null;
    }
  };

  const startStatusQuery = () => {
    stopStatusQuery();
    let consecutiveFailures = 0;
    statusQueryIntervalRef.current = setInterval(async () => {
      if (window.pauseSerialPolling) return;
      try {
        await window.serial.writeLine('M114');
        consecutiveFailures = 0;
      } catch {
        consecutiveFailures++;
        if (consecutiveFailures >= 3 && !isIntentionalDisconnectRef.current) {
          consecutiveFailures = 0;
          stopStatusQuery();
          // main.js will emit serial:disconnected — onDisconnect handler will clean up
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
        <button className="btn secondary" onClick={refresh} disabled={isConnected}>Refresh</button>

        <select value={baud} onChange={e => setBaud(Number(e.target.value))} style={{ width: 100 }} disabled={isConnected}>
          <option value={115200}>115200</option>
          <option value={250000}>250000</option>
          <option value={57600}>57600</option>
          <option value={9600}>9600</option>
        </select>

        <select value={path} onChange={e => setPath(e.target.value)} style={{ minWidth: 220, flex: 1 }} disabled={isConnected}>
          {ports.length === 0
            ? <option value="">(no serial ports found)</option>
            : ports.map(p => (
              <option key={p.path} value={p.path}>{p.friendly || p.path}</option>
            ))
          }
        </select>

        {isConnected
          ? <button className="btn secondary" onClick={disconnect}>Disconnect</button>
          : <button className="btn" onClick={connect} disabled={!path}>Connect</button>
        }

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
            {consoleLines.map((l, i) => {
              const entry = typeof l === 'object' ? l : { text: l, dim: false, info: false };
              return (
                <div key={i} style={{
                  color: entry.info ? '#00c49a' : entry.dim ? '#555' : '#ccc',
                  fontFamily: 'monospace',
                  fontSize: '0.82em',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {entry.text}
                </div>
              );
            })}
            <div ref={consoleEndRef} />
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
