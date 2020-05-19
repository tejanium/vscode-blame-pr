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

				if (PRId) {
					const url = `https://${domain}/${owner}/${name}/pull/${PRId}`;

					vscode.env.openExternal(vscode.Uri.parse(url));
				} else {
					vscode.window.showWarningMessage(`${sha.substr(0, 7)} has no associated PR`, {});
				}
			} catch (error) {
				vscode.window.showWarningMessage(error.message, {});
			}
		}
	});

	context.subscriptions.push(viewGithubPR);
}
