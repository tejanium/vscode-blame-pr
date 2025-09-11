import * as vscode from "vscode";

type CacheEntry<T = any> = { value: T; expiresAt: number };

export class MementoCache {
  constructor(private memento: vscode.Memento) {}

  has(key: string): boolean {
    const entry = this.memento.get<CacheEntry>(key);
    if (!entry) {
      return false;
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memento.update(key, undefined);
      return false;
    }

    return true;
  }

  get<T = any>(key: string): T | undefined {
    const entry = this.memento.get<CacheEntry<T>>(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memento.update(key, undefined);
      return undefined;
    }

    return entry.value;
  }

  put<T = any>(key: string, value: T, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.memento.update(key, { value, expiresAt });
  }

  async flush(): Promise<void> {
    // No-op for memento; keys aren't enumerable. Keep API parity.
  }
}
