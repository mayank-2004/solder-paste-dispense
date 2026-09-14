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
    // GRBL Command & Pin Mapping (Arduino MEGA): 
    // M3 -> Pump FORWARD (Digital Pin 6 : Spindle Enable)
    // M4 -> Pump REVERSE (Digital Pin 5 : Spindle Direction)
    // M5 -> Stop Pump
    flux: {
        cleanStart:   'M3',       // Spindle CW (Pump Forward)
        flushFwd:     'M3 S255',  // Full speed forward
        flushRev:     'M4 S255',  // Full speed reverse
        cleanEnd:     'M5',       // Spindle Stop
        dispense:     'M3 S255',  // Dispense forward
        dispenseOff:  'M5',       // Stop
    },

    // Tools (Automatic Tip Cleaner)
    // Assuming custom M-codes or specific spindle/coolant pins are used.
    tipCleaner: {
        runCycle: 'M8', // Placeholder: M8 typically coolant on, adjust as needed for air jet/servo trigger
        stopCycle: 'M9'
    },
    
    // Tools (Quick Tip Rotation)
    // Assuming A-axis is used for the rotary stepper
    tipRotation: {
        home: '$HA', // Home rotary axis (assuming GRBL Hal supports this, or custom M-code)
        rotateTo: (angle) => `G0 A${angle.toFixed(2)}`
    },
    
    // Settings & Configuration
    setAccel: (accel) => "", // GRBL doesn't support dynamic M204 T...
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

