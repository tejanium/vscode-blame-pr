export const GIT_CACHE_EXPIRATION =
  parseInt(process.env.GIT_CACHE_EXPIRATION as string) || 30;

export class Cached {
  constructor(
    protected cache: {
      has: (k: string) => boolean;
      get: (k: string) => any;
      put: (k: string, v: any, ttl: number) => void;
    },
  ) {}

  getCached(key: string): any | undefined {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    return undefined;
  }

  async fetch(key: string, fn: Function, ttl?: number): Promise<any> {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    } else {
      const data = await fn();

      if (this.notEmpty(data)) {
        // Use provided TTL or default to git cache expiration
        const cacheExpiration = ttl ?? GIT_CACHE_EXPIRATION;
        this.cache.put(key, data, cacheExpiration);
      }

      return data;
    }
  }

  notEmpty(data: any): Boolean {
    if (data === undefined || data === null) {
      return false;
    }

    if (typeof data === "string") {
      return data.length > 0;
    }

    if (Array.isArray(data)) {
      return data.length > 0 && data.every((value) => Boolean(value));
    }

    if (typeof data === "object") {
      const keys = Object.keys(data);
      return (
        keys.length > 0 && Object.values(data).every((value) => Boolean(value))
      );
    }

    return Boolean(data);
  }
}
