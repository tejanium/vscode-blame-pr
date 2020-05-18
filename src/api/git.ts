const spawn = require('await-spawn');

export class Git {
	private cwd: string;

	constructor(cwd: string) {
		this.cwd = cwd;
	}

	async config(): Promise<{ domain: string, owner: string, name: string }> {
		const args = ['config', '--get', 'remote.origin.url'];

		try {
			const config = await this.git(args);

			return this.parseConfig(config);
		} catch (error) {
			if (error.code === 1) {
				throw Error('Git has no remote info');
			}

			throw Error(error.message);
		}

	}

	async blame(fileName: string, lineNumber: number): Promise<{ sha: string, commitMessage: string }> {
		const args = ['blame', '-p', fileName, '-L', `${lineNumber},${lineNumber}`];
		const blame = await this.git(args);

		return this.parseBlame(blame);
	}

	private async git(args: Array<string>): Promise<string> {
		try {
			const git = await spawn('git', args, { cwd: this.cwd });

			return git.toString();
		} catch (error) {
			error.message = error.stderr?.toString() || error.message;

			throw error;
		}
	}

	private parseConfig(output: string): { domain: string, owner: string, name: string } {
		const [repoDomain, repoPath] = output.replace('\n', '').split(':');
		let domain, owner, name;

		if (repoDomain && repoPath) {
			domain = repoDomain.replace('git@', '');
			[owner, name] = repoPath.replace('.git', '').split('/');
		} else {
			throw Error('Could not get Git info, please try a little later');
		}

		return { domain, owner, name };
	}

	private parseBlame(output: string): { sha: string, commitMessage: string } {
		const gitOutput = output.split('\n');
		const sha = gitOutput[0].split(' ')[0];
		const commitMessage = gitOutput[9];

		if (sha === '0000000000000000000000000000000000000000') {
			throw Error('Not Committed Yet');
		}

		return { sha, commitMessage };
	}
}
