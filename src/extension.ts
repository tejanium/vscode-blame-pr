import * as vscode from 'vscode';
import { OpenController } from './controllers/open';
import { StatusBarController } from './controllers/statusBar';

const Cache = require('vscode-cache');

export async function activate(context: vscode.ExtensionContext) {
	const cache = new Cache(context);
	await cache.flush();

	context.subscriptions.push(
		new OpenController(cache),
		new StatusBarController(cache)
	);
}
