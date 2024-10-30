// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { generateModelFromTorna } from './generate_model_from_torna';
import { generateModelFromApifox } from './generate_model_from_apifox';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('torna-model-generator.generate', generateModelFromTorna);
	let disposable2 = vscode.commands.registerCommand('apifox-model-generator.generate', generateModelFromApifox);

	context.subscriptions.push(disposable, disposable2);
}

// This method is called when your extension is deactivated
export function deactivate() { }
