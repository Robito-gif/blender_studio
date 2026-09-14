import * as vscode from 'vscode';
import { BlenderStudioPanel } from './blenderStudioPanel';

export class BlenderStudioSidebarProvider implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getSidebarHtml();

    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.command === 'openEditor') {
        BlenderStudioPanel.createOrShow(this.context);
      } else if (msg.command === 'openAiTab') {
        BlenderStudioPanel.createOrShow(this.context);
        BlenderStudioPanel.currentPanel?.postMessage({ command: 'openTab', tab: 'ai' });
      } else if (msg.command === 'openTextureTab') {
        BlenderStudioPanel.createOrShow(this.context);
        BlenderStudioPanel.currentPanel?.postMessage({ command: 'openTab', tab: 'texture' });
      }
    });
  }

  private getSidebarHtml(): string {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family);
    background: var(--vscode-sideBar-background);
    color: var(--vscode-foreground);
    padding: 12px;
    user-select: none;
  }
  .logo-area { text-align: center; padding: 14px 0 10px; }
  .logo-svg { width: 56px; height: 56px; display: block; margin: 0 auto 8px; }
  h2 { font-size: 14px; font-weight: 700; color: #E87D0D; letter-spacing: 0.5px; }
  .subtitle { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 3px; }
  .btn-open {
    width: 100%; margin-top: 12px; padding: 9px;
    background: #E87D0D; color: #fff; border: none;
    border-radius: 5px; font-size: 13px; font-weight: 600;
    cursor: pointer; letter-spacing: 0.3px;
  }
  .btn-open:hover { background: #F08D20; }
  .btn-sub {
    width: 100%; margin-top: 6px; padding: 7px;
    background: #2a2a2a; color: #ddd; border: 1px solid #444;
    border-radius: 5px; font-size: 11px; font-weight: 600;
    cursor: pointer; text-align: left; display: flex; align-items: center; gap: 6px;
  }
  .btn-sub:hover { background: #353535; border-color: #E87D0D88; }
  .divider { border: none; border-top: 1px solid var(--vscode-editorGroup-border); margin: 14px 0; }
  .section-title {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.8px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;
  }
  .ai-badge {
    display: inline-flex; align-items: center; gap: 4px;
    background: #1e3a2e; color: #4ade80; padding: 2px 6px;
    border-radius: 4px; font-size: 10px; font-weight: bold; margin-bottom: 8px;
  }
  .ai-badge .dot { width: 6px; height: 6px; background: #4ade80; border-radius: 50%; display: inline-block; }
  .shortcut-row {
    display: flex; justify-content: space-between; font-size: 11px;
    padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .shortcut-key {
    background: rgba(255,255,255,0.1); padding: 1px 6px;
    border-radius: 3px; font-family: monospace; font-size: 10px;
  }
  .feature-list { list-style: none; }
  .feature-list li {
    font-size: 11px; padding: 3px 0; display: flex; align-items: center; gap: 6px;
  }
  .feature-list li::before { content: "✦"; color: #E87D0D; font-size: 9px; }
</style>
</head>
<body>
  <div class="logo-area">
    <svg class="logo-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" fill="none" stroke="#C8C8C8" stroke-width="1.2"/>
      <line x1="12" y1="2" x2="12" y2="22" stroke="#888" stroke-width="0.8" stroke-dasharray="2,1"/>
      <line x1="2" y1="8" x2="22" y2="8" stroke="#888" stroke-width="0.8" stroke-dasharray="2,1"/>
      <circle cx="12" cy="12" r="3.5" fill="#E87D0D"/>
      <circle cx="12" cy="2" r="1.2" fill="#C8C8C8"/>
      <circle cx="22" cy="8" r="1.2" fill="#C8C8C8"/>
      <circle cx="2" cy="8" r="1.2" fill="#C8C8C8"/>
      <circle cx="12" cy="22" r="1.2" fill="#C8C8C8"/>
      <circle cx="22" cy="16" r="1.2" fill="#C8C8C8"/>
      <circle cx="2" cy="16" r="1.2" fill="#C8C8C8"/>
    </svg>
    <h2>BLENDER STUDIO</h2>
    <div class="subtitle">AI & 3D Modeling Studio</div>
  </div>

  <button class="btn-open" onclick="openEditor()">🚀 3D Editörü Aç</button>
  <button class="btn-sub" onclick="openAiTab()">🤖 AI Model & Script Studio</button>
  <button class="btn-sub" onclick="openTextureTab()">🎨 Texture Painter & PBR Studio</button>

  <hr class="divider">

  <div class="section-title">🤖 AI Köprüsü (Bridge API)</div>
  <div class="ai-badge"><span class="dot"></span> HTTP :37400 Aktif</div>
  <p style="font-size:10px;color:#aaa;line-height:1.4">
    Antigravity, Grok ve GitHub Copilot <code style="color:#E87D0D">/api/prompt</code>, <code style="color:#E87D0D">/api/action</code> ve <code style="color:#E87D0D">/api/code</code> üzerinden modeller ve texture üretebilir.
  </p>

  <hr class="divider">

  <div class="section-title">⌨ Blender Kısayolları</div>
  <div class="shortcut-row"><span>Taşı</span><span class="shortcut-key">G</span></div>
  <div class="shortcut-row"><span>Döndür</span><span class="shortcut-key">R</span></div>
  <div class="shortcut-row"><span>Ölçekle</span><span class="shortcut-key">S</span></div>
  <div class="shortcut-row"><span>Object ↔ Edit Modu</span><span class="shortcut-key">Tab</span></div>
  <div class="shortcut-row"><span>Extrude</span><span class="shortcut-key">E</span></div>
  <div class="shortcut-row"><span>Inset</span><span class="shortcut-key">I</span></div>
  <div class="shortcut-row"><span>Bevel</span><span class="shortcut-key">Ctrl+B</span></div>
  <div class="shortcut-row"><span>Loop Cut</span><span class="shortcut-key">Ctrl+R</span></div>
  <div class="shortcut-row"><span>Kopyala</span><span class="shortcut-key">Shift+D</span></div>
  <div class="shortcut-row"><span>Sil</span><span class="shortcut-key">X</span></div>
  <div class="shortcut-row"><span>Tümünü Seç</span><span class="shortcut-key">A</span></div>
  <div class="shortcut-row"><span>Ön görünüm</span><span class="shortcut-key">1</span></div>
  <div class="shortcut-row"><span>Yan görünüm</span><span class="shortcut-key">3</span></div>
  <div class="shortcut-row"><span>Üst görünüm</span><span class="shortcut-key">7</span></div>
  <div class="shortcut-row"><span>Perspective toggle</span><span class="shortcut-key">5</span></div>
  <div class="shortcut-row"><span>Odaklan</span><span class="shortcut-key">F</span></div>

  <hr class="divider">

  <div class="section-title">✦ Özellikler</div>
  <ul class="feature-list">
    <li>Antigravity & Grok AI Entegrasyonu</li>
    <li>GitHub Copilot Canlı 3D Scripting</li>
    <li>2D/3D Texture Painter (Fırça & Katman)</li>
    <li>Procedural PBR Doku Üretimi (8+ Doku)</li>
    <li>Object & Edit Modu (Vertex/Edge/Face)</li>
    <li>GLTF / GLB / OBJ / STL Import & Export</li>
  </ul>

  <script>
    const vscode = acquireVsCodeApi();
    function openEditor() { vscode.postMessage({ command: 'openEditor' }); }
    function openAiTab() { vscode.postMessage({ command: 'openAiTab' }); }
    function openTextureTab() { vscode.postMessage({ command: 'openTextureTab' }); }
  </script>
</body>
</html>`;
  }
}
