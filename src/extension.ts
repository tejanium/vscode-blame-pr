import * as vscode from "vscode";
import { OpenController } from "./controllers/open";
import { StatusBarController } from "./controllers/statusBar";
import { MementoCache } from "./models/mementoCache";
import { FileBlameCache } from "./models/fileBlameCache";

export async function activate(context: vscode.ExtensionContext) {
  const cache = new MementoCache(context.workspaceState);
  const fileBlameCache = FileBlameCache.getInstance();

  // Track file open/close events for blame caching
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document.uri.scheme === "file") {
        fileBlameCache.onFileOpened(editor.document.fileName);
      }
    }),

    vscode.workspace.onDidCloseTextDocument((document) => {
      if (document.uri.scheme === "file") {
        fileBlameCache.onFileClosed(document.fileName);
      }
    }),
  );

  // Initialize with currently open files
  vscode.window.visibleTextEditors.forEach((editor) => {
    if (editor.document.uri.scheme === "file") {
      fileBlameCache.onFileOpened(editor.document.fileName);
    }
  });

  context.subscriptions.push(
    new OpenController(cache),
    new StatusBarController(cache),
    fileBlameCache,
  );
}

export function deactivate() {
  FileBlameCache.getInstance().dispose();
}
