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

    // Tools (Automatic Tip Cleaner)
    // M8 -> Coolant Enable (Analog Pin A3)
    tipCleaner: {
        runCycle: 'M8', // Coolant ON (Air jet / servo trigger)
        stopCycle: 'M9' // Coolant OFF
    },
    
    // Tools (Quick Tip Rotation)
    // Note: Running on a separate, dedicated Nano board via a multiplexed/separate serial connection.
    tipRotation: {
        home: '$HA', // Home rotary axis (assuming custom firmware or mapped to an axis on the dedicated board)
        rotateTo: (angle) => `G0 A${angle.toFixed(2)}`
    },
    
    // Tools (Automatic Tip Changer)
    tipChanger: {
        dropTip: 'M10', // Pseudo M-code for engaging rack/dropping tip
        pickTip: 'M11'  // Pseudo M-code for locking new tip
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

