import { useState, useEffect, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'solder_paste_fume_extractor';

const DEFAULT_STATE = {
  operatingHours: 0,
  serviceThresholdHours: 500,
  postRunDurationSec: 30,
  minAirflowLpm: 15,
  events: [],
};

// ── Initializer: reads persisted state from localStorage on first mount ───────
function initState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        operatingHours: parsed.operatingHours ?? DEFAULT_STATE.operatingHours,
        serviceThresholdHours: parsed.serviceThresholdHours ?? DEFAULT_STATE.serviceThresholdHours,
        postRunDurationSec: parsed.postRunDurationSec ?? DEFAULT_STATE.postRunDurationSec,
        minAirflowLpm: parsed.minAirflowLpm ?? DEFAULT_STATE.minAirflowLpm,
        events: Array.isArray(parsed.events) ? parsed.events : [],
      };
    }
  } catch (e) {
    console.warn('[useFumeExtraction] Failed to load state from localStorage', e);
  }
  return { ...DEFAULT_STATE, events: [] };
}

// ── Reducer ──────────────────────────────────────────────────────────────────
function fumeReducer(state, action) {
  switch (action.type) {
    case 'ADD_OPERATING_TIME':
      return { ...state, operatingHours: state.operatingHours + action.payload };

    case 'RESET_FILTER': {
      const event = buildEvent('HEPA filter replaced. Operating hours reset.');
      return {
        ...state,
        operatingHours: 0,
        events: [event, ...state.events].slice(0, 100),
      };
    }

    case 'UPDATE_CONFIG':
      return { ...state, ...action.payload };

    case 'LOG_EVENT': {
      const event = buildEvent(action.payload.message, action.payload.eventType);
      return { ...state, events: [event, ...state.events].slice(0, 100) };
    }

    case 'CLEAR_EVENTS':
      return { ...state, events: [] };

    default:
      return state;
  }
}

function buildEvent(message, type = 'info') {
  return { timestamp: new Date().toISOString(), message, type };
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useFumeExtraction() {
  const [state, dispatch] = useState(initState);

  // ── Persistence: auto-write to localStorage on every state change ──────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Silently ignore storage errors
    }
  }, [state]);

  // ── Derived state: never stored, calculated fresh every render ────────────
  const filterHealthPct = useMemo(() => {
    if (state.serviceThresholdHours <= 0) return 0;
    return Math.max(0, 100 - (state.operatingHours / state.serviceThresholdHours) * 100);
  }, [state.operatingHours, state.serviceThresholdHours]);

  const isFilterServiceRequired = useMemo(
    () => state.operatingHours >= state.serviceThresholdHours,
    [state.operatingHours, state.serviceThresholdHours]
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  const addOperatingTime = useCallback((hours) => {
    dispatch(prev => fumeReducer(prev, { type: 'ADD_OPERATING_TIME', payload: hours }));
  }, []);

  const resetFilter = useCallback(() => {
    dispatch(prev => fumeReducer(prev, { type: 'RESET_FILTER' }));
  }, []);

  const updateConfig = useCallback((config) => {
    // Only allow recognised config keys
    const allowed = {};
    if (config.serviceThresholdHours !== undefined) allowed.serviceThresholdHours = config.serviceThresholdHours;
    if (config.postRunDurationSec !== undefined)    allowed.postRunDurationSec    = config.postRunDurationSec;
    if (config.minAirflowLpm !== undefined)         allowed.minAirflowLpm         = config.minAirflowLpm;
    dispatch(prev => fumeReducer(prev, { type: 'UPDATE_CONFIG', payload: allowed }));
  }, []);

  const logEvent = useCallback((message, eventType = 'info') => {
    dispatch(prev => fumeReducer(prev, { type: 'LOG_EVENT', payload: { message, eventType } }));
  }, []);

  const clearEvents = useCallback(() => {
    dispatch(prev => fumeReducer(prev, { type: 'CLEAR_EVENTS' }));
  }, []);

  return {
    // State
    operatingHours: state.operatingHours,
    serviceThresholdHours: state.serviceThresholdHours,
    postRunDurationSec: state.postRunDurationSec,
    minAirflowLpm: state.minAirflowLpm,
    events: state.events,

    // Derived
    filterHealthPct,
    isFilterServiceRequired,

    // Actions
    addOperatingTime,
    resetFilter,
    updateConfig,
    logEvent,
    clearEvents,
  };
}

