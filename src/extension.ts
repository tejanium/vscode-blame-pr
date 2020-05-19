import * as vscode from 'vscode';
import { BlamePR } from './blamePR';

export function activate(context: vscode.ExtensionContext) {
	let viewGithubPR = vscode.commands.registerCommand('blame-pr.open', async () => {
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const fileName = editor.document.fileName;
			const lineNumber = editor.selection.active.line + 1;
			const githubToken = vscode.workspace.getConfiguration('blame-pr').get('githubToken');

			const blamePR = new BlamePR(fileName, lineNumber, githubToken);

			try {
				const { domain, owner, name, sha, PRId } = await blamePR.info();

				openBrowser(domain, owner, name, sha, PRId);
			} catch (error) {
				vscode.window.showWarningMessage(error.message);
			}
		}
	});

	context.subscriptions.push(viewGithubPR);
}

async function openBrowser(domain: string, owner: string, name: string, sha: string, PRId: string | undefined): Promise<void> {
	if (PRId) {
		const url = `https://${domain}/${owner}/${name}/pull/${PRId}`;

		vscode.env.openExternal(vscode.Uri.parse(url));
	} else {
		const message = `${sha.substr(0, 7)} has no associated PR`;
		const response = await vscode.window.showWarningMessage(message, 'Open commit URL');

		if (response) {
			const url = `https://${domain}/${owner}/${name}/commit/${sha}`;

			vscode.env.openExternal(vscode.Uri.parse(url));
		}
	}
}
