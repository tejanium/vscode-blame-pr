import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { afterEach, beforeEach } from 'mocha';
import nock = require('nock');

const mockSpawn = require('mock-spawn')();
require('child_process').spawn = mockSpawn;

function mockGit({
	config = 'git@github.com:owner/name.git',
	sha = 'sha1234567890',
	commitMessage = 'message'
}: { config?: string; sha?: string; commitMessage?: string; }): void {
	mockSpawn.setStrategy(function (command: string, args: Array<string>) {
		const fileName = vscode.window.activeTextEditor?.document.fileName;

		if (args.join(',') === ['config', '--get', 'remote.origin.url'].join(',')) {
			return mockSpawn.simple(0, config);
		}

		if (args.join(',') === ['blame', '-p', fileName, '-L', `1,1`].join(',')) {
			const blame = `${sha} 1 1 1\n\n\n\n\n\n\n\n\n${commitMessage}\n\n`;

			return mockSpawn.simple(0, blame);
		}
	});
}

function mockValidGit(): void {
	mockGit({});
}

function configureGithubToken(sandbox: sinon.SinonSandbox, token: string): void {
	sandbox.stub(vscode.workspace, 'getConfiguration').returns({
		get: (githubToken: string) => token
	} as vscode.WorkspaceConfiguration);
};

function nockGithubResponse(status: number, response: Object | null): void {
	nock('https://api.github.com')
		.post('/graphql')
		.reply(status, {
			"data": {
				"repository": response
			}
		});
}

suite('Test command blame-pr.open', () => {
	let sandbox: sinon.SinonSandbox;

	beforeEach(async () => {
		sandbox = sinon.createSandbox();
	});

	afterEach(() => {
		sandbox.restore();
	});

	test('Get PR ID from commit message', async () => {
		const openExternalStub = sandbox.stub(vscode.env, 'openExternal');

		mockGit({ commitMessage: 'First PR (#1)' });

		await vscode.commands.executeCommand('blame-pr.open');

		sandbox.assert.calledWith(openExternalStub, vscode.Uri.parse('https://github.com/owner/name/pull/1'));
	});

	test('Duplicate PR ID, usually revert', async () => {
		const openExternalStub = sandbox.stub(vscode.env, 'openExternal');

		mockGit({ commitMessage: 'Revert "First PR (#1)" (#2)' });

		await vscode.commands.executeCommand('blame-pr.open');

		sandbox.assert.calledWith(openExternalStub, vscode.Uri.parse('https://github.com/owner/name/pull/2'));
	});

	test('Get PR URL from Github enterprise', async () => {
		const openExternalStub = sandbox.stub(vscode.env, 'openExternal');

		mockGit({ config: 'git@gh-enterprise.com:owner/name.git', commitMessage: 'First PR (#1)' });

		await vscode.commands.executeCommand('blame-pr.open');

		sandbox.assert.calledWith(openExternalStub, vscode.Uri.parse('https://gh-enterprise.com/owner/name/pull/1'));
	});

	test('Not yet committed', async () => {
		const warningStub = sandbox.stub(vscode.window, 'showWarningMessage');

		mockGit({ sha: '0000000000000000000000000000000000000000' });

		await vscode.commands.executeCommand('blame-pr.open');

		sandbox.assert.calledWith(warningStub, ('Error: Not Committed Yet'), {});
	});

	test('Cannot get Git info', async () => {
		const warningStub = sandbox.stub(vscode.window, 'showWarningMessage');

		mockGit({ config: '' });

		await vscode.commands.executeCommand('blame-pr.open');

		sandbox.assert.calledWith(warningStub, ('Error: Could not get Git info, please try a little later'), {});
	});

	test('Git blame respond with code 1', async () => {
		const warningStub = sandbox.stub(vscode.window, 'showWarningMessage');

		mockSpawn.setStrategy(() => { return mockSpawn.simple(1); });

		await vscode.commands.executeCommand('blame-pr.open');

		sandbox.assert.calledWith(warningStub, ('Error: Git has no remote info'), {});
	});

	test('No Github personal token setup', async () => {
		const warningStub = sandbox.stub(vscode.window, 'showWarningMessage');

		mockValidGit();
		configureGithubToken(sandbox, '');

		await vscode.commands.executeCommand('blame-pr.open');

		sandbox.assert.calledWith(warningStub, ('Error: Github personal access token is missing'), {});
	});

	test('Getting data from github', async () => {
		mockValidGit(); configureGithubToken(sandbox, 'token');

		const openExternalStub = sandbox.stub(vscode.env, 'openExternal');

		nockGithubResponse(200, {
			"commit": {
				"associatedPullRequests": {
					"edges": [
						{
							"node": {
								"number": 10
							}
						}
					]
				}
			}
		});

		await vscode.commands.executeCommand('blame-pr.open');

		sandbox.assert.calledWith(openExternalStub, vscode.Uri.parse('https://github.com/owner/name/pull/10'));
	});

	test('Getting no associated PR data from github', async () => {
		mockValidGit(); configureGithubToken(sandbox, 'token');

		const warningStub = sandbox.stub(vscode.window, 'showWarningMessage');

		nockGithubResponse(200, {
			"commit": null
		});

		await vscode.commands.executeCommand('blame-pr.open');

		sandbox.assert.calledWith(warningStub, ('Error: sha1234 has no associated PR'), {});
	});

	test('Getting empty associated PR data from github', async () => {
		mockValidGit(); configureGithubToken(sandbox, 'token');

		const warningStub = sandbox.stub(vscode.window, 'showWarningMessage');

		nockGithubResponse(200, {
			"commit": {
				"associatedPullRequests": {
					"edges": []
				}
			}
		});

		await vscode.commands.executeCommand('blame-pr.open');

		sandbox.assert.calledWith(warningStub, ('Error: sha1234 has no associated PR'), {});
	});

	test('Getting no data from github', async () => {
		mockValidGit(); configureGithubToken(sandbox, 'token');

		const warningStub = sandbox.stub(vscode.window, 'showWarningMessage');

		nockGithubResponse(200, null);

		await vscode.commands.executeCommand('blame-pr.open');

		sandbox.assert.calledWith(warningStub, ('Error: sha1234 has no associated PR'), {});
	});

	test('Getting 500 from github', async () => {
		mockValidGit(); configureGithubToken(sandbox, 'token');

		const warningStub = sandbox.stub(vscode.window, 'showWarningMessage');

		nockGithubResponse(500, null);

		await vscode.commands.executeCommand('blame-pr.open');

		sandbox.assert.calledWith(warningStub, ('Error: cannot contact Github'), {});
	});
});
