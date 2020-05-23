import * as vscode from 'vscode';

export class MockStatusBarItem implements vscode.StatusBarItem {
    public alignment!: vscode.StatusBarAlignment;
    public priority!: number;
    public text!: string;
    public tooltip!: string;
    public color!: string;
    public command!: string;
    public show(): void {};
    public hide(): void {};
    public dispose(): void {};
}
