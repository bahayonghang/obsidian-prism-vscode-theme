/** Local desktop entry. Browser builds never import the filesystem adapter. */
import * as vscode from 'vscode';
import { activate as activateTheme, deactivate } from './extension';
import { createDesktopAdapter } from './desktop-adapter';

export function activate(context: vscode.ExtensionContext): void {
  activateTheme(context, createDesktopAdapter({
    appRoot: vscode.env.appRoot,
    appName: vscode.env.appName,
    extensionRoot: context.extensionUri.fsPath,
    remote: !!vscode.env.remoteName,
    web: vscode.env.uiKind === vscode.UIKind.Web,
  }));
}
export { deactivate };
