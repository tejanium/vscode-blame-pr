export class CommitCache {
  private static commitPRCache = new Map<string, Promise<string | undefined>>();
  private static readonly MAX_COMMIT_CACHE_SIZE = 100;

  static getCachedPRId(
    owner: string,
    name: string,
    sha: string,
    fetchFn: () => Promise<string | undefined>
  ): Promise<string | undefined> {
    const commitKey = `${owner}:${name}:${sha}`;

    if (CommitCache.commitPRCache.has(commitKey)) {
      return CommitCache.commitPRCache.get(commitKey)!;
    }

    const prPromise = fetchFn();
    CommitCache.commitPRCache.set(commitKey, prPromise);

    if (CommitCache.commitPRCache.size > CommitCache.MAX_COMMIT_CACHE_SIZE) {
      const firstKey = CommitCache.commitPRCache.keys().next().value;
      if (firstKey) {
        CommitCache.commitPRCache.delete(firstKey);
      }
    }

    return prPromise;
  }

  static clear(): void {
    CommitCache.commitPRCache.clear();
  }
}
