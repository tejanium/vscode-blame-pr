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
				const pullRequestURL = await blamePR.url();

				vscode.env.openExternal(vscode.Uri.parse(pullRequestURL));
			} catch (error) {
				vscode.window.showWarningMessage(error.toString(), {});
			}
		}
	});

	context.subscriptions.push(viewGithubPR);
}
