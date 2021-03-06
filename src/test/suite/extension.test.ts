import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { afterEach, beforeEach } from 'mocha';
import nock = require('nock');
import assert = require('assert');

const mockSpawn = require('mock-spawn')();
require('child_process').spawn = mockSpawn;

interface MockGitParams {
	config?: string;
	sha?: string;
	commitMessage?: string;
	userName?: string;
}

function mockGit({ config = 'git@github.com:owner/name.git', sha = 'sha1234567890', commitMessage, userName }: MockGitParams = {}): void {
	mockSpawn.setStrategy(function (_command: string, args: Array<string>) {
		const fileName = vscode.window.activeTextEditor?.document.fileName;

		if (args.join(',') === ['config', '--get', 'remote.origin.url'].join(',')) {
			return mockSpawn.simple(0, config);
		}

		if (args.join(',') === ['blame', '-p', fileName, '-L', `1,1`].join(',')) {
			const blame = `${sha} 1 1 1\n${userName}\n\n\n\n\n\n\n\n${commitMessage}\n\n`;

			return mockSpawn.simple(0, blame);
		}
	});
}

function configureGithubToken(sandbox: sinon.SinonSandbox, token: string): void {
	sandbox.stub(vscode.workspace, 'getConfiguration').returns({
		get: (_key: string) => token
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

suite('Test commands', () => {
	let sandbox: sinon.SinonSandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
	});

	afterEach(() => {
		sandbox.restore();
	});

	suite('blame-pr.toggleStatusbar', () => {
		test('Toggle blame info in status bar', async () => {
			const mockStatusBarItem = vscode.window.createStatusBarItem();
			sandbox.stub(vscode.window, 'createStatusBarItem').returns(mockStatusBarItem);

			const showSpy = sandbox.stub(mockStatusBarItem, 'show');
			const hideSpy = sandbox.stub(mockStatusBarItem, 'hide');

			mockGit({ userName: 'User Name', commitMessage: 'Commit message (#1)' });

			await vscode.commands.executeCommand('blame-pr.toggleStatusbar');

			sandbox.assert.calledOnce(hideSpy);
			sandbox.assert.called(showSpy);
			assert.strictEqual(mockStatusBarItem.text, '$(git-pull-request) User Name: "Commit message (#1)"');

			await vscode.commands.executeCommand('blame-pr.toggleStatusbar');
			sandbox.assert.calledTwice(hideSpy);
		});
	});

	suite('blame-pr.open', () => {
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
			const warningStub = sandbox.stub(vscode.window, 'showWarningMessage') as sinon.SinonStub<[string, any?], Thenable<string | undefined>>;

			mockGit({ sha: '0000000000000000000000000000000000000000' });

			await vscode.commands.executeCommand('blame-pr.open');

			sandbox.assert.calledWith(warningStub, 'Not Committed Yet');
		});

		test('Cannot get Git info', async () => {
			const warningStub = sandbox.stub(vscode.window, 'showWarningMessage') as sinon.SinonStub<[string, any?], Thenable<string | undefined>>;

			mockGit({ config: '' });

			await vscode.commands.executeCommand('blame-pr.open');

			sandbox.assert.calledWith(warningStub, 'Could not get Git info, please try a little later');
		});

		test('Git blame respond with code 1', async () => {
			const warningStub = sandbox.stub(vscode.window, 'showWarningMessage') as sinon.SinonStub<[string, any?], Thenable<string | undefined>>;

			mockSpawn.setStrategy(() => { return mockSpawn.simple(1); });

			await vscode.commands.executeCommand('blame-pr.open');

			sandbox.assert.calledWith(warningStub, 'Git has no remote info');
		});

		test('No Github personal token setup', async () => {
			const warningStub = sandbox.stub(vscode.window, 'showWarningMessage') as sinon.SinonStub<[string, any?], Thenable<string | undefined>>;

			mockGit();
			configureGithubToken(sandbox, '');

			await vscode.commands.executeCommand('blame-pr.open');

			sandbox.assert.calledWith(warningStub, 'Github personal access token is missing');
		});

		test('Git remote is HTTP', async () => {
			const openExternalStub = sandbox.stub(vscode.env, 'openExternal');

			mockGit({ config: 'http://github.com/owner/name.git', commitMessage: 'First PR (#1)' });

			await vscode.commands.executeCommand('blame-pr.open');

			sandbox.assert.calledWith(openExternalStub, vscode.Uri.parse('https://github.com/owner/name/pull/1'));
		});

		test('Git remote is HTTPS', async () => {
			const openExternalStub = sandbox.stub(vscode.env, 'openExternal');

			mockGit({ config: 'https://github.com/owner/name.git', commitMessage: 'First PR (#1)' });

			await vscode.commands.executeCommand('blame-pr.open');

			sandbox.assert.calledWith(openExternalStub, vscode.Uri.parse('https://github.com/owner/name/pull/1'));
		});

		suite('Github', () => {
			beforeEach(() => {
				configureGithubToken(sandbox, 'token');
				mockGit();
			});

			test('Getting data from github', async () => {
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
				const warningStub = sandbox.stub(vscode.window, 'showWarningMessage') as sinon.SinonStub<[string, any?], Thenable<string | undefined>>;

				nockGithubResponse(200, {
					"commit": null
				});

				await vscode.commands.executeCommand('blame-pr.open');

				sandbox.assert.calledWith(warningStub, 'sha1234 has no associated PR', 'Open commit URL');
			});

			test('Getting empty associated PR data from github', async () => {
				const warningStub = sandbox.stub(vscode.window, 'showWarningMessage') as sinon.SinonStub<[string, any?], Thenable<string | undefined>>;

				nockGithubResponse(200, {
					"commit": {
						"associatedPullRequests": {
							"edges": []
						}
					}
				});

				await vscode.commands.executeCommand('blame-pr.open');

				sandbox.assert.calledWith(warningStub, 'sha1234 has no associated PR', 'Open commit URL');
			});

			test('Getting no data from github', async () => {
				const warningStub = sandbox.stub(vscode.window, 'showWarningMessage') as sinon.SinonStub<[string, any?], Thenable<string | undefined>>;

				nockGithubResponse(200, null);

				await vscode.commands.executeCommand('blame-pr.open');

				sandbox.assert.calledWith(warningStub, 'sha1234 has no associated PR', 'Open commit URL');
			});

			test('Getting 500 from github', async () => {
				const warningStub = sandbox.stub(vscode.window, 'showWarningMessage') as sinon.SinonStub<[string, any?], Thenable<string | undefined>>;

				nockGithubResponse(500, null);

				await vscode.commands.executeCommand('blame-pr.open');

				sandbox.assert.calledWith(warningStub, 'Cannot contact Github');
			});

			test('Open commit URL', async () => {
				nockGithubResponse(200, null);

				const warningStub = sandbox.stub(vscode.window, 'showWarningMessage') as sinon.SinonStub<[string, any?], Thenable<string | undefined>>;
				const openExternalStub = sandbox.stub(vscode.env, 'openExternal');

				warningStub.resolves('Open commit URL');
				await vscode.commands.executeCommand('blame-pr.open');

				sandbox.assert.calledWith(openExternalStub, vscode.Uri.parse('https://github.com/owner/name/commit/sha1234567890'));
			});

			test('Not Open commit URL', async () => {
				nockGithubResponse(200, null);

				const openExternalStub = sandbox.stub(vscode.env, 'openExternal').withArgs(vscode.Uri.parse('https://github.com/owner/name/commit/sha1234567890'));

				await vscode.commands.executeCommand('blame-pr.open');

				sandbox.assert.notCalled(openExternalStub);
			});
		});
	});
});
