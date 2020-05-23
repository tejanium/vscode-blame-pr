import * as vscode from 'vscode';
import { dirname } from 'path';
import { CachedGit } from './cachedGit';
import { CachedGithub } from './cachedGithub';

export class PullRequest {
	private fileName: string;
	private lineNumber: number;

	private git: CachedGit;
	private github: CachedGithub;

	constructor(editor: vscode.TextEditor, private cache: any) {
		const githubToken = vscode.workspace.getConfiguration('blame-pr').get('githubToken');

		this.fileName = editor.document.fileName;
		this.lineNumber = editor.selection.active.line + 1;

		this.git = new CachedGit(this.cache, dirname(this.fileName));
		this.github = new CachedGithub(this.cache, githubToken);
	}

	async info(): Promise<{ domain: string, owner: string, name: string, sha: string, PRId: string | undefined }> {
		const { domain, owner, name } = await this.git.config();
		const { sha, commitMessage } = await this.git.blame(this.fileName, this.lineNumber);

		const PRId = this.localID(commitMessage) || await this.remoteID(owner, name, sha);

		return { domain, owner, name, sha, PRId };
	}

	private localID(commitMessage: string): string | undefined {
		return commitMessage?.match(/\#[0-9]+/g)?.pop()?.replace('#', '');
	}

	private async remoteID(owner: string, name: string, sha: string): Promise<string | undefined> {
		return this.github.pullRequestID(owner, name, sha);
	}
}
