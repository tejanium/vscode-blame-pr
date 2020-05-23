import { Git } from '../api/git';
import { Cached } from './cached';

export class CachedGit extends Cached {
	private git: Git;

	constructor(cache: any, private cwd: string) {
		super(cache);
		this.git = new Git(cwd);
	}

	async config(): Promise<{ domain: string, owner: string, name: string }> {
		const key = ['config', this.cwd].join(':');

		return this.fetch(key, () => {
			return this.git.config();
		});
	}

	async blame(fileName: string, lineNumber: number): Promise<{ sha: string, author: string, commitMessage: string }> {
		const key = ['blame', fileName, lineNumber].join(':');

		return this.fetch(key, () => {
			return this.git.blame(fileName, lineNumber);
		});
	}
}
