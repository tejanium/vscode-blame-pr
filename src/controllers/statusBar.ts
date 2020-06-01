import * as vscode from 'vscode';
import { dirname } from 'path';
import { CachedGit } from '../models/cachedGit';

export class StatusBarController {
	private disposable: vscode.Disposable;
	private statusBar: vscode.StatusBarItem;
	private enabled: boolean = false;
	private currentCursor!: string;

	constructor(private cache: any) {
		this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
		this.statusBar.command = 'blame-pr.open';

		const command = vscode.commands.registerCommand('blame-pr.toggleStatusbar', this.toggle.bind(this));

		let subscriptions: vscode.Disposable[] = [command, this.statusBar];

		vscode.window.onDidChangeTextEditorSelection(this.update, this, subscriptions);
		vscode.window.onDidChangeActiveTextEditor(this.update, this, subscriptions);

		this.disposable = vscode.Disposable.from(...subscriptions);

		this.reset();
	}

	dispose() {
		this.disposable.dispose();
	}

	private get editor(): vscode.TextEditor | undefined {
		return vscode.window.activeTextEditor;
	}

	private get lineNumber(): number | undefined {
		if (this.editor) {
			return this.editor.selection.active.line + 1;
		}
	}

	private get fileName(): string | undefined {
		if (this.editor) {
			return this.editor.document.fileName;
		}
	}

	private get cursor(): string {
		return [this.fileName, this.lineNumber].join(':');
	}

	private async toggle() {
		this.enabled = !this.enabled;
		this.update();
	}

	private async update(): Promise<void> {
		if (this.enabled) {
			if (this.currentCursor !== this.cursor) {
				this.write('$(tree-item-loading~spin)');

				this.updateStatusbar();
			}
		} else {
			this.reset();
		}
	}

	private async updateStatusbar(): Promise<void> {
		if (this.fileName && this.lineNumber) {
			const git = new CachedGit(this.cache, dirname(this.fileName));

			try {
				const { author, commitMessage } = await git.blame(this.fileName, this.lineNumber);

				this.currentCursor = this.cursor;
				this.write(`${author}: "${commitMessage}"`);
				this.statusBar.show();
			} catch {
				this.statusBar.hide();
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
		this.currentCursor = '';
		this.statusBar.hide();
	}
}
