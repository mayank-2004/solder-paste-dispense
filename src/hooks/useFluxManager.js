import { useState, useEffect, useMemo, useCallback } from 'react';

const STORAGE_KEYS = {
  totalDispenses: 'fluxDispenses',
  cyclesSinceLastClean: 'fluxCyclesSinceClean',
  lastDispensedTime: 'fluxLastDispensed',
  lastCleanedTime: 'fluxLastCleaned',
  currentWeight: 'fluxCurrentWeight',
  settings: 'fluxSettings',
};

const DEFAULT_SETTINGS = {
  emptyWeight: 100,
  fullWeight: 1000,
  lowThresholdPercent: 20,
  cleanInterval: 10,
};

function loadFromStorage(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key);
    return stored !== null ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

// ── Initializer: Reads the whole flux state from localStorage once ──────────
function initState() {
  return {
    totalDispenses: loadFromStorage(STORAGE_KEYS.totalDispenses, 0),
    cyclesSinceLastClean: loadFromStorage(STORAGE_KEYS.cyclesSinceLastClean, 0),
    lastDispensedTime: loadFromStorage(STORAGE_KEYS.lastDispensedTime, null),
    lastCleanedTime: loadFromStorage(STORAGE_KEYS.lastCleanedTime, null),
    currentWeight: loadFromStorage(STORAGE_KEYS.currentWeight, 1000),
    settings: loadFromStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
  };
}

// ── Reducer ──────────────────────────────────────────────────────────────────
function fluxReducer(state, action) {
  switch (action.type) {
    case 'RECORD_DISPENSE': {
      const newWeight = Math.max(
        state.settings.emptyWeight,
        state.currentWeight - 2 // 2g per dispense
      );
      return {
        ...state,
        totalDispenses: state.totalDispenses + 1,
        cyclesSinceLastClean: state.cyclesSinceLastClean + 1,
        lastDispensedTime: Date.now(),
        currentWeight: newWeight,
      };
    }
    case 'MARK_CLEANED':
      return {
        ...state,
        cyclesSinceLastClean: 0,
        lastCleanedTime: Date.now(),
      };
    case 'MARK_REFILLED':
      return {
        ...state,
        currentWeight: state.settings.fullWeight,
      };
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };
    case 'SET_WEIGHT':
      return {
        ...state,
        currentWeight: action.payload,
      };
    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useFluxManager() {
  const [state, dispatch] = useState(initState);

  // ── Persistence: write to localStorage whenever state changes ──────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.totalDispenses, JSON.stringify(state.totalDispenses));
      localStorage.setItem(STORAGE_KEYS.cyclesSinceLastClean, JSON.stringify(state.cyclesSinceLastClean));
      localStorage.setItem(STORAGE_KEYS.lastDispensedTime, JSON.stringify(state.lastDispensedTime));
      localStorage.setItem(STORAGE_KEYS.lastCleanedTime, JSON.stringify(state.lastCleanedTime));
      localStorage.setItem(STORAGE_KEYS.currentWeight, JSON.stringify(state.currentWeight));
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
    } catch {
      // Silently ignore storage errors
    }
  }, [state]);

  // Listen for hardware custom flux messages
  useEffect(() => {
    const handleFluxWeight = (e) => {
      const weight = parseFloat(e.detail);
      if (!isNaN(weight)) {
        dispatch({ type: 'SET_WEIGHT', payload: weight });
      }
    };
    
    window.addEventListener('hw:FLUX_WEIGHT', handleFluxWeight);
    return () => window.removeEventListener('hw:FLUX_WEIGHT', handleFluxWeight);
  }, []);

  // ── Derived state: calculated dynamically, never stored ──────────────────
  const levelPct = useMemo(() => {
    const { emptyWeight, fullWeight } = state.settings;
    const range = fullWeight - emptyWeight;
    if (range <= 0) return 0;
    const filled = state.currentWeight - emptyWeight;
    return Math.max(0, Math.min(100, (filled / range) * 100));
  }, [state.currentWeight, state.settings]);

  const levelState = useMemo(() => {
    if (levelPct <= 0) return 'EMPTY';
    if (levelPct <= state.settings.lowThresholdPercent) return 'LOW';
    if (state.cyclesSinceLastClean >= state.settings.cleanInterval) return 'CLEAN_REQ';
    return 'NORMAL';
  }, [levelPct, state.settings.lowThresholdPercent, state.settings.cleanInterval, state.cyclesSinceLastClean]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const recordDispense = useCallback(() => {
    dispatch(prev => fluxReducer(prev, { type: 'RECORD_DISPENSE' }));
  }, []);

  const markCleaned = useCallback(() => {
    dispatch(prev => fluxReducer(prev, { type: 'MARK_CLEANED' }));
  }, []);

  const markRefilled = useCallback(() => {
    dispatch(prev => fluxReducer(prev, { type: 'MARK_REFILLED' }));
  }, []);

  const updateSettings = useCallback((newSettings) => {
    dispatch(prev => fluxReducer(prev, { type: 'UPDATE_SETTINGS', payload: newSettings }));
  }, []);

  // Called by the embedded load-cell hardware bridge when a real weight reading arrives
  const setWeight = useCallback((weightGrams) => {
    dispatch(prev => fluxReducer(prev, { type: 'SET_WEIGHT', payload: weightGrams }));
  }, []);

  return {
    // State
    currentWeight: state.currentWeight,
    totalDispenses: state.totalDispenses,
    cyclesSinceLastClean: state.cyclesSinceLastClean,
    lastDispensedTime: state.lastDispensedTime,
    lastCleanedTime: state.lastCleanedTime,
    settings: state.settings,

    // Derived (no need to store)
    levelPct,
    levelState,

    // Actions
    recordDispense,
    markCleaned,
    markRefilled,
    updateSettings,
    setWeight,
  };
}

