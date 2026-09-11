export class FluxSystemManager {
  constructor() {
    this.totalDispenses = this.loadFromStorage('fluxDispenses', 0);
    this.cyclesSinceLastClean = this.loadFromStorage('fluxCyclesSinceClean', 0);
    this.lastDispensedTime = this.loadFromStorage('fluxLastDispensed', null);
    this.lastCleanedTime = this.loadFromStorage('fluxLastCleaned', null);
    
    // Config
    this.settings = this.loadFromStorage('fluxSettings', {
      emptyWeight: 100,
      fullWeight: 1000,
      lowThresholdPercent: 20,
      cleanInterval: 10
    });

    // Simulated/Real-time status
    this.currentWeight = this.loadFromStorage('fluxCurrentWeight', 1000); // g
    
    this.reminderCallback = null;
  }

  setReminderCallback(callback) {
    this.reminderCallback = callback;
  }

  // Record a dispense operation
  recordDispense() {
    this.totalDispenses++;
    this.cyclesSinceLastClean++;
    this.lastDispensedTime = Date.now();
    
    // Simulate weight drop per dispense (e.g., 2g per dispense)
    this.currentWeight = Math.max(this.settings.emptyWeight, this.currentWeight - 2);

    this.saveToStorage('fluxDispenses', this.totalDispenses);
    this.saveToStorage('fluxCyclesSinceClean', this.cyclesSinceLastClean);
    this.saveToStorage('fluxLastDispensed', this.lastDispensedTime);
    this.saveToStorage('fluxCurrentWeight', this.currentWeight);

    this.checkWarnings();
  }

  // Run a cleaning cycle
  markCleaned() {
    this.cyclesSinceLastClean = 0;
    this.lastCleanedTime = Date.now();
    this.saveToStorage('fluxCyclesSinceClean', this.cyclesSinceLastClean);
    this.saveToStorage('fluxLastCleaned', this.lastCleanedTime);
  }

  // Refill
  markRefilled() {
    this.currentWeight = this.settings.fullWeight;
    this.saveToStorage('fluxCurrentWeight', this.currentWeight);
    this.checkWarnings();
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveToStorage('fluxSettings', this.settings);
    this.checkWarnings();
  }

  // Returns % (0-100)
  getLevelPercent() {
    const range = this.settings.fullWeight - this.settings.emptyWeight;
    if (range <= 0) return 0;
    const currentStr = this.currentWeight - this.settings.emptyWeight;
    return Math.max(0, Math.min(100, (currentStr / range) * 100));
  }

  getStatus() {
    const percent = this.getLevelPercent();
    if (percent === 0) return 'EMPTY';
    if (percent <= this.settings.lowThresholdPercent) return 'LOW';
    if (this.cyclesSinceLastClean >= this.settings.cleanInterval) return 'CLEAN_REQ';
    return 'NORMAL';
  }

  checkWarnings() {
    if (!this.reminderCallback) return;
    
    const status = this.getStatus();
    if (status === 'LOW' || status === 'EMPTY') {
      this.reminderCallback({ type: 'low_flux', status, percent: this.getLevelPercent() });
    } else if (status === 'CLEAN_REQ') {
      this.reminderCallback({ type: 'cleaning_due' });
    }
  }

  // Load data from localStorage
  loadFromStorage(key, defaultValue) {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  }

  // Save data to localStorage
  saveToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Ignore
    }
  }
}

