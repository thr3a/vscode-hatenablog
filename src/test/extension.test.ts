import * as assert from 'assert';
import * as vscode from 'vscode';
import { activate } from '../extension';

suite('Extension Test Suite', () => {
	test('registers hatenablog.post command', async () => {
		const context = { subscriptions: [] as vscode.Disposable[] } as unknown as vscode.ExtensionContext;
		activate(context);
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('hatenablog.post'));
		for (const d of context.subscriptions) {
			d.dispose();
		}
	});
});
