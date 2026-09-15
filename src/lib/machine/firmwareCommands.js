export const firmwareCommands = {
    // State & Status
    home: "$H",
    homeX: "$HX",
    homeY: "$HY",
    homeZ: "$HZ",
    unlock: "$X",
    status: "?",
    pause: "!",
    resume: "~",
    reset: "\x18",
    
    // Tools (Paste Dispenser)
    dispenserOn: "M3 S1000",
    dispenserOff: "M5",
    
    // Tools (Flux System)
    // GRBL Command & Pin Mapping (Arduino Nano - ATmega328P):
    // M3 -> Pump FORWARD (Digital Pin 11 : Spindle Enable PWM)
    // M4 -> Pump REVERSE (Digital Pin 13 : Spindle Direction)
    // M5 -> Stop Pump
    flux: {
        cleanStart:   'M3',       // Spindle CW (Pump Forward)
        flushFwd:     'M3 S255',  // Full speed forward
        flushRev:     'M4 S255',  // Full speed reverse
        cleanEnd:     'M5',       // Spindle Stop
        dispense:     'M3 S255',  // Dispense forward
        dispenseOff:  'M5',       // Stop
    },

    // Tools (Fume Extraction)
    // Dedicated GRBL Board: M3 PWM controls fan speed
    fumeExtraction: {
        start: (speedPercent) => `M3 S${Math.round((speedPercent / 100) * 255)}`,
        stop: 'M5'
    },

    // Tools (Automatic Tip Cleaner)
    // M8 -> Coolant Enable (Analog Pin A3)
    tipCleaner: {
        runCycle: 'M8', // Coolant ON (Air jet / servo trigger)
        stopCycle: 'M9' // Coolant OFF
    },
    
    // Tools (Quick Tip Rotation)
    // Dedicated GRBL Board: Treats rotation as its own "X" axis
    tipRotation: {
        home: '$HX', // Home the X-axis of the dedicated rotation board
        rotateTo: (angle) => `G0 X${angle.toFixed(2)}`
    },
    
    // Tools (Automatic Tip Changer)
    // Dedicated GRBL Board: Uses Spindle Dir/Enable pins
    tipChanger: {
        dropTip: 'M3', // Spindle CW pin to actuate drop mechanism
        pickTip: 'M4', // Spindle CCW pin to actuate pick mechanism
        reset: 'M5'    // Turn off pins
    },

    // Tools (Payload Configuration)
    // Standard GRBL ignores commands inside parentheses (treats them as comments).
    // The dedicated payload board can safely read this from the serial stream without throwing an error.
    payload: {
        setPayload: (val) => `(PAYLOAD_SET:${val.toFixed(2)})`
    },

    // Settings & Configuration
    // Standard GRBL uses $120, $121, $122 for X, Y, Z acceleration
    setAccel: (accel) => `$120=${accel}\n$121=${accel}\n$122=${accel}`, 
    setZero: "G92 X0 Y0 Z0",
    setAbsolute: "G90",
    setRelative: "G91",
    setMetric: "G21",
    
    // Overrides (Real-time GRBL commands, sent without newline)
    feedOverride100: "\x90",
    feedOverridePlus10: "\x91",
    feedOverrideMinus10: "\x92",
    feedOverridePlus1: "\x93",
    feedOverrideMinus1: "\x94"
};

