import { Git } from './api/git';
import { Github } from './api/github';
import { dirname } from 'path';

export class BlamePR {
	private fileName: string;
	private lineNumber: number;

	private git: Git;
	private github: Github;

	constructor(fileName: string, lineNumber: number, githubToken: string | unknown) {
		this.fileName = fileName;
		this.lineNumber = lineNumber;

		this.git = new Git(dirname(fileName));
		this.github = new Github(githubToken);
	}

	async info(): Promise<{ domain: string, owner: string, name: string, sha: string, PRId: string }> {
		const { domain, owner, name } = await this.git.config();
		const { sha, commitMessage } = await this.git.blame(this.fileName, this.lineNumber);

		const PRId = this.localID(commitMessage) || await this.remoteID(owner, name, sha);

		return { domain, owner, name, sha, PRId };
	}

	private localID(commitMessage: string): string | undefined {
		return commitMessage?.match(/\#[0-9]+/g)?.pop()?.replace('#', '');
	}

	private async remoteID(owner: string, name: string, sha: string): Promise<string> {
		return this.github.pullRequestID(owner, name, sha);
	}
}
