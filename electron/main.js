const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const isDev = !app.isPackaged;
const { SerialPort, ReadlineParser } = require('serialport');

let win;
let serial = { port: null, parser: null };
let intentionalClose = false;   // flag to distinguish programmatic close from cable pull
let lastConnectedPath = null;   // path of the most recently opened port
let lastConnectedBaud = 250000; // baud rate used when last opened
let portWatcherTimer = null;    // setInterval handle for reappearance polling
let keepAliveTimer = null;      // setInterval handle for USB keepalive pings

async function sendHaltCommands(port, forceEmergency = false) {
  if (!port || !port.isOpen) return;
  return new Promise((resolve) => {
    // \x18 (Grbl reset), ! (Grbl feedhold), M410 (Marlin quickstop)
    let payload = '\x18!\r\nM410\r\n';
    if (forceEmergency) {
      payload += 'M112\r\n'; // Marlin emergency stop (locks CPU, safe for app exit)
    }
    port.write(payload, () => {
      port.drain(() => {
        setTimeout(resolve, 50);
      });
    });
  });
}

function stopKeepAlive() {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
}

function startKeepAlive() {
  stopKeepAlive();
  keepAliveTimer = setInterval(() => {
    if (serial.port?.isOpen) {
      serial.port.write('\n', () => {}); // empty newline — Marlin ignores it, prevents Windows USB suspend
    } else {
      stopKeepAlive();
    }
  }, 30000); // every 30 s
}

function stopPortWatcher() {
  if (portWatcherTimer) { clearInterval(portWatcherTimer); portWatcherTimer = null; }
}

function startPortWatcher() {
  stopPortWatcher();
  portWatcherTimer = setInterval(async () => {
    if (!lastConnectedPath) { stopPortWatcher(); return; }
    try {
      const ports = await SerialPort.list();
      if (ports.some(p => p.path === lastConnectedPath)) {
        stopPortWatcher();
        if (win && !win.isDestroyed()) {
          win.webContents.send('serial:port-appeared', { path: lastConnectedPath, baudRate: lastConnectedBaud });
        }
      }
    } catch { /* ignore list errors during polling */ }
  }, 2000);
}

// -------- Python Vision Server --------
let visionProc = null;
let visionStopping = false;
let visionRestartCount = 0;
const VISION_MAX_RESTARTS = 3;
const VISION_MIN_UPTIME_MS = 5000; // treat exits within 5 s as crash (not normal shutdown)

function getVisionServerPath() {
  if (isDev) return path.join(__dirname, '..', 'python-vision', 'server.py');
  return path.join(process.resourcesPath, 'python-vision', 'server.py');
}

