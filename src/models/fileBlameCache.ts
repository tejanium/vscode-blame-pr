import * as vscode from "vscode";
import { Git } from "../api/git";
import { dirname } from "path";

interface BlameInfo {
  sha: string;
  author: string;
  commitMessage: string;
}

interface FileBlameData {
  lines: Map<number, BlameInfo>;
  lastModified: number;
  cleanupTimer?: NodeJS.Timeout;
}

export class FileBlameCache implements vscode.Disposable {
  private static instance: FileBlameCache;
  private cache = new Map<string, FileBlameData>();
  private fileWatchers = new Map<string, vscode.FileSystemWatcher>();
  private openFiles = new Set<string>();

  private readonly CLEANUP_DELAY = 30000; // 30 seconds

  static getInstance(): FileBlameCache {
    if (!FileBlameCache.instance) {
      FileBlameCache.instance = new FileBlameCache();
    }
    return FileBlameCache.instance;
  }

  async getBlame(
    fileName: string,
    lineNumber: number,
  ): Promise<BlameInfo | undefined> {
    const normalizedPath = this.normalizePath(fileName);

    // Ensure file blame is cached
    await this.ensureFileBlameCached(normalizedPath);

    const fileData = this.cache.get(normalizedPath);
    return fileData?.lines.get(lineNumber);
  }

  onFileOpened(fileName: string): void {
    const normalizedPath = this.normalizePath(fileName);
    this.openFiles.add(normalizedPath);

    // Cancel cleanup timer if file was reopened
    const fileData = this.cache.get(normalizedPath);
    if (fileData?.cleanupTimer) {
      clearTimeout(fileData.cleanupTimer);
      delete fileData.cleanupTimer;
    }

    // Start watching for changes
    this.setupFileWatcher(normalizedPath);

    // Preload blame data
    this.ensureFileBlameCached(normalizedPath);
  }

  onFileClosed(fileName: string): void {
    const normalizedPath = this.normalizePath(fileName);
    this.openFiles.delete(normalizedPath);

    // Schedule cleanup after 30 seconds
    const fileData = this.cache.get(normalizedPath);
    if (fileData) {
      fileData.cleanupTimer = setTimeout(() => {
        this.cleanupFile(normalizedPath);
      }, this.CLEANUP_DELAY);
    }
  }

  private async ensureFileBlameCached(fileName: string): Promise<void> {
    const fileData = this.cache.get(fileName);
    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(fileName));

    // Check if we need to refresh the cache
    if (!fileData || fileData.lastModified < stat.mtime) {
      await this.refreshFileBlame(fileName, stat.mtime);
    }
  }

  private async refreshFileBlame(
    fileName: string,
    lastModified: number,
  ): Promise<void> {
    try {
      const git = new Git(dirname(fileName));
      const blameData = await git.blameFile(fileName);

      const lines = new Map<number, BlameInfo>();
      blameData.forEach((blame, index) => {
        lines.set(index + 1, blame); // Git blame is 1-indexed
      });

      this.cache.set(fileName, {
        lines,
        lastModified,
      });
    } catch (error) {
      // If blame fails, don't cache anything
      console.warn(`Failed to blame file ${fileName}:`, error);
    }
  }

  private setupFileWatcher(fileName: string): void {
    if (this.fileWatchers.has(fileName)) {
      return; // Already watching
    }

    const watcher = vscode.workspace.createFileSystemWatcher(fileName);

    watcher.onDidChange(() => {
      // File changed, refresh blame cache
      this.refreshFileBlame(fileName, Date.now());
    });

    watcher.onDidDelete(() => {
      // File deleted, clean up
      this.cleanupFile(fileName);
    });

    this.fileWatchers.set(fileName, watcher);
  }

  private cleanupFile(fileName: string): void {
    // Remove from cache
    const fileData = this.cache.get(fileName);
    if (fileData?.cleanupTimer) {
      clearTimeout(fileData.cleanupTimer);
    }
    this.cache.delete(fileName);

    // Dispose file watcher
    const watcher = this.fileWatchers.get(fileName);
    if (watcher) {
      watcher.dispose();
      this.fileWatchers.delete(fileName);
    }

    // Remove from open files
    this.openFiles.delete(fileName);
  }

  private normalizePath(fileName: string): string {
    return fileName.replace(/\\/g, "/");
  }

  dispose(): void {
    // Clear all timers
    for (const fileData of this.cache.values()) {
      if (fileData.cleanupTimer) {
        clearTimeout(fileData.cleanupTimer);
      }
    }

    // Dispose all watchers
    for (const watcher of this.fileWatchers.values()) {
      watcher.dispose();
    }

    // Clear all data
    this.cache.clear();
    this.fileWatchers.clear();
    this.openFiles.clear();
  }
}
