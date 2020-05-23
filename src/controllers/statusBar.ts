import * as vscode from 'vscode';
import { Git } from '../api/git';
import { dirname } from 'path';

const CACHE_EXPIRATION = 30; // s
const LOADING_TIMEOUT = 50; // ms

export class StatusBarController {
	private disposable: vscode.Disposable;
	private statusBar: vscode.StatusBarItem;
	private enabled: boolean = false;
	private timer!: NodeJS.Timeout;
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
		if (this.enabled) 	{
			if (this.currentCursor !== this.cursor) {
				this.loading();
			} else {
				this.currentCursor = this.cursor;
			}
		} else {
			this.reset();
		}
	}

	private loading(): void {
		this.write('$(tree-item-loading~spin)');

		clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.updateStatusbar();
		}, LOADING_TIMEOUT);
	}

	private async updateStatusbar(): Promise<void> {
		if (this.fileName && this.lineNumber) {
			const git = new Git(dirname(this.fileName));

			try {
				const data = this.cache.get(this.cursor) || await git.blame(this.fileName, this.lineNumber);

				if (!this.cache.has(this.cursor)) {
					this.cache.put(this.cursor, data, CACHE_EXPIRATION);
				}

				this.write(`${data.author}: "${data.commitMessage}"`);
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
		this.currentCursor = '';
		this.statusBar.hide();
	}
}
