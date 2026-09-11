import { useState, useEffect, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'solder_paste_tip_cleaner';

const DEFAULT_STATE = {
  padsSinceLastClean: 0,
  totalLifetimeCleans: 0,
  lastCleanedAt: null,
  cleaningIntervalPads: 500,
  events: [],
};

function initState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        padsSinceLastClean: parsed.padsSinceLastClean ?? DEFAULT_STATE.padsSinceLastClean,
        totalLifetimeCleans: parsed.totalLifetimeCleans ?? DEFAULT_STATE.totalLifetimeCleans,
        lastCleanedAt: parsed.lastCleanedAt ?? DEFAULT_STATE.lastCleanedAt,
        cleaningIntervalPads: parsed.cleaningIntervalPads ?? DEFAULT_STATE.cleaningIntervalPads,
        events: Array.isArray(parsed.events) ? parsed.events : [],
      };
    }
  } catch (e) {
    console.warn('[useTipCleaner] Failed to load state from localStorage', e);
  }
  return { ...DEFAULT_STATE, events: [] };
}

function buildEvent(message, type = 'info') {
  return { timestamp: new Date().toISOString(), message, type };
}

function tipCleanerReducer(state, action) {
  switch (action.type) {
    case 'RECORD_PAD':
      return { ...state, padsSinceLastClean: state.padsSinceLastClean + 1 };
      
    case 'CLEAN_SUCCESS': {
      const event = buildEvent('Tip cleaning cycle completed successfully.', 'success');
      return {
        ...state,
        padsSinceLastClean: 0,
        totalLifetimeCleans: state.totalLifetimeCleans + 1,
        lastCleanedAt: Date.now(),
        events: [event, ...state.events].slice(0, 100),
      };
    }
    
    case 'CLEAN_FAULT': {
      const event = buildEvent(`Tip cleaning cycle failed: ${action.payload}`, 'error');
      return {
        ...state,
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

export function useTipCleaner() {
  const [state, dispatch] = useState(initState);

  // Persistence
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore
    }
  }, [state]);

  // Derived state
  const progressPct = useMemo(() => {
    if (state.cleaningIntervalPads <= 0) return 0;
    const pct = (state.padsSinceLastClean / state.cleaningIntervalPads) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [state.padsSinceLastClean, state.cleaningIntervalPads]);

  const needsCleaning = useMemo(() => {
    return state.padsSinceLastClean >= state.cleaningIntervalPads;
  }, [state.padsSinceLastClean, state.cleaningIntervalPads]);
  
  const padsRemaining = Math.max(0, state.cleaningIntervalPads - state.padsSinceLastClean);

  // Actions
  const recordPadDispensed = useCallback(() => {
    dispatch(prev => tipCleanerReducer(prev, { type: 'RECORD_PAD' }));
  }, []);

  const recordCleanSuccess = useCallback(() => {
    dispatch(prev => tipCleanerReducer(prev, { type: 'CLEAN_SUCCESS' }));
  }, []);
  
  const recordCleanFault = useCallback((reason) => {
    dispatch(prev => tipCleanerReducer(prev, { type: 'CLEAN_FAULT', payload: reason }));
  }, []);

  const updateConfig = useCallback((config) => {
    const allowed = {};
    if (config.cleaningIntervalPads !== undefined) allowed.cleaningIntervalPads = config.cleaningIntervalPads;
    dispatch(prev => tipCleanerReducer(prev, { type: 'UPDATE_CONFIG', payload: allowed }));
  }, []);

  const logEvent = useCallback((message, eventType = 'info') => {
    dispatch(prev => tipCleanerReducer(prev, { type: 'LOG_EVENT', payload: { message, eventType } }));
  }, []);

  const clearEvents = useCallback(() => {
    dispatch(prev => tipCleanerReducer(prev, { type: 'CLEAR_EVENTS' }));
  }, []);

  return {
    ...state,
    progressPct,
    needsCleaning,
    padsRemaining,
    recordPadDispensed,
    recordCleanSuccess,
    recordCleanFault,
    updateConfig,
    logEvent,
    clearEvents,
  };
}

