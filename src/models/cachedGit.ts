import { Git } from "../api/git";
import { Cached } from "./cached";
import { FileBlameCache } from "./fileBlameCache";

export class CachedGit extends Cached {
  private git: Git;

  constructor(
    cache: any,
    private cwd: string,
  ) {
    super(cache);
    this.git = new Git(cwd);
  }

  async config(): Promise<{ domain: string; owner: string; name: string }> {
    const key = ["config", this.cwd].join(":");

    return this.fetch(key, () => {
      return this.git.config();
    });
  }

  async blame(
    fileName: string,
    lineNumber: number,
    _lineContent?: string,
  ): Promise<{ sha: string; author: string; commitMessage: string }> {
    // Use file-level blame cache that watches for file changes
    const fileBlameCache = FileBlameCache.getInstance();
    const cachedResult = await fileBlameCache.getBlame(fileName, lineNumber);

    if (cachedResult) {
      return cachedResult;
    }

    // Fallback to direct git blame if cache miss
    return this.git.blame(fileName, lineNumber);
  }

  getCachedBlame(
    fileName: string,
    lineNumber: number,
    _lineContent?: string,
  ): { sha: string; author: string; commitMessage: string } | undefined {
    // Synchronous cache check for instant status bar updates
    const fileBlameCache = FileBlameCache.getInstance();
    const normalizedPath = fileName.replace(/\\/g, "/");
    const fileData = (fileBlameCache as any).cache.get(normalizedPath);
    return fileData?.lines.get(lineNumber);
  }
}
