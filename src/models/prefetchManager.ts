import * as vscode from "vscode";
import { dirname } from "path";
import { CachedGit } from "./cachedGit";

export class PrefetchManager {
  private prefetchTimeout: NodeJS.Timeout | undefined;
  private readonly PREFETCH_DELAY = 400;

  constructor(private cache: any) {}

  dispose(): void {
    if (this.prefetchTimeout) {
      clearTimeout(this.prefetchTimeout);
    }
  }

  schedulePrefetch(
    fileName: string,
    lineNumber: number,
    editor: vscode.TextEditor
  ): void {
    if (this.prefetchTimeout) {
      clearTimeout(this.prefetchTimeout);
    }

    this.prefetchTimeout = setTimeout(() => {
      this.prefetchCurrentLine(fileName, lineNumber, editor);
    }, this.PREFETCH_DELAY);
  }

  cancelPrefetch(): void {
    if (this.prefetchTimeout) {
      clearTimeout(this.prefetchTimeout);
    }
  }

  private async prefetchCurrentLine(
    fileName: string,
    lineNumber: number,
    editor: vscode.TextEditor
  ): Promise<void> {
    const prefetchEnabled = vscode.workspace
      .getConfiguration("blame-pr")
      .get<boolean>("enablePrefetch", true);

    if (!prefetchEnabled) {
      return;
    }

    let lineContent: string | undefined;
    try {
      lineContent = editor.document.lineAt(lineNumber - 1).text;
    } catch {
      lineContent = undefined;
    }

    const git = new CachedGit(this.cache, dirname(fileName));
    await git.blame(fileName, lineNumber, lineContent);

    const { PullRequest } = await import("./pullRequest");

    const mockEditor = {
      document: editor.document,
      selection: {
        active: { line: lineNumber - 1 },
      },
    } as vscode.TextEditor;

    const pullRequest = new PullRequest(mockEditor, this.cache);
    await pullRequest.info();
  }
}
