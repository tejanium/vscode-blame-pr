import { Github } from '../api/github';
import { Cached } from './cached';

export class CachedGithub extends Cached {
	private github: Github;

	constructor(cache: any, private token: string | unknown) {
		super(cache);
		this.github = new Github(token);
	}

	async pullRequestID(owner: string, name: string, sha: string): Promise<string | undefined> {
		const key = ['github', sha].join(':');

		return this.fetch(key, () => {
			return this.github.pullRequestID(owner, name, sha);
		});
	}
}
