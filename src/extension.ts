import * as vscode from 'vscode';
import { BlenderStudioPanel } from './views/blenderStudioPanel';
import { BlenderStudioSidebarProvider } from './views/sidebarProvider';
import { AIBridgeServer } from './server/aiBridgeServer';

export function activate(context: vscode.ExtensionContext) {
  // Start AI Bridge Server for Antigravity, Grok, and GitHub Copilot
  const aiServer = AIBridgeServer.start(context);

  // Sidebar provider
  const sidebarProvider = new BlenderStudioSidebarProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('blenderStudioSidebar', sidebarProvider)
  );

  // Open editor command
  const openCmd = vscode.commands.registerCommand('blenderStudio.open', () => {
    BlenderStudioPanel.createOrShow(context);
  });
  context.subscriptions.push(openCmd);

  // AI Bridge Info command
  const aiInfoCmd = vscode.commands.registerCommand('blenderStudio.aiBridgeInfo', () => {
    const port = aiServer.getPort();
    vscode.window.showInformationMessage(
      `🤖 Blender Studio AI Bridge aktif! Port: ${port} | Antigravity, Grok ve Copilot http://127.0.0.1:${port}/api üzerinden doğrudan erişebilir.`
    );
  });
  context.subscriptions.push(aiInfoCmd);

  // Auto-open on first activation
  vscode.commands.executeCommand('blenderStudio.open');
}

export function deactivate() {
  AIBridgeServer.stop();
}
