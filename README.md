# SolderPaste Dispenser — Developer Documentation

> Electron + React HMI for automated 3-axis solder paste dispensing on PCBs.  
> Processes Gerber files, generates G-code, performs camera-based optical alignment, and drives a CNC motion controller over serial.

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Repository Layout](#2-repository-layout)
3. [Architecture Overview](#3-architecture-overview)
4. [State Management](#4-state-management)
5. [Module Reference](#5-module-reference)
   - [Gerber Processing](#51-gerber-processing)
   - [Coordinate Transforms](#52-coordinate-transforms)
   - [Motion & G-code](#53-motion--g-code)
   - [Dispensing Sequencer](#54-dispensing-sequencer)
   - [Vision System](#55-vision-system)
   - [Serial Communication](#56-serial-communication)
   - [Relay Control (983A)](#57-relay-control-983a)
6. [Component Reference](#6-component-reference)
7. [Fiducial Alignment Pipeline](#7-fiducial-alignment-pipeline)
8. [Dispensing Execution Flow](#8-dispensing-execution-flow)
9. [Camera & Vision Pipeline](#9-camera--vision-pipeline)
10. [Panel & PCB Transform Model](#10-panel--pcb-transform-model)
11. [Design System (CSS)](#11-design-system-css)
12. [Electron IPC Surface](#12-electron-ipc-surface)
13. [Python Vision Server](#13-python-vision-server)
14. [Configuration & Persistence](#14-configuration--persistence)
15. [Development Setup](#15-development-setup)
16. [Hardware Integration Notes](#16-hardware-integration-notes)

---

## 1. Technology Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 30 |
| UI framework | React 19 + Vite 5 |
| Serial | `serialport` (Node, via IPC) |
| Gerber parsing | `gerber-parser`, `pcb-stackup`, `whats-that-gerber` |
| ZIP handling | `JSZip` |
| Vision server | Python 3 + FastAPI + OpenCV (`python-vision/server.py`) |
| Camera feed | MJPEG stream from Python server → `<img>` tag |
| Relay board | LCUS-1 USB relay (LCUS protocol over `serialport`) |
| Fonts | Inter (UI) + JetBrains Mono (monospace/DRO) via Google Fonts |

---

## 2. Repository Layout

```
solder-paste-dispense/
├── electron/
│   ├── main.js          # Electron main process — window, IPC, serial, relay
│   └── preload.js       # contextBridge: window.serial, window.relay, window.fs
│
├── python-vision/
│   ├── server.py        # FastAPI server — camera stream, fiducial detection, calibration
│   └── camera_config.json  # Persisted camera index + resolution (auto-created)
│
├── src/
│   ├── main.jsx         # React entry point
│   ├── App.jsx          # Root component — all global state lives here
│   ├── App.css          # Layout (sidebar / header / main area)
│   ├── index.css        # Design system: tokens, buttons, tables, animations
│   │
│   ├── components/      # UI panels (one per workflow step)
│   │   ├── AppHeader.jsx
│   │   ├── AutomatedDispensingPanel.jsx
│   │   ├── BedCalibrationPanel.jsx
│   │   ├── CameraPanel.jsx
│   │   ├── ComponentList.jsx
│   │   ├── FiducialPanel.jsx
│   │   ├── JogPanel.jsx
│   │   ├── LayerList.jsx
│   │   ├── LensCalibration.jsx
│   │   ├── LivePreview.jsx
│   │   ├── MaintenanceManager.jsx
│   │   ├── PasteGauge.jsx
│   │   ├── SerialPanel.jsx
│   │   ├── ToolOffsetCalibration.jsx
│   │   └── ToastNotification.jsx
│   │
│   ├── hooks/
│   │   ├── useSerialMachine.js   # Serial state + machine position tracking
│   │   └── useGerberFiles.js     # Layer loading, SVG rebuild, pad extraction
│   │
│   └── lib/
│       ├── automation/
│       │   ├── dispensingSequence.js  # TSP path optimiser + G-code generator
│       │   └── safePathPlanner.js     # 3D collision-aware path planner
│       ├── gerber/
│       │   ├── extractPads.js         # Pad parser (flash D03, apertures)
│       │   ├── fiducialDetection.js   # Gerber-level fiducial scoring
│       │   ├── identifyLayers.js      # Layer type classifier
│       │   ├── boardOutline.js        # Board bounding box extractor
│       │   └── originDetection.js     # PCB origin heuristics
│       ├── motion/
│       │   ├── gcode.js               # G-code primitives (jogRel, moveAbs, …)
│       │   └── pathGeneration.js      # Direct / safe / zigzag path variants
│       ├── utils/
│       │   └── transform2d.js         # fitSimilarity, fitAffine, applyTransform, rmsError
│       ├── vision/
│       │   ├── fiducialVision.js      # In-browser blob detector (canvas API)
│       │   └── padDetection.js        # Vision-guided pad detector
│       ├── collision/
│       │   └── collisionDetection.js
│       ├── maintenance/
│       │   └── nozzleMaintenance.js
│       ├── quality/
│       │   └── qualityControl.js
│       ├── paste/
│       │   └── pasteVisualization.js
│       └── toast.js                   # Toast + confirm dialog helpers
│
└── package.json
```

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Electron Main                        │
│  window management · serial IPC · relay IPC · file dialog  │
└────────────┬──────────────────────────┬────────────────────┘
             │ contextBridge             │ contextBridge
     window.serial                  window.relay
             │                          │
┌────────────▼──────────────────────────▼────────────────────┐
│                         React App                          │
│                                                             │
│  App.jsx (global state)                                     │
│    ├─ useGerberFiles   ─── Gerber parse / SVG / pads       │
│    ├─ useSerialMachine ─── Serial connect / machinePos     │
│    │                                                        │
│    ├─ Viewer            ← SVG + overlay + click-to-select  │
│    ├─ FiducialPanel     ← fiducial capture + solve xf      │
│    ├─ CameraPanel       ← live feed + auto-search + snap   │
│    ├─ JogPanel          ← manual axis control              │
│    ├─ SerialPanel       ← G-code terminal                  │
│    ├─ AutomatedDispensingPanel ← job generation + run      │
│    └─ … (other panels)                                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP (localhost:8000)
                 ┌─────────────▼──────────────┐
                 │    Python Vision Server     │
                 │  FastAPI + OpenCV + camera  │
                 │  /stream  /api/detect       │
                 │  /api/camera/config         │
                 └─────────────────────────────┘
```

---

## 4. State Management

All global state lives in `App.jsx` (no external store). The major state groups are:

### Gerber / Layer state (`useGerberFiles`)
| State | Type | Description |
|---|---|---|
| `layers` | `Layer[]` | All loaded Gerber layers with visibility flags |
| `pads` | `Pad[]` | Extracted paste-layer pads (x, y, w, h, shape) |
| `svg` | `string` | Rendered SVG string for the viewer |
| `side` | `'top'|'bottom'` | Active board side |
| `boardOutline` | `{width, height}` | Detected PCB bounding box |

### Fiducial / Transform state
| State | Type | Description |
|---|---|---|
| `panelBoards` | `Board[]` | Array of boards; each has `.fiducials[]` and `.xf` |
| `activeBoardIndexState` | `number` | Which board is currently being aligned |
| `panelRailFiducials` | `RailFid[]` | Panel-level rail fiducials (design + machine) |
| `panelXf` | `Transform\|null` | Panel-level solved transform |
| `applyXf` | `boolean` | Whether to apply board transform to outputs |

The **active board's** `xf` and `fiducials` are derived via:
```js
const xf        = panelBoards[activeBoardIndexState]?.xf || null;
const fiducials = panelBoards[activeBoardIndexState]?.fiducials || [];
```

### Motion state (`useSerialMachine`)
| State | Description |
|---|---|
| `isSerialConnected` | Port open flag |
| `machinePos` | `{x, y, z}` — updated by parsing `<MPos:…>` responses |
| `isEmergencyStopped` | E-stop flag |

---

## 5. Module Reference

### 5.1 Gerber Processing

#### `lib/gerber/extractPads.js` — `extractPadsMm(layerData)`
Parses raw Gerber tokens to extract pads:
- Handles flash operations (`D03`) and aperture definitions (`ADD`)
- Supports `C` (circle), `R` (rectangle), `O` (obround) aperture types
- Converts inch coordinates to mm
- Returns `Pad[]` with `{ x, y, width, height, shape, componentIdentifier }`

#### `lib/gerber/fiducialDetection.js` — `analyzeFiducialsInLayers(layers)` / `analyzeFiducialsWithRails(layers)`
Scores aperture candidates across all Gerber layers using:
- Size filter: 0.5–5 mm diameter range
- Circularity preference (circle apertures score higher)
- Spatial distribution analysis (fiducials should be spread across the board)
- Layer priority weighting (copper > soldermask > drill)

`analyzeFiducialsWithRails` additionally identifies rail fiducials — markers outside the board outline used for panel alignment.

#### `lib/gerber/identifyLayers.js`
Rule-based layer classifier using filename patterns:
- `GTL/GBL` → copper top/bottom
- `GTS/GBS` → soldermask
- `GTP/GBP` → paste (source of pads)
- `GKO/GM1` → board outline
- `DRL/XLN` → drill

---

### 5.2 Coordinate Transforms

**`lib/utils/transform2d.js`**

All transforms are plain objects: `{ type, tx, ty, scale?, theta?, a?, b?, c?, d? }`.

| Function | Points needed | Output |
|---|---|---|
| `fitTranslation(design[], machine[])` | 1+ | Pure translation |
| `fitSimilarity(design[], machine[])` | 2+ | Translation + rotation + uniform scale |
| `fitAffine(design[], machine[])` | 3+ | Full 6-DOF affine |
| `fitHomography(design[], machine[])` | 4+ | Perspective homography |
| `applyTransform(xf, point)` | — | Maps one design point → machine |
| `rmsError(xf, design[], machine[])` | — | RMS residual in mm |

**Transform selection logic** (auto-solve `useEffect` in `App.jsx`):
```
n >= 4  → fitHomography
n >= 3  → fitAffine
n >= 2  → fitSimilarity   (default for most workflows)
```

Auto-solve fires when **every** fiducial that has a design coordinate also has a machine coordinate captured. It also sets `applyXf = true` automatically.

---

### 5.3 Motion & G-code

**`lib/motion/gcode.js`**

| Export | Signature | Returns |
|---|---|---|
| `jogRel` | `(axis, dist, feed)` | `string[]` — relative jog G-code |
| `moveAbs` | `({x, y, z?, feed})` | `string[]` — absolute move G-code |
| `home` | `()` | `string[]` — `G28` sequence |

All motion commands are arrays of G-code strings sent line-by-line via `window.serial.writeLine(cmd)`.

---

### 5.4 Dispensing Sequencer

**`lib/automation/dispensingSequence.js` — `DispensingSequencer`**

#### `calculateOptimalSequence(referencePoint, pads, config)`
1. Optionally expands pads into sub-dots via `generateSubDots()` (multi-dot mode)
2. Runs **Nearest Neighbor** greedy TSP to build initial order
3. Runs **2-opt** improvement until no swap reduces total distance
4. Recalculates `distanceFromPrevious` and `sequenceOrder` on final order

Set `config.enableMultiDot = false` when reordering only (e.g., the Optimize button) to avoid expanding pads into sub-dots.

#### `generateDispensingGCode(referencePoint, pads, settings)`
Produces a complete G-code file:
```
G21  ; mm
G90  ; absolute
G28  ; home
G1 Z<safeHeight>

; for each pad:
G1 X<px> Y<py> Z<safeHeight>   ; travel
G1 Z<dispenseHeight>             ; lower
<valveOnCmd>                     ; valve open
G4 P<dwellMs>                    ; dwell
<valveOffCmd>                    ; valve close
G1 Z<safeHeight>                 ; retract

G1 X0 Y0   ; return home
M84        ; disable steppers
```

Tool offset (`toolOffset.dx`, `.dy`) is subtracted from every coordinate so the **nozzle** (not camera) lands on the target.

#### `calculateDwellTime(pad, pressureSettings)`
Scales linearly with pad surface area:
```
dwell = baseDwell × (padArea / 1.0 mm²)
clamped to [20ms, baseDwell × 5]
```

#### `calculatePadArea(pad)`
Exact area by shape:
- `circle` → `π r²`
- `rect / square` → `w × h`
- `obround` → rectangle + semicircles

---

### 5.5 Vision System

Two parallel vision pipelines exist:

#### A. Python server pipeline (`python-vision/server.py`)
- **`GET /stream`** — MJPEG stream from OpenCV `VideoCapture`
- **`POST /api/detect`** — Returns detected fiducial positions in frame pixels
- **`GET /api/px_per_mm`** / **`POST /api/px_per_mm`** — Camera scale calibration
- **`GET /api/camera/config`** / **`POST /api/camera/config`** — Set camera index and resolution (persisted to `camera_config.json`, restarts camera thread)

Camera thread uses `threading.Event` (`camera_stop_event`) for clean restart on config change.

#### B. In-browser pipeline (`lib/vision/fiducialVision.js` — `FiducialVisionDetector`)
Pure JavaScript, runs on a `<canvas>` element — no backend dependency.

Pipeline stages:
1. **Grayscale** — RGBA → luminance array
2. **Binarisation** — rule-based threshold (rejects green soldermask saturation, keeps bright HASL)
3. **Connected Component Analysis (CCA)** — flood-fill blob labelling
4. **Feature extraction** — bounding box, radius, circularity `(4π·area / perimeter²)`, inertia ratio
5. **Multi-stage filtering** — aspect ratio guard, "dark ring" isolation check (background around candidate must be darker)
6. **Crosshair centering** — picks blob closest to frame center, emits `G91 G0 X<dx> Y<dy>` jog command

---

### 5.6 Serial Communication

`electron/main.js` owns the `SerialPort` instance. The renderer accesses it via `window.serial` (contextBridge):

```js
window.serial.listPorts()                     // → [{path, manufacturer}]
window.serial.connect(path, baudRate)         // opens port
window.serial.disconnect()
window.serial.writeLine(cmd)                  // sends cmd + '\n'
window.serial.onData(callback)                // streaming response handler
window.serial.isConnected()                   // boolean
```

Machine position is parsed from Grbl/Marlin status reports (`<MPos:x,y,z>` pattern) inside `useSerialMachine`.

---

### 5.7 Relay Control (983A)

`electron/main.js` maintains a separate `SerialPort` for the **LCUS-1 USB relay board**.

Protocol — 4-byte frames at 9600 baud:
```
ON  → [0xA0, 0x01, 0x01, 0xA2]
OFF → [0xA0, 0x01, 0x00, 0xA1]
```

Renderer access via `window.relay`:
```js
window.relay.connect(portPath)    // open relay port
window.relay.disconnect()
window.relay.isConnected()        // boolean
window.relay.on()                 // fire relay ON
window.relay.off()                // fire relay OFF
window.relay.trigger(durationMs)  // ON → wait → OFF (non-blocking)
```

During automated dispensing, `relay.trigger(dwellMs)` fires **concurrently** with the machine's `G4 P<dwellMs>` dwell — it does not block the G-code stream.

---

## 6. Component Reference

| Component | Panel / Step | Key responsibilities |
|---|---|---|
| `AppHeader` | Always visible | DRO (X/Y/Z readout), connection pill, E-stop button |
| `SerialPanel` | Step 1 | Port select, connect/disconnect, G-code terminal, baud rate |
| `LayerList` | Step 2 | Toggle layer visibility, layer type tags |
| `FiducialPanel` | Step 3 | Manual fiducial placement, machine coord input, Solve buttons, rail fiducial table |
| `CameraPanel` | Step 3 | Live feed (Python MJPEG or browser webcam), auto-search, snap fiducial, camera config |
| `JogPanel` | Step 3–4 | D-pad XY jog, Z column, step size, feed rate, safe-Z |
| `AutomatedDispensingPanel` | Step 5 | Pad selection, sequence optimization, G-code preview, job execution, relay integration |
| `ComponentList` | Sidebar | Pad list sorted by distance, click-to-focus |
| `BedCalibrationPanel` | Settings | Bed levelling mesh, Z-offset per point |
| `ToolOffsetCalibration` | Settings | Camera-to-nozzle offset (dx, dy) calibration wizard |
| `MaintenanceManager` | Settings | Nozzle wear score, cleaning counter, quality score |
| `LensCalibration` | Camera | Lens distortion capture + compute via Python server |
| `LivePreview` | Viewer overlay | Real-time pad completion overlay during job |
| `ToastNotification` | Global | Toast + confirm dialog portal |

---

## 7. Fiducial Alignment Pipeline

```
Gerber loaded
     │
     ▼
analyzeFiducialsWithRails()   ← scores all aperture candidates
     │
     ├── panelRailFiducials[]   (R1, R2, …)   for panel alignment
     └── board.fiducials[]      (F1, F2, …)   for per-board alignment

Operator workflow:
  1. Arm fiducial (dropdown in FiducialPanel)
  2. CameraPanel auto-moves machine to predicted location:
       predictFidMachinePos(fid, solveRef, transform, originFallback)
         priority: xf → translation from solved peer → panelXf fallback → null
  3. Camera detects fiducial via vision pipeline → auto-jog to center
  4. Operator clicks Snap → machine position stored as fid.machine
  5. Repeat for all fiducials

Auto-solve triggers when all fids in list have machine coords:
  panelXf  ← fitSimilarity(railFids)    (panel-level)
  board.xf ← fitSimilarity(boardFids)   (board-level)
  applyXf  ← true  (checkbox auto-checked)
```

**Transform priority chain for auto-move** (`CameraPanel.jsx` useEffect):

| Priority | Condition | Result |
|---|---|---|
| 1 | `xf` is solved | `applyTransform(xf, fid.design)` |
| 2 | Peer fiducial has `.machine` | Translation-only estimate from solved peer |
| 3 (board only) | `panelXf` is solved | `applyTransform(panelXf, fid.design)` |
| 4 | None | `null` → "No transform — jog manually" |

> `effectiveOrigin` is suppressed for board fiducials when `panelXf` is available, preventing a non-null but wrong fallback from blocking priority 3.

---

## 8. Dispensing Execution Flow

```
AutomatedDispensingPanel — "Start Job"
         │
         ▼
generateDispensingGCode(refPoint, orderedPads, settings)
         │
         ▼
Split G-code into individual lines (cmds[])
         │
         ▼
For each cmd:
  ┌──────────────────────────────────────┐
  │  Is cmd a G4 dwell?                  │
  │  yes → window.relay.trigger(dwellMs) │  ← non-blocking, fires 983A
  │         concurrently                 │
  └──────────────────────────────────────┘
         │
         ▼
  sendGcodeWait(cmd, timeout)
    → window.serial.writeLine(cmd)
    → waits for 'ok' response (or timeout)
         │
         ▼
  LivePreview overlay updates (pad marked done)
         │
         ▼
Next cmd …
         │
         ▼
Job complete → toast + stats display
```

---

## 9. Camera & Vision Pipeline

### Python server mode
```
Browser                  Python Server (port 8000)
  │                            │
  ├─ <img src="/stream"> ──────► MJPEG frames (OpenCV VideoCapture)
  │                            │
  ├─ POST /api/detect ─────────► circle detection (HoughCircles)
  │  ◄── [{x,y,r,conf}] ───────┤
  │                            │
  ├─ POST /api/camera/config ──► update index/resolution
  │                            │  camera_stop_event.set()
  │                            │  thread.join() → clear → new thread
  └────────────────────────────┘
```

### Browser mode (in-process)
```
<video> (getUserMedia)
    │
    ▼ requestAnimationFrame
<canvas> drawImage(video)
    │
    ▼ getImageData
FiducialVisionDetector.detect(imageData)
    │
    ▼
[{x, y, radius, circularity, confidence}]
    │
    ▼
CameraPanel renders overlay circles
    │
    ▼
Best candidate (closest to crosshair) → G91 jog command
```

---

## 10. Panel & PCB Transform Model

The app supports **panelised** PCB production where multiple identical boards are arrayed on a larger panel with rail fiducials.

```
Panel design space (mm, from Gerber origin)
┌─────────────────────────────────┐
│ R1 ●                      ● R2  │  ← Rail fiducials (panel-level)
│                                 │
│   ┌──────────┐  ┌──────────┐   │
│   │  Board 1 │  │  Board 2 │   │  ← Each board has own xf + fiducials
│   │  ● F1    │  │  ● F1    │   │
│   │  ● F2    │  │  ● F2    │   │
│   └──────────┘  └──────────┘   │
└─────────────────────────────────┘
```

**`panelXf`** — maps panel design space → machine space. Solved from R1+R2.  
**`board.xf`** — maps board design space → machine space. Solved from F1+F2 per board.  

Since boards are designed inside the panel design space, `applyTransform(panelXf, boardFid.design)` gives a valid machine estimate for any board fiducial even before `board.xf` is solved.

Active board state is stored per-board inside `panelBoards[]`:
```js
panelBoards = [
  { id, name, fiducials: [{ id, design, machine, color }], xf: Transform|null },
  …
]
```

---

## 11. Design System (CSS)

All tokens are CSS custom properties defined in `src/index.css`.

### Color palette
| Token | Value | Usage |
|---|---|---|
| `--bg-app` | `#06070a` | Root background |
| `--bg-panel` | `#0d0f14` | Panel background |
| `--bg-card` | `#12151c` | Card / control pane |
| `--bg-input` | `#080a0f` | Input fields, console |
| `--accent-primary` | `#00c8d7` | Cyan — active states, DRO values |
| `--accent-success` | `#00e87a` | Green — connected, solved, done |
| `--accent-warning` | `#f5a623` | Amber — rail fiducials, warnings |
| `--accent-danger` | `#ff3355` | Red — E-stop, errors |

### Shared utility classes
- `.btn` / `.btn.primary` / `.btn.secondary` / `.btn.success` / `.btn.danger` / `.btn.warning` / `.btn.sm` / `.btn.lg`
- `.info` / `.info.success` / `.info.warning` / `.info.error`
- `table.kv` / `table.kv.small`
- `.in` / `.in.sm` — compact table inputs
- `.status-pill.connected` / `.status-pill.disconnected`
- `.dro-display` / `.dro-value` — monospace DRO readouts
- `.step-btn` / `.step-btn.active` / `.step-btn.done` — workflow step nav

---

## 12. Electron IPC Surface

### `window.serial` (contextBridge)
```ts
listPorts(): Promise<{path: string, manufacturer: string}[]>
connect(path: string, baud: number): Promise<{ok: boolean, error?: string}>
disconnect(): Promise<void>
writeLine(cmd: string): Promise<void>
onData(cb: (data: string) => void): void
isConnected(): Promise<boolean>
```

### `window.relay` (contextBridge)
```ts
connect(portPath: string): Promise<{ok: boolean, error?: string}>
disconnect(): Promise<void>
isConnected(): Promise<boolean>
on(): Promise<boolean>
off(): Promise<boolean>
trigger(durationMs: number): Promise<boolean>  // ON → delay → OFF
```

### `window.fs` (contextBridge)
```ts
showOpenDialog(options): Promise<{canceled, filePaths}>
showSaveDialog(options): Promise<{canceled, filePath}>
readFile(path, encoding): Promise<string>
writeFile(path, data): Promise<void>
```

---

## 13. Python Vision Server

**Entry point:** `python-vision/server.py`  
**Port:** `8000` (localhost only)

### API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/stream` | MJPEG camera stream |
| `POST` | `/api/detect` | Detect fiducials in current frame |
| `GET` | `/api/px_per_mm` | Get current pixel/mm calibration |
| `POST` | `/api/px_per_mm` | Set pixel/mm value |
| `GET` | `/api/camera/config` | Get `{index, width, height}` |
| `POST` | `/api/camera/config` | Update camera index/resolution + restart thread |
| `GET` | `/api/calibration/status` | Lens calibration frame count |
| `POST` | `/api/calibration/capture` | Capture calibration frame |
| `POST` | `/api/calibration/compute` | Compute lens distortion matrix |

Camera thread lifecycle uses `threading.Event`:
```python
camera_stop_event = threading.Event()

def restart_camera_thread():
    camera_stop_event.set()            # signal old thread to stop
    camera_thread_ref.join(timeout=3)  # wait for it
    camera_stop_event.clear()          # re-arm
    # start new thread
```

---

## 14. Configuration & Persistence

All user settings persist to `localStorage` in the Electron renderer context.

| Key | Content |
|---|---|
| `toolOffset` | `{dx, dy}` — camera-to-nozzle physical offset in mm |
| `pcbOriginOffset` | `{x, y}` — machine position of PCB origin |
| `nozzleDia` | string — nozzle diameter in mm |
| `customPressure` | number — PSI override |
| `customDwellTime` | number — ms override |
| `safeHeight` | number — Z travel height in mm |
| `dispenseHeight` | number — Z contact height in mm |
| `travelSpeed` | number — mm/min |
| `dispensingSpeed` | number — mm/min |
| `valveOnCmd` | string — G-code line to open valve (e.g. `M106 S255`) |
| `valveOffCmd` | string — G-code line to close valve (e.g. `M107`) |
| `bedCalibration` | JSON — levelling mesh points |

Camera config is persisted server-side to `python-vision/camera_config.json` (not localStorage) so it survives renderer reloads independently.

---

## 15. Development Setup

### Prerequisites
- Node.js 20+
- Python 3.10+ with `fastapi`, `uvicorn`, `opencv-python`, `numpy`

### Install
```bash
npm install
pip install fastapi uvicorn opencv-python numpy
```

### Run (dev)
```bash
# Terminal 1 — React + Vite dev server
npm run dev

# Terminal 2 — Python vision server (optional)
cd python-vision
python server.py

# Terminal 3 — Electron shell (points at Vite dev server)
npm run electron
```

### Build (production)
```bash
npm run build        # Vite production build → dist/
npm run electron:build  # Electron Builder → release/
```

---

## 16. Hardware Integration Notes

### Motion controller
- Compatible with **Grbl** and **Marlin** firmware
- Expects standard `<MPos:x,y,z>` status reports for position feedback
- All coordinates in **mm**, absolute mode (`G90`)
- Default machine: 3-axis (X, Y, Z), no extruder

### Dispenser (valve)
- Default: `M106 S255` / `M107` (maps to Ender-3 fan PWM — relay-compatible)
- Configurable per job in `AutomatedDispensingPanel` settings
- 983A pneumatic dispenser driven via LCUS-1 USB relay on footswitch jack

### Camera
- Mounts down-looking on Z-carriage, offset from nozzle tip
- Camera offset (dx, dy) calibrated via `ToolOffsetCalibration` wizard
- Pixel/mm scale set by placing nozzle on a known reference and measuring

### Safe heights
- `safeHeight` (default 5 mm) — travel between pads
- `dispenseHeight` (default 0.5 mm) — Z contact during dispensing
- Bed levelling mesh (`BedCalibrationPanel`) applies Z-offset corrections per XY position
