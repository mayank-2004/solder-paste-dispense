import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'motionConfigData';
export const MAX_SPEED = 300; // mm/s

const DEFAULT_PROFILES = {
  rapid: { speed: 150, accel: 1000, decel: 1000 },
  soldering: { speed: 50, accel: 500, decel: 500 },
  calibration: { speed: 20, accel: 200, decel: 200 },
  homing: { speed: 50, accel: 500, decel: 500 }
};

export function useMotionConfig() {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load motion config from local storage", e);
    }
    return {
      profiles: DEFAULT_PROFILES,
      activeProfileId: 'rapid',
      commandedSpeed: 150
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateProfile = useCallback((profileId, updates) => {
    setState(prev => {
      // Clamp speed to MAX_SPEED
      const clampedUpdates = { ...updates };
      if (clampedUpdates.speed !== undefined) {
        clampedUpdates.speed = Math.min(Math.max(0, clampedUpdates.speed), MAX_SPEED);
      }
      return {
        ...prev,
        profiles: {
          ...prev.profiles,
          [profileId]: {
            ...prev.profiles[profileId],
            ...clampedUpdates
          }
        }
      };
    });
  }, []);

  const activateProfile = useCallback((profileId, systemState, writeSerial) => {
    setState(prev => {
      const profile = prev.profiles[profileId];
      if (!profile) return prev;

      let targetSpeed = profile.speed;

      // Apply safety restrictions
      if (systemState === 'HALTED') {
        targetSpeed = 0; // No movement allowed
      } else if (systemState === 'WARNING') {
        // Limit speed during a warning state (e.g. 50% max speed or capped at 50mm/s)
        targetSpeed = Math.min(targetSpeed, 50);
      }

      // Convert mm/s to mm/min for G-code feedrates (F)
      const feedrateMin = targetSpeed * 60;
      
      if (writeSerial) {
        // Send feedrate update
        writeSerial(`F${feedrateMin}`);
        // Send Acceleration Update (Assuming M204 format or GRBL standard)
        // M204 P[accel] T[travel_accel]
        writeSerial(`M204 P${profile.accel} T${profile.accel}`);
        // Log activation
        console.log(`[Motion] Activated ${profileId.toUpperCase()} profile. Speed: ${targetSpeed}mm/s, Accel: ${profile.accel}`);
      }

      return {
        ...prev,
        activeProfileId: profileId,
        commandedSpeed: targetSpeed
      };
    });
  }, []);

  return {
    profiles: state.profiles,
    activeProfileId: state.activeProfileId,
    commandedSpeed: state.commandedSpeed,
    updateProfile,
    activateProfile,
    maxAllowedSpeed: MAX_SPEED
  };
}

