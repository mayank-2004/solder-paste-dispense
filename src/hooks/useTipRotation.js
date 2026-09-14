import { useState, useEffect, useCallback } from 'react';

export function useTipRotation() {
  const [isHomed, setIsHomed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tipRotation_isHomed') || 'false');
    } catch {
      return false;
    }
  });

  const [currentAngle, setCurrentAngle] = useState(null); // null means unknown
  const [targetAngle, setTargetAngle] = useState(0);
  const [status, setStatus] = useState('IDLE'); // 'IDLE', 'ROTATING', 'FAULT'

  // Persist homed state
  useEffect(() => {
    localStorage.setItem('tipRotation_isHomed', JSON.stringify(isHomed));
  }, [isHomed]);

  const homeRotation = useCallback(() => {
    setStatus('ROTATING');
    // Simulated homing completion
    setTimeout(() => {
      setIsHomed(true);
      setCurrentAngle(0);
      setTargetAngle(0);
      setStatus('IDLE');
    }, 2000);
  }, []);

  const setAngle = useCallback((angle) => {
    if (!isHomed) return false;
    
    const clampedAngle = Math.max(0, Math.min(180, parseFloat(angle)));
    setTargetAngle(clampedAngle);
    setStatus('ROTATING');
    
    // Simulating rotation completion
    const distance = Math.abs((currentAngle || 0) - clampedAngle);
    const delay = Math.max(500, distance * 10); 
    
    setTimeout(() => {
      setCurrentAngle(clampedAngle);
      setStatus('IDLE');
    }, delay);

    return clampedAngle;
  }, [isHomed, currentAngle]);

  const resetFault = useCallback(() => {
    setStatus('IDLE');
    setIsHomed(false);
    setCurrentAngle(null);
  }, []);

  return {
    isHomed,
    currentAngle,
    targetAngle,
    status,
    homeRotation,
    setAngle,
    resetFault,
    setIsHomed,
    setCurrentAngle,
    setStatus,
    setTargetAngle
  };
}