function startVisionServer() {
  if (visionStopping) return;
  const serverScript = getVisionServerPath();
  if (!fs.existsSync(serverScript)) {
    console.warn('[vision] server.py not found at', serverScript, '— skipping auto-start');
    return;
  }

  const pythonExe = process.platform === 'win32' ? 'python' : 'python3';
  console.log(`[vision] Spawning ${pythonExe} ${serverScript} (attempt ${visionRestartCount + 1})`);
  const startedAt = Date.now();

  visionProc = spawn(pythonExe, [serverScript], {
    cwd: path.dirname(serverScript),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  visionProc.stdout.on('data', d => process.stdout.write(`[vision] ${d}`));
  visionProc.stderr.on('data', d => process.stderr.write(`[vision] ${d}`));

  visionProc.on('error', err => {
    console.error('[vision] Failed to start:', err.message,
      err.code === 'ENOENT' ? '(Python not found in PATH — install Python and required packages)' : '');
    visionProc = null;
  });

  visionProc.on('exit', (code, signal) => {
    if (visionStopping) return;
    const uptime = Date.now() - startedAt;
    console.log(`[vision] Exited — code=${code} signal=${signal} uptime=${uptime}ms`);
    visionProc = null;

    const isCrash = uptime < VISION_MIN_UPTIME_MS;
    if (isCrash) {
      visionRestartCount++;
      if (visionRestartCount > VISION_MAX_RESTARTS) {
        console.error(`[vision] Crashed ${visionRestartCount} times — giving up. Fix Python dependencies and restart the app.`);
        return;
      }
    } else {
      visionRestartCount = 0; // reset counter after a healthy run
    }

    console.log('[vision] Restarting in 3 s…');
    setTimeout(startVisionServer, 3000);
  });
}

function stopVisionServer() {
  visionStopping = true;
  if (visionProc) {
    visionProc.kill();
    visionProc = null;
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Handle window close cleanly by stopping the machine immediately
  win.on('close', async (e) => {
    if (serial.port?.isOpen) {
      e.preventDefault(); // Stop window from closing immediately
      stopKeepAlive();
      stopPortWatcher();
      intentionalClose = true;
      try {
        await sendHaltCommands(serial.port, true);
        await new Promise(resolve => serial.port.close(resolve));
      } catch (err) {
        console.error('Error halting machine on close:', err);
      } finally {
        serial.port = null;
        serial.parser = null;
        win.destroy(); // Now close the window
      }
    }
  });

  // Handle page refresh/reload by halting the machine
  win.webContents.on('did-start-navigation', async (event, url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace && serial.port?.isOpen) {
      console.log('Page navigating/reloading. Halting machine...');
      stopKeepAlive();
      stopPortWatcher();
      try {
        await sendHaltCommands(serial.port, true);
        await new Promise(resolve => serial.port.close(resolve));
      } catch (err) {
        console.error('Error halting machine on reload:', err);
      } finally {
        serial.port = null;
        serial.parser = null;
      }
    }
  });
}

app.whenReady().then(() => {
  // In dev, `npm run dev` starts Python via concurrently — don't spawn a second instance.
  // In production (packaged), Electron is the sole entry point so we own the server lifecycle.
  if (!isDev) startVisionServer();
  createWindow();
});
app.on('will-quit', stopVisionServer);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// -------- Serial IPC --------
ipcMain.handle('serial:list', async () => {
  try {
    const ports = await SerialPort.list();
    const norm = ports
      .map(p => ({
        path: p.path,
        manufacturer: p.manufacturer || '',
        serialNumber: p.serialNumber || '',
        productId: p.productId || '',
        vendorId: p.vendorId || '',
        friendly: [p.path, p.manufacturer, p.serialNumber].filter(Boolean).join(' — '),
      }))
    // .filter(p => p.path); // only keep valid entries
    return norm;
  } catch (e) {
    console.error('serial:list failed', e);
    return [];
  }
});

ipcMain.handle('serial:open', async (e, { path: portPath, baudRate = 250000 }) => {
  if (!portPath || typeof portPath !== 'string') {
    throw new Error('No serial "path" provided. Pick a port before connecting.');
  }
  stopPortWatcher(); // stop watching — we're actively connecting now
  lastConnectedPath = portPath;
  lastConnectedBaud = baudRate;
  // close previous if open
  if (serial.port?.isOpen) {
    await new Promise(r => serial.port.close(() => r()));
  }
  await new Promise((resolve, reject) => {
    // HACK FOR ARDUINO MEGA CLONE BOOTLOADER BUG:
    // If the target is 250000, the STK500v2 bootloader (running at 115200) receives garbage
    // and freezes for 5-6 minutes. To fix this, we open at 115200 baud so the bootloader
    // cleanly times out and exits in ~2 seconds. Then we dynamically update the baud rate 
    // to 250000 without toggling DTR, so the board doesn't reset again!
    const isMegaBypass = Number(baudRate) === 250000;
    const initialBaud = isMegaBypass ? 115200 : Number(baudRate);

    const port = new SerialPort({ path: portPath, baudRate: initialBaud }, (err) => {
      if (err) return reject(err);

      const setupPort = () => {
        serial.port = port;
        serial.parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
        serial.parser.on('data', (line) => {
          if (win && !win.isDestroyed()) win.webContents.send('serial:data', line.toString());
        });
        // Native disconnect detection: fires immediately when USB cable is pulled
        port.on('close', () => {
          stopKeepAlive();
          if (!intentionalClose && serial.port) {
            serial.port = null;
            serial.parser = null;
            if (win && !win.isDestroyed()) win.webContents.send('serial:disconnected');
            startPortWatcher(); // begin polling for port to reappear
          }
        });
        startKeepAlive();
        resolve();
      };

      if (isMegaBypass) {
        // Wait 3.5 seconds for the bootloader to cleanly exit at 115200 baud
        setTimeout(() => {
          port.update({ baudRate: 250000 }, (updateErr) => {
            if (updateErr) return reject(updateErr);
            setupPort();
          });
        }, 3500);
      } else {
        setupPort();
      }
    });
  });
  return true;
});

ipcMain.handle('serial:close', async () => {
  if (!serial.port) return true;
  stopPortWatcher(); // operator disconnected intentionally — don't auto-reconnect
  stopKeepAlive();
  intentionalClose = true;

  try {
    await sendHaltCommands(serial.port, true);
  } catch (err) {
    console.error('Error sending halt commands on close:', err);
  }

  await new Promise((resolve) => {
    serial.port.close(() => {
      serial.port = null;
      serial.parser = null;
      intentionalClose = false;
      resolve();
    });
  });
  return true;
});

ipcMain.handle('serial:halt', async () => {
  if (serial.port?.isOpen) {
    await sendHaltCommands(serial.port, false);
  }
  return true;
});

ipcMain.handle('serial:writeLine', async (e, line) => {
  if (!serial.port) throw new Error('Not connected');
  const sanitized = String(line).trim();
  return new Promise((resolve, reject) => {
    const payload = sanitized + '\r\n';
    serial.port.write(payload, (err) => {
      if (err) reject(err); else resolve(true);
    });
  });
});

ipcMain.handle('serial:sendGcode', async (e, text) => {
  if (!serial.port) throw new Error('Not connected');
  const lines = String(text).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  for (const ln of lines) {
    const sanitized = ln.replace(/[^A-Za-z0-9\s\-\.]/g, '').substring(0, 200);
    if (sanitized && (sanitized.match(/^[GM]\d+/) || sanitized.startsWith(';'))) {
      await new Promise((resolve, reject) => {
        serial.port.write(sanitized + '\r\n', (err) => err ? reject(err) : resolve(true));
      });
      await new Promise(r => setTimeout(r, 2));
    }
  }
  return true;
});

ipcMain.handle('serial:writeMany', async (e, { lines = [], delayMs = 3 }) => {
  if (!serial.port) throw new Error('Not connected');
  for (const ln of lines) {
    await new Promise((resolve, reject) => {
      serial.port.write(String(ln).trim() + '\r\n', (err) => err ? reject(err) : resolve(true));
    });
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
  }
  return true;
});

// -------- Settings IPC --------
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

ipcMain.handle('fs:saveSettings', async (e, data) => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    console.error('fs:saveSettings failed', err);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:loadSettings', async () => {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return { ok: true, data: null };
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return { ok: true, data: JSON.parse(raw) };
  } catch (err) {
    console.error('fs:loadSettings failed', err);
    return { ok: false, data: null };
  }
});

// -------- Job Log IPC --------
ipcMain.handle('fs:saveJobLog', async (e, { filename, content }) => {
  try {
    const logsDir = path.join(app.getPath('documents'), 'SolderPasteJobLogs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const filePath = path.join(logsDir, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    return { ok: true, path: filePath };
  } catch (err) {
    console.error('fs:saveJobLog failed', err);
    return { ok: false, error: err.message };
  }
});