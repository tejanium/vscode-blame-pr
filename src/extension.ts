import * as vscode from 'vscode';
import { OpenController } from './controllers/open';
import { StatusBarController } from './controllers/statusBar';

const Cache = require('vscode-cache');

export function activate(context: vscode.ExtensionContext) {
	const cache = new Cache(context);

	context.subscriptions.push(
		new OpenController(),
		new StatusBarController(cache)
	);
}
