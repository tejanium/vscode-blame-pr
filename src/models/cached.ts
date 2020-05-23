const CACHE_EXPIRATION = parseInt(process.env.CACHE_EXPIRATION as string) || 30; // s

export class Cached {
	constructor(private cache: any) { }

	async fetch(key: string, fn: Function): Promise<any> {
		if (this.cache.has(key)) {
			return this.cache.get(key);
		} else {
			const data = await fn();

			if (this.notEmpty(data)) {
				this.cache.put(key, data, CACHE_EXPIRATION);
			}

			return data;
		}
	}

	notEmpty(data: any): Boolean {
		return Object.values(data || '').every((value) => Boolean(value) );
	}
}
