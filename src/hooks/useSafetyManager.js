import { useState, useEffect, useCallback } from 'react';
import { toast } from '../lib/toast';

const STORAGE_KEY = 'safetyManagerData';

export const FAULT_CODES = {
  E001: { code: 'E001', type: 'EMERGENCY', defaultMessage: 'Emergency Stop Activated' },
  E002: { code: 'E002', type: 'CRITICAL', defaultMessage: 'Fume Extraction Failure' },
  E003: { code: 'E003', type: 'EMERGENCY', defaultMessage: 'Light Curtain Triggered' },
  E004: { code: 'E004', type: 'CRITICAL', defaultMessage: 'Limit Switch / Out of Bounds' },
  E005: { code: 'E005', type: 'CRITICAL', defaultMessage: 'Hardware / Mechanism Fault' },
  W001: { code: 'W001', type: 'WARNING', defaultMessage: 'Solder Wire Spool Low' },
  I001: { code: 'I001', type: 'INFO', defaultMessage: 'System Notification' },
};

export function useSafetyManager(onHaltSequence) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : { activeFaults: [], faultHistory: [] };
    } catch {
      return { activeFaults: [], faultHistory: [] };
    }
  });

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Listen for hardware custom safety messages
  useEffect(() => {
    const handleEStop = (e) => {
      const code = e.detail || 'E001';
      toast.error(`HARDWARE E-STOP DETECTED: Code ${code}`);
      
      const isCritical = ['E001','E002','E003','E004','E005'].includes(code);
      if (isCritical) {
        if (onHaltSequence) onHaltSequence({ message: `Sensor tripped: ${code}` });
      }

      const faultKey = `hw_${code}`;
      setState(prev => {
        if (prev.activeFaults.some(f => f.id === faultKey)) return prev;
        
        const newFault = {
          id: faultKey,
          code: code,
          source: 'Hardware Sensor',
          message: `Sensor tripped: ${code}`,
          isCritical,
          timestamp: new Date().toISOString()
        };

        return {
          ...prev,
          activeFaults: [newFault, ...prev.activeFaults],
          faultHistory: [newFault, ...prev.faultHistory].slice(0, 100)
        };
      });
    };
    
    window.addEventListener('hw:FAULT', handleEStop);
    return () => window.removeEventListener('hw:FAULT', handleEStop);
  }, [onHaltSequence]);

  const triggerFault = useCallback((code, customMessage = null) => {
    const faultDef = FAULT_CODES[code] || { code, type: 'CRITICAL', defaultMessage: 'Unknown Fault' };
    const message = customMessage || faultDef.defaultMessage;
    
    const newFault = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      code: faultDef.code,
      type: faultDef.type,
      message,
      timestamp: new Date().toISOString()
    };

    setState(prev => {
      if (prev.activeFaults.some(f => f.code === code)) return prev;

      return {
        ...prev,
        activeFaults: [newFault, ...prev.activeFaults],
        faultHistory: [newFault, ...prev.faultHistory].slice(0, 100)
      };
    });

    if (faultDef.type === 'EMERGENCY' || faultDef.type === 'CRITICAL') {
      if (onHaltSequence) onHaltSequence(newFault);
    }
  }, [onHaltSequence]);

  const clearFault = useCallback((id) => {
    setState(prev => {
      const faultToClear = prev.activeFaults.find(f => f.id === id);
      if (!faultToClear) return prev;

      // Update the clearedAt timestamp in the history log
      const updatedHistory = prev.faultHistory.map(f => 
        f.id === id ? { ...f, clearedAt: new Date().toISOString() } : f
      );

      return {
        activeFaults: prev.activeFaults.filter(f => f.id !== id),
        faultHistory: updatedHistory
      };
    });
  }, []);

  const clearAllFaults = useCallback(() => {
    setState(prev => {
      const now = new Date().toISOString();
      const activeIds = prev.activeFaults.map(f => f.id);
      
      const updatedHistory = prev.faultHistory.map(f => 
        activeIds.includes(f.id) ? { ...f, clearedAt: now } : f
      );

      return {
        activeFaults: [],
        faultHistory: updatedHistory
      };
    });
  }, []);

  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      faultHistory: []
    }));
  }, []);

  const hasCriticalFault = state.activeFaults.some(f => f.type === 'EMERGENCY' || f.type === 'CRITICAL');
  const systemState = hasCriticalFault ? 'HALTED' : (state.activeFaults.length > 0 ? 'WARNING' : 'SAFE');

  return {
    activeFaults: state.activeFaults,
    faultHistory: state.faultHistory,
    systemState,
    hasCriticalFault,
    triggerFault,
    clearFault,
    clearAllFaults,
    clearHistory
  };
}

