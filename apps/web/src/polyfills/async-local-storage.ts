// Polyfill for AsyncLocalStorage in browser environment
// This is needed because @tanstack/react-start uses Node.js APIs

class AsyncLocalStoragePolyfill<T> {
  private store: Map<number, T> = new Map();
  private currentId = 0;

  run<R>(store: T, callback: () => R): R {
    const id = ++this.currentId;
    this.store.set(id, store);
    try {
      return callback();
    } finally {
      this.store.delete(id);
    }
  }

  getStore(): T | undefined {
    return this.store.get(this.currentId);
  }

  disable(): void {
    // No-op in browser
  }

  enable(): void {
    // No-op in browser
  }

  enterWith(store: T): void {
    this.currentId++;
    this.store.set(this.currentId, store);
  }
}

// Export as a class that matches Node.js AsyncLocalStorage API
export class AsyncLocalStorage<T> extends AsyncLocalStoragePolyfill<T> {
  constructor() {
    super();
  }
}
