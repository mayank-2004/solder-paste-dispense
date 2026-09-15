import { useState, useEffect, useCallback } from 'react';
import { toast, showConfirm } from '../lib/toast';

const STORAGE_KEY = 'headPayloadConfig';
export const MAX_PAYLOAD = 2.0; // kg

export function usePayloadManager() {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load payload config from local storage", e);
    }
    return {
      configuredPayload: 0,
      warningThreshold: 1.8,
      lastConfirmedPayload: null,
      lastSyncTime: null
    };
  });

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const applyPayload = useCallback(async (newPayload) => {
    const value = parseFloat(newPayload);
    
    if (isNaN(value) || value < 0) {
      toast.error('Invalid payload value.');
      return false;
    }
    
    if (value > MAX_PAYLOAD) {
      toast.error(`Cannot apply payload. Maximum capacity is ${MAX_PAYLOAD.toFixed(2)} kg.`);
      return false;
    }

    // Check for significant change (> 0.5 kg difference)
    const diff = Math.abs(value - state.configuredPayload);
    if (diff > 0.5) {
      const confirmed = await showConfirm(`Significant payload change detected (${diff.toFixed(2)} kg difference). Ensure mechanical configuration is correct before continuing. Apply new payload?`);
      if (!confirmed) {
        return false;
      }
    }

    setState(prev => ({
      ...prev,
      configuredPayload: value
    }));
    
    toast.success(`Payload configured to ${value.toFixed(2)} kg.`);
    return true;
  }, [state.configuredPayload]);

  const applyThreshold = useCallback((newThreshold) => {
    const value = parseFloat(newThreshold);
    if (isNaN(value) || value <= 0 || value > MAX_PAYLOAD) {
      toast.error(`Warning threshold must be between 0 and ${MAX_PAYLOAD} kg.`);
      return false;
    }

    setState(prev => ({
      ...prev,
      warningThreshold: value
    }));
    toast.success(`Warning threshold set to ${value.toFixed(2)} kg.`);
    return true;
  }, []);

  const forceSync = useCallback(async (writeSerial) => {
    // Simulate embedded syncing delay
    toast.info('Syncing payload with embedded controller...');
    
    // If serial is connected, we would send a command here, e.g.,
    if (writeSerial) {
      writeSerial(`[PAYLOAD_SET:${state.configuredPayload.toFixed(2)}]`);
    }

    await new Promise(resolve => setTimeout(resolve, 800));

    setState(prev => ({
      ...prev,
      lastConfirmedPayload: prev.configuredPayload,
      lastSyncTime: new Date().toISOString()
    }));
    
    toast.success('Embedded synchronization complete.');
  }, [state.configuredPayload]);

  // Derived state
  const remainingMargin = Math.max(0, MAX_PAYLOAD - state.configuredPayload);
  const marginPercent = (remainingMargin / MAX_PAYLOAD) * 100;
  
  let status = 'NORMAL';
  if (state.configuredPayload > MAX_PAYLOAD) {
    status = 'OVER_LIMIT'; // Theoretically unreachable via UI constraints, but good for robust state
  } else if (state.configuredPayload >= state.warningThreshold) {
    status = 'NEAR_LIMIT';
  }

  return {
    ...state,
    maxCapacity: MAX_PAYLOAD,
    remainingMargin,
    marginPercent,
    status,
    applyPayload,
    applyThreshold,
    forceSync
  };
}

