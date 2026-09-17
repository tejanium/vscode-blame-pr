import * as vscode from "vscode";
import { dirname } from "path";
import { CachedGit } from "../models/cachedGit";
import { PrefetchManager } from "../models/prefetchManager";

export class StatusBarController {
  private disposable: vscode.Disposable;
  private statusBar: vscode.StatusBarItem;
  private enabled: boolean = false;
  private currentCursor!: string;
  private prefetchManager: PrefetchManager;

  constructor(private cache: any) {
    this.statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
    );
    this.statusBar.command = "blame-pr.open";
    this.prefetchManager = new PrefetchManager(cache);

    const command = vscode.commands.registerCommand(
      "blame-pr.toggleStatusbar",
      this.toggle.bind(this),
    );

    const subscriptions: vscode.Disposable[] = [command, this.statusBar];

    vscode.window.onDidChangeTextEditorSelection(
      this.update,
      this,
      subscriptions,
    );
    vscode.window.onDidChangeActiveTextEditor(this.update, this, subscriptions);

    this.disposable = vscode.Disposable.from(...subscriptions);

    this.reset();
  }

  dispose() {
    this.prefetchManager.dispose();
    this.disposable.dispose();
  }

  private get editor(): vscode.TextEditor | undefined {
    return vscode.window.activeTextEditor;
  }

  private get lineNumber(): number | undefined {
    return this.editor ? this.editor.selection.active.line + 1 : undefined;
  }

  private get fileName(): string | undefined {
    return this.editor?.document.fileName;
  }

  private get cursor(): string {
    return [this.fileName, this.lineNumber].join(":");
  }

  private async toggle() {
    this.enabled = !this.enabled;
    this.update();
  }

  private async update(): Promise<void> {
    if (this.enabled) {
      if (this.currentCursor !== this.cursor) {
        this.prefetchManager.cancelPrefetch();

        this.updateStatusbar();

        if (this.fileName && this.lineNumber && this.editor) {
          this.prefetchManager.schedulePrefetch(
            this.fileName,
            this.lineNumber,
            this.editor,
          );
        }
      }
    } else {
      this.reset();
    }
  }

  private async updateStatusbar(): Promise<void> {
    if (this.fileName && this.lineNumber && this.editor) {
      const git = new CachedGit(this.cache, dirname(this.fileName));

      let lineContent: string | undefined;
      try {
        lineContent = this.editor.document.lineAt(this.lineNumber - 1).text;
      } catch {
        lineContent = undefined;
      }

      // Check for cached blame first for instant display
      const cachedBlame = git.getCachedBlame(
        this.fileName,
        this.lineNumber,
        lineContent,
      );

      if (cachedBlame) {
        this.currentCursor = this.cursor;
        this.write(`${cachedBlame.author}: "${cachedBlame.commitMessage}"`);
        this.statusBar.show();
      } else {
        this.write("$(tree-item-loading~spin)");
        this.statusBar.show();

        try {
          const { author, commitMessage } = await git.blame(
            this.fileName,
            this.lineNumber,
            lineContent,
          );

          this.currentCursor = this.cursor;
          this.write(`${author}: "${commitMessage}"`);
          this.statusBar.show();
        } catch {
          this.statusBar.hide();
        }
      }
    } else {
      this.statusBar.hide();
    }
  }

  private write(text: string): void {
    this.statusBar.text = `$(git-pull-request) ${text}`;
  }

  private reset(): void {
    this.cache.flush();
    this.currentCursor = "";
    this.statusBar.hide();
    this.prefetchManager.cancelPrefetch();
  }
}
