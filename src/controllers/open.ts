import * as vscode from 'vscode';
import { PullRequest } from '../models/pullRequest';

export class OpenController {
	private disposable: vscode.Disposable;

	constructor(private cache: any) {
		this.disposable = vscode.commands.registerCommand('blame-pr.open', this.openHandler.bind(this));
	}

	dispose() {
		this.disposable.dispose();
	}

	private async openHandler() {
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const pullRequest = new PullRequest(editor, this.cache);

			try {
				const { domain, owner, name, sha, PRId } = await pullRequest.info();

				this.openBrowser(domain, owner, name, sha, PRId);
			} catch (error) {
				vscode.window.showWarningMessage(error.message);
			}
		}
	}

	private async openBrowser(domain: string, owner: string, name: string, sha: string, PRId: string | undefined): Promise<void> {
		if (PRId) {
			const url = `https://${domain}/${owner}/${name}/pull/${PRId}`;

			vscode.env.openExternal(vscode.Uri.parse(url));
		}
		else {
			const message = `${sha.substr(0, 7)} has no associated PR`;
			const response = await vscode.window.showWarningMessage(message, 'Open commit URL');

			if (response) {
				const url = `https://${domain}/${owner}/${name}/commit/${sha}`;

				vscode.env.openExternal(vscode.Uri.parse(url));
			}
		}
	}
}
