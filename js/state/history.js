// Undo/redo by snapshots: before each change we save a JSON copy of the planet.
// Simple and hard to get wrong, at the cost of some memory.

export class History {
  constructor(limit = 50) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }

  static snapshot(planet) {
    return JSON.stringify(planet);
  }

  push(snapshot) {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  // Returns the snapshot to restore, or null.
  undo(current) {
    if (!this.undoStack.length) return null;
    this.redoStack.push(current);
    return this.undoStack.pop();
  }

  redo(current) {
    if (!this.redoStack.length) return null;
    this.undoStack.push(current);
    return this.redoStack.pop();
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

// Copy the snapshot's fields back onto the live planet object (keeping its identity).
export function restoreSnapshot(planet, snapshot) {
  const data = JSON.parse(snapshot);
  for (const key of Object.keys(planet)) if (!(key in data)) delete planet[key];
  Object.assign(planet, data);
  return planet;
}
