import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getBlenderStudioHtml } from '../webview/blenderStudioHtml';

export class BlenderStudioPanel {
  public static currentPanel: BlenderStudioPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(context: vscode.ExtensionContext) {
    const column = vscode.ViewColumn.One;

    if (BlenderStudioPanel.currentPanel) {
      BlenderStudioPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'blenderStudio',
      '🟠 Blender Studio',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, 'dist')),
          vscode.Uri.file(path.join(context.extensionPath, 'assets')),
        ],
      }
    );

    BlenderStudioPanel.currentPanel = new BlenderStudioPanel(panel, context);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext
  ) {
    this.panel = panel;
    this.panel.webview.html = getBlenderStudioHtml(this.panel.webview, context.extensionUri);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (msg) => {
        switch (msg.command) {
          case 'exportFile': {
            const uri = await vscode.window.showSaveDialog({
              filters: { [msg.type.toUpperCase()]: [msg.ext] },
              defaultUri: vscode.Uri.file(
                path.join(
                  vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || require('os').homedir(),
                  'scene.' + msg.ext
                )
              ),
            });
            if (uri) {
              fs.writeFileSync(uri.fsPath, msg.data);
              vscode.window.showInformationMessage(`✅ Sahne dışa aktarıldı: ${uri.fsPath}`);
            }
            break;
          }
          case 'importFile': {
            const uris = await vscode.window.showOpenDialog({
              filters: { '3D Dosyaları': ['gltf', 'glb', 'obj', 'stl'] },
              canSelectMany: false,
            });
            if (uris && uris[0]) {
              const data = fs.readFileSync(uris[0].fsPath);
              const ext = path.extname(uris[0].fsPath).slice(1).toLowerCase();
              this.panel.webview.postMessage({
                command: 'loadFile',
                ext,
                name: path.basename(uris[0].fsPath),
                data: data.toString('base64'),
              });
            }
            break;
          }
          case 'info': {
            vscode.window.showInformationMessage(msg.text);
            break;
          }
          case 'warn': {
            vscode.window.showWarningMessage(msg.text);
            break;
          }
        }
      },
      null,
      this.disposables
    );
  }

  public postMessage(message: any) {
    this.panel.webview.postMessage(message);
  }

  public dispose() {
    BlenderStudioPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }
}
