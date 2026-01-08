/**
 * Death Counter Utility
 * Manages global death count across all levels
 */

class DeathCounter {
  constructor() {
    this.count = 0;
  }

  get() {
    return this.count;
  }

  increment() {
    this.count++;
    return this.count;
  }

  reset() {
    this.count = 0;
  }
}

const deathCounterInstance = new DeathCounter();

export default deathCounterInstance;
