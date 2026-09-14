import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'tipManagerConfig';

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

const DEFAULT_STATE = {
  tips: [],
  slotCount: 4,
  slots: [
    { index: 1, position: null },
    { index: 2, position: null },
    { index: 3, position: null },
    { index: 4, position: null }
  ],
  activeTipId: null,
  status: 'UNVERIFIED' // UNVERIFIED, VERIFIED, CHANGING, FAULT
};

export function useTipManager() {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_STATE, ...JSON.parse(stored) } : DEFAULT_STATE;
    } catch {
      return DEFAULT_STATE;
    }
  });

  // Persist state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addTip = useCallback(() => {
    setState(prev => ({
      ...prev,
      tips: [
        ...prev.tips,
        {
          id: generateId(),
          name: 'New Tip',
          type: 'Standard',
          slot: null,
          offsetX: 0,
          offsetY: 0,
          offsetZ: 0
        }
      ]
    }));
  }, []);

  const updateTip = useCallback((id, updates) => {
    setState(prev => ({
      ...prev,
      tips: prev.tips.map(tip => tip.id === id ? { ...tip, ...updates } : tip)
    }));
  }, []);

  const removeTip = useCallback((id) => {
    setState(prev => ({
      ...prev,
      tips: prev.tips.filter(tip => tip.id !== id),
      activeTipId: prev.activeTipId === id ? null : prev.activeTipId,
      status: prev.activeTipId === id ? 'UNVERIFIED' : prev.status
    }));
  }, []);

  const setSlotCount = useCallback((count) => {
    const validCount = Math.max(4, Math.min(20, count));
    setState(prev => {
      const newSlots = [...prev.slots];
      if (validCount > newSlots.length) {
        for (let i = newSlots.length; i < validCount; i++) {
          newSlots.push({ index: i + 1, position: null });
        }
      } else if (validCount < newSlots.length) {
        newSlots.splice(validCount);
      }
      return { ...prev, slotCount: validCount, slots: newSlots };
    });
  }, []);

  const calibrateSlot = useCallback((index, position) => {
    setState(prev => ({
      ...prev,
      slots: prev.slots.map(s => s.index === index ? { ...s, position } : s)
    }));
  }, []);

  const setActiveTip = useCallback((id, status = 'VERIFIED') => {
    setState(prev => ({
      ...prev,
      activeTipId: id,
      status: status
    }));
  }, []);

  const setStatus = useCallback((status) => {
    setState(prev => ({ ...prev, status }));
  }, []);

  // Simulates a tool change sequence
  const executeTipChange = useCallback(async (currentTipId, targetTipId, writeSerial) => {
    setState(prev => ({ ...prev, status: 'CHANGING' }));
    
    try {
      // 1. Check if current tip needs to be dropped
      if (currentTipId) {
        const currentTip = state.tips.find(t => t.id === currentTipId);
        if (currentTip && currentTip.slot) {
          const slotIdx = parseInt(currentTip.slot.replace('Slot ', ''));
          const slot = state.slots.find(s => s.index === slotIdx);
          if (slot && slot.position) {
            // Commands to drop tip (pseudo)
            if (writeSerial) {
              writeSerial(`G0 Z0`); // safe Z
              writeSerial(`G0 X${slot.position.x} Y${slot.position.y}`);
              writeSerial(`G0 Z${slot.position.z}`);
              writeSerial(`M10`); // drop command
              writeSerial(`G0 Z0`); // safe Z
            }
          }
        }
      }
      
      // Simulate delay for drop
      await new Promise(r => setTimeout(r, 1500));

      // 2. Pick up new tip
      if (targetTipId) {
        const targetTip = state.tips.find(t => t.id === targetTipId);
        if (targetTip && targetTip.slot) {
          const slotIdx = parseInt(targetTip.slot.replace('Slot ', ''));
          const slot = state.slots.find(s => s.index === slotIdx);
          if (slot && slot.position) {
            // Commands to pick tip (pseudo)
            if (writeSerial) {
              writeSerial(`G0 X${slot.position.x} Y${slot.position.y}`);
              writeSerial(`G0 Z${slot.position.z}`);
              writeSerial(`M11`); // pick command
              writeSerial(`G0 Z0`); // safe Z
            }
          }
        }
      }

      // Simulate delay for pick
      await new Promise(r => setTimeout(r, 1500));

      setState(prev => ({
        ...prev,
        activeTipId: targetTipId || null,
        status: targetTipId ? 'VERIFIED' : 'UNVERIFIED'
      }));
      return true;
    } catch (err) {
      setState(prev => ({ ...prev, status: 'FAULT' }));
      return false;
    }
  }, [state.tips, state.slots]);

  return {
    tips: state.tips,
    slots: state.slots,
    slotCount: state.slotCount,
    activeTipId: state.activeTipId,
    status: state.status,
    addTip,
    updateTip,
    removeTip,
    setSlotCount,
    calibrateSlot,
    setActiveTip,
    setStatus,
    executeTipChange
  };
}

