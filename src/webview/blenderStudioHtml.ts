import * as vscode from 'vscode';

export function getBlenderStudioHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'editor.js'));

  return /* html */ `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource}; connect-src ${webview.cspSource} data: blob: http://127.0.0.1:* ws://127.0.0.1:*;">
<title>Blender Studio</title>
<style>
/* ───────── RESET & BASE ───────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 12px; background: #1a1a1a; color: #ddd; user-select: none; }
button { cursor: pointer; }
input[type=number], input[type=text], textarea { background: #2a2a2a; color: #eee; border: 1px solid #444; border-radius: 3px; padding: 3px 6px; width: 100%; outline: none; font-family: inherit; font-size: 11px; }
input[type=number]:focus, input[type=text]:focus, textarea:focus { border-color: #E87D0D; }
input[type=color] { width: 36px; height: 22px; border: none; background: none; cursor: pointer; padding: 0; }
select { background: #2a2a2a; color: #eee; border: 1px solid #444; border-radius: 3px; padding: 3px 6px; outline: none; width: 100%; }
label { color: #aaa; font-size: 11px; }
hr { border: none; border-top: 1px solid #333; margin: 6px 0; }

/* ───────── LAYOUT ───────── */
#app { display: flex; flex-direction: column; width: 100vw; height: 100vh; }

/* ── TOP BAR ── */
#topbar {
  display: flex; align-items: center; gap: 4px;
  background: #222; border-bottom: 1px solid #111;
  padding: 4px 8px; flex-shrink: 0; flex-wrap: wrap;
}
.tb-logo { font-size: 16px; margin-right: 4px; }
.tb-title { font-weight: 700; color: #E87D0D; font-size: 13px; margin-right: 8px; }
.tb-sep { width: 1px; height: 22px; background: #444; margin: 0 4px; }
.tb-menu { position: relative; }
.tb-menu > .tb-btn { font-size: 11px; }
.tb-btn {
  background: transparent; color: #ccc; border: 1px solid transparent;
  border-radius: 4px; padding: 3px 9px; font-size: 12px;
  transition: background 0.15s;
}
.tb-btn:hover { background: #333; border-color: #555; }
.tb-btn.active { background: #E87D0D22; border-color: #E87D0D88; color: #E87D0D; }

/* Mode buttons */
.mode-btn {
  background: #2a2a2a; color: #bbb; border: 1px solid #444;
  border-radius: 4px; padding: 3px 10px; font-size: 11px; font-weight: 600;
}
.mode-btn.active { background: #E87D0D; color: #fff; border-color: #E87D0D; }

/* Shading buttons */
.shade-btn {
  background: #2a2a2a; color: #bbb; border: 1px solid #444;
  border-radius: 4px; padding: 3px 8px; font-size: 11px;
}
.shade-btn.active { background: #3a3a5a; color: #aae; border-color: #66a; }

/* Viewport mode */
.vp-btn {
  background: #2a2a2a; color: #bbb; border: 1px solid #444;
  border-radius: 4px; padding: 3px 8px; font-size: 11px;
}
.vp-btn.active { background: #2a3a2a; color: #8d8; border-color: #686; }

/* Dropdown menus */
.dropdown {
  display: none; position: absolute; top: 100%; left: 0;
  background: #2a2a2a; border: 1px solid #444; border-radius: 5px;
  z-index: 100; min-width: 160px; padding: 4px 0;
}
.tb-menu:hover .dropdown { display: block; }
.dropdown-item {
  display: block; width: 100%; text-align: left;
  background: transparent; color: #ccc; border: none;
  padding: 5px 14px; font-size: 12px;
}
.dropdown-item:hover { background: #E87D0D33; color: #E87D0D; }
.dropdown-item.separator { border-top: 1px solid #444; margin-top: 2px; padding-top: 6px; }

/* ── MAIN AREA ── */
#main { display: flex; flex: 1; overflow: hidden; }

/* ── LEFT TOOLBAR ── */
#left-tools {
  width: 36px; background: #1e1e1e; border-right: 1px solid #111;
  display: flex; flex-direction: column; align-items: center;
  padding: 6px 0; gap: 2px; flex-shrink: 0;
}
.tool-btn {
  width: 28px; height: 28px; border-radius: 5px;
  background: transparent; border: 1px solid transparent;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; color: #aaa;
  transition: background 0.15s;
}
.tool-btn:hover { background: #333; }
.tool-btn.active { background: #E87D0D22; border-color: #E87D0D88; color: #E87D0D; }
.tool-sep { width: 20px; height: 1px; background: #333; margin: 4px 0; }

/* ── VIEWPORT ── */
#viewport-area { flex: 1; position: relative; overflow: hidden; }
#viewport-canvas { width: 100%; height: 100%; display: block; }

.vp-overlay {
  position: absolute; pointer-events: none;
  font-size: 11px; color: #666;
}
#vp-mode-label { top: 8px; left: 10px; font-weight: bold; color: #E87D0D; }
#vp-proj-label { top: 24px; left: 10px; }
#vp-hint { bottom: 8px; left: 10px; font-size: 10px; color: #555; }

/* Axis gizmo (top right) */
#axis-gizmo {
  position: absolute; top: 10px; right: 10px;
  pointer-events: none; border-radius: 50%;
  background: rgba(0,0,0,0.3);
}

/* Edit mode toolbar (floating inside viewport) */
#edit-toolbar {
  display: none; position: absolute; top: 10px; left: 50%;
  transform: translateX(-50%);
  background: #252525ee; border: 1px solid #444; border-radius: 6px;
  padding: 4px 8px; gap: 4px; align-items: center;
  backdrop-filter: blur(4px);
}
#edit-toolbar.visible { display: flex; }
.et-btn {
  background: #333; color: #ccc; border: 1px solid #555;
  border-radius: 4px; padding: 3px 8px; font-size: 11px;
}
.et-btn.active { background: #E87D0D; color: #fff; border-color: #E87D0D; }

/* ── RIGHT DOCK TABS & PANELS ── */
#right-panels {
  width: 290px; background: #202020; border-left: 1px solid #111;
  display: flex; flex-direction: column; flex-shrink: 0; overflow-y: auto;
}

.right-tab-bar {
  display: flex; background: #1a1a1a; border-bottom: 1px solid #111;
  flex-shrink: 0;
}
.right-tab-btn {
  flex: 1; padding: 7px 4px; background: transparent; border: none;
  border-bottom: 2px solid transparent; color: #888; font-size: 11px;
  font-weight: 600; text-align: center; cursor: pointer;
  transition: all 0.15s;
}
.right-tab-btn:hover { color: #ccc; background: #252525; }
.right-tab-btn.active { color: #E87D0D; border-bottom-color: #E87D0D; background: #222; }

/* Panels */
.panel-header {
  background: #282828; padding: 6px 10px; font-weight: 700;
  font-size: 11px; color: #E87D0D; border-bottom: 1px solid #1a1a1a;
  display: flex; justify-content: space-between; align-items: center;
  cursor: pointer;
}
.panel-body { padding: 8px 10px; }

/* Outliner */
#outliner { border-bottom: 1px solid #111; max-height: 160px; overflow-y: auto; }
.outliner-item {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 6px; border-radius: 3px; cursor: pointer;
}
.outliner-item:hover { background: #333; }
.outliner-item.selected { background: #E87D0D33; color: #E87D0D; font-weight: 600; }
.outliner-icon { font-size: 12px; }
.outliner-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.outliner-eye { font-size: 11px; opacity: 0.6; cursor: pointer; }
.outliner-eye:hover { opacity: 1; }
.outliner-eye.hidden { opacity: 0.2; }

/* Properties */
.prop-section { border-bottom: 1px solid #2a2a2a; }
.prop-section-header {
  background: #252525; padding: 5px 10px; font-size: 10px;
  font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px;
}
.prop-section-body { padding: 8px 10px; }
.prop-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.prop-row label { flex: 1; }
.prop-row input, .prop-row select { width: 140px; }
.prop-row3 { display: grid; grid-template-columns: 50px 1fr 1fr 1fr; gap: 3px; margin-bottom: 4px; align-items: center; }
.prop-row3 input { text-align: center; }
.prop-label { font-size: 11px; color: #aaa; }
.xyz-labels { display: grid; grid-template-columns: 50px 1fr 1fr 1fr; gap: 3px; margin-bottom: 2px; text-align: center; font-size: 9px; font-weight: bold; }
.xyz-label.x-label { color: #e55; }
.xyz-label.y-label { color: #5c5; }
.xyz-label.z-label { color: #55e; }

/* ── TEXTURE STUDIO UI ── */
.tex-canvas-box {
  background: #111; border: 1px solid #444; border-radius: 6px;
  padding: 6px; text-align: center; margin-bottom: 8px;
}
#tex-paint-canvas {
  width: 256px; height: 256px; display: block; margin: 0 auto;
  border-radius: 4px; cursor: crosshair; background: #222;
}
.tex-tools-row { display: flex; gap: 4px; margin-bottom: 6px; }
.tt-tool-btn {
  flex: 1; padding: 4px 2px; background: #2a2a2a; color: #ccc;
  border: 1px solid #444; border-radius: 4px; font-size: 11px;
}
.tt-tool-btn:hover { background: #353535; }
.tt-tool-btn.active { background: #E87D0D; color: #fff; border-color: #E87D0D; }

.tex-channel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 8px; }
.tex-chan-btn {
  padding: 4px; background: #282828; color: #aaa; border: 1px solid #444;
  border-radius: 4px; font-size: 10px; font-weight: 600; text-align: center;
}
.tex-chan-btn:hover { background: #333; }
.tex-chan-btn.active { background: #2d3748; color: #63b3ed; border-color: #4299e1; }

.tex-preset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 8px; }
.tex-preset-btn {
  padding: 5px; background: #252525; color: #ccc; border: 1px solid #444;
  border-radius: 4px; font-size: 10px; text-align: left; display: flex; align-items: center; gap: 4px;
}
.tex-preset-btn:hover { background: #333; border-color: #E87D0D88; }

/* ── AI STUDIO UI ── */
.ai-status-card {
  background: #182820; border: 1px solid #22543d; border-radius: 5px;
  padding: 8px; margin-bottom: 10px; font-size: 11px; color: #9ae6b4;
}
.ai-status-card .badge {
  display: inline-flex; align-items: center; gap: 4px; font-weight: bold;
}
.ai-status-card .dot { width: 6px; height: 6px; background: #48bb78; border-radius: 50%; }
.ai-btn-primary {
  width: 100%; padding: 8px; background: #E87D0D; color: #fff;
  border: none; border-radius: 5px; font-weight: bold; font-size: 12px;
  margin-top: 6px; cursor: pointer; transition: background 0.15s;
}
.ai-btn-primary:hover { background: #F08D20; }
.ai-preset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 8px 0; }
.ai-card-btn {
  padding: 6px; background: #262626; color: #ddd; border: 1px solid #444;
  border-radius: 4px; font-size: 10px; font-weight: 600; text-align: left;
}
.ai-card-btn:hover { background: #353535; border-color: #E87D0D; color: #E87D0D; }
#ai-code-editor {
  width: 100%; height: 120px; background: #161616; color: #9cdcfe;
  font-family: 'Consolas', 'Courier New', monospace; font-size: 11px;
  border: 1px solid #333; border-radius: 4px; padding: 6px; resize: vertical;
}

/* ── TIMELINE ── */
#timeline {
  height: 90px; background: #222; border-top: 1px solid #111;
  display: flex; flex-direction: column; flex-shrink: 0;
}
#timeline-header {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 8px; background: #1c1c1c; border-bottom: 1px solid #111;
}
.tl-btn {
  background: #333; color: #ccc; border: 1px solid #444;
  border-radius: 4px; padding: 2px 8px; font-size: 12px;
}
.tl-btn:hover { background: #444; }
.tl-btn.active { background: #E87D0D; color: #fff; border-color: #E87D0D; }
#frame-display { font-size: 11px; color: #aaa; }
#timeline-scrubber { flex: 1; position: relative; overflow: hidden; cursor: pointer; background: #1e1e1e; }
#tl-track { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
.kf-marker {
  position: absolute; top: 20%; height: 60%; width: 6px; margin-left: -3px;
  background: #E87D0D; border-radius: 2px; cursor: ew-resize;
}
#tl-playhead {
  position: absolute; top: 0; bottom: 0; width: 2px;
  background: #fff; pointer-events: none; opacity: 0.8;
}
.tl-ruler-tick {
  position: absolute; bottom: 0; font-size: 9px; color: #555;
  border-left: 1px solid #333; padding-left: 2px;
}

/* ── STATUS BAR ── */
#statusbar {
  background: #E87D0D; color: #fff; padding: 1px 10px;
  font-size: 10px; display: flex; gap: 12px; align-items: center;
  flex-shrink: 0;
}

/* ── CONTEXT MENU ── */
#ctx-menu {
  position: fixed; background: #2a2a2a; border: 1px solid #555;
  border-radius: 6px; z-index: 999; padding: 4px 0;
  display: none; min-width: 160px;
}
#ctx-menu.visible { display: block; }
.ctx-item {
  display: block; width: 100%; text-align: left;
  background: transparent; color: #ccc; border: none;
  padding: 5px 14px; font-size: 12px;
}
.ctx-item:hover { background: #E87D0D33; color: #E87D0D; }
.ctx-sep { border-top: 1px solid #444; margin: 3px 0; }

/* ── MODAL DIALOG ── */
#modal-overlay {
  position: fixed; inset: 0; background: #0007; z-index: 900;
  display: none; align-items: center; justify-content: center;
}
#modal-overlay.visible { display: flex; }
#modal-box {
  background: #252525; border: 1px solid #555; border-radius: 8px;
  padding: 20px; min-width: 300px; max-width: 400px;
}
#modal-title { font-size: 14px; font-weight: 700; color: #E87D0D; margin-bottom: 12px; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }
.modal-btn {
  background: #333; border: 1px solid #555; color: #ccc;
  border-radius: 5px; padding: 5px 14px; font-size: 12px;
}
.modal-btn.primary { background: #E87D0D; border-color: #E87D0D; color: #fff; }
.modal-btn:hover { opacity: 0.85; }

/* Scrollbars */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: #1a1a1a; }
::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
</style>
</head>
<body>
<div id="app">

  <!-- ═══ TOP BAR ═══ -->
  <div id="topbar">
    <span class="tb-logo">🟠</span>
    <span class="tb-title">BLENDER STUDIO</span>
    <div class="tb-sep"></div>

    <!-- File menu -->
    <div class="tb-menu">
      <button class="tb-btn">📁 Dosya ▾</button>
      <div class="dropdown">
        <button class="dropdown-item" onclick="newScene()">🆕 Yeni Sahne</button>
        <button class="dropdown-item separator" onclick="vsImport()">📥 İçe Aktar (GLTF/OBJ/STL)</button>
        <button class="dropdown-item" onclick="exportScene('gltf')">📤 GLTF olarak Dışa Aktar</button>
        <button class="dropdown-item" onclick="exportScene('obj')">📤 OBJ olarak Dışa Aktar</button>
        <button class="dropdown-item" onclick="exportScene('stl')">📤 STL olarak Dışa Aktar</button>
      </div>
    </div>

    <!-- Add mesh -->
    <div class="tb-menu">
      <button class="tb-btn">➕ Ekle ▾</button>
      <div class="dropdown">
        <button class="dropdown-item" onclick="addMesh('box')">📦 Küp (Cube)</button>
        <button class="dropdown-item" onclick="addMesh('sphere')">🔵 Küre (Sphere)</button>
        <button class="dropdown-item" onclick="addMesh('cylinder')">🥫 Silindir (Cylinder)</button>
        <button class="dropdown-item" onclick="addMesh('cone')">🔺 Koni (Cone)</button>
        <button class="dropdown-item" onclick="addMesh('torus')">🍩 Halka (Torus)</button>
        <button class="dropdown-item" onclick="addMesh('plane')">⬛ Düzlem (Plane)</button>
        <button class="dropdown-item" onclick="addMesh('icosphere')">💎 Icosphere</button>
        <button class="dropdown-item separator" onclick="addMesh('monkey')">🐵 Maymun (Suzanne)</button>
        <button class="dropdown-item separator" onclick="addLight('point')">💡 Nokta Işık</button>
        <button class="dropdown-item" onclick="addLight('dir')">☀️ Yönlü Işık</button>
        <button class="dropdown-item" onclick="addLight('spot')">🔦 Spot Işık</button>
        <button class="dropdown-item separator" onclick="addCamera()">📷 Kamera</button>
      </div>
    </div>

    <!-- Edit ops -->
    <div class="tb-menu">
      <button class="tb-btn">✏️ Düzenle ▾</button>
      <div class="dropdown">
        <button class="dropdown-item" onclick="duplicateSelected()">📋 Kopyala (Shift+D)</button>
        <button class="dropdown-item" onclick="deleteSelected()">🗑️ Sil (X)</button>
        <button class="dropdown-item separator" onclick="selectAll()">☑️ Tümünü Seç (A)</button>
        <button class="dropdown-item" onclick="deselectAll()">⬜ Seçimi Kaldır (Alt+A)</button>
        <button class="dropdown-item separator" onclick="focusSelected()">🎯 Odaklan (F)</button>
        <button class="dropdown-item" onclick="resetTransform()">↩ Transformu Sıfırla</button>
      </div>
    </div>

    <!-- Object ops -->
    <div class="tb-menu">
      <button class="tb-btn">🧊 Nesne ▾</button>
      <div class="dropdown">
        <button class="dropdown-item" onclick="applyModifier('subdivision')">🔼 Subdivision (Smooth)</button>
        <button class="dropdown-item" onclick="applyModifier('mirror')">🪞 Mirror X</button>
        <button class="dropdown-item" onclick="applyModifier('wireframe')">🔲 Wireframe</button>
        <button class="dropdown-item separator" onclick="setOriginToGeometry()">📍 Orijini Geometriye Taşı</button>
        <button class="dropdown-item" onclick="flatShading()">⬡ Flat Shading</button>
        <button class="dropdown-item" onclick="smoothShading()">⭕ Smooth Shading</button>
      </div>
    </div>

    <!-- Render ops -->
    <div class="tb-menu">
      <button class="tb-btn">🎬 Render ▾</button>
      <div class="dropdown">
        <button class="dropdown-item" onclick="renderSnapshot()">📸 Ekran Görüntüsü Al</button>
        <button class="dropdown-item" onclick="toggleEnvMap()">🌐 HDRI Ortam Haritası</button>
      </div>
    </div>

    <div class="tb-sep"></div>

    <!-- Mode buttons -->
    <button class="mode-btn active" id="btn-object-mode" onclick="setMode('object')">Object Mode</button>
    <button class="mode-btn" id="btn-edit-mode" onclick="setMode('edit')">Edit Mode</button>

    <div class="tb-sep"></div>

    <!-- Shading -->
    <button class="shade-btn active" id="shade-solid" onclick="setShading('solid')" title="Solid">◼</button>
    <button class="shade-btn" id="shade-wire" onclick="setShading('wireframe')" title="Wireframe">⬡</button>
    <button class="shade-btn" id="shade-material" onclick="setShading('material')" title="Material Preview">🎨</button>

    <div class="tb-sep"></div>

    <!-- Viewport projection -->
    <button class="vp-btn active" id="proj-persp" onclick="setProjection('perspective')" title="Perspektif">P</button>
    <button class="vp-btn" id="proj-ortho" onclick="setProjection('orthographic')" title="Ortografik">O</button>
    <button class="vp-btn" onclick="setViewAngle('front')" title="Ön Görünüm (1)">F</button>
    <button class="vp-btn" onclick="setViewAngle('right')" title="Sağ Görünüm (3)">R</button>
    <button class="vp-btn" onclick="setViewAngle('top')" title="Üst Görünüm (7)">T</button>

    <div class="tb-sep"></div>
    <span style="font-size:10px;color:#666;" id="tb-fps">FPS: --</span>
  </div>

  <!-- ═══ MAIN ═══ -->
  <div id="main">

    <!-- Left tool bar -->
    <div id="left-tools">
      <button class="tool-btn active" id="tool-select" onclick="setTool('select')" title="Seçim (Q)">⬚</button>
      <button class="tool-btn" id="tool-grab" onclick="setTool('grab')" title="Taşı (G)">✥</button>
      <button class="tool-btn" id="tool-rotate" onclick="setTool('rotate')" title="Döndür (R)">↻</button>
      <button class="tool-btn" id="tool-scale" onclick="setTool('scale')" title="Ölçekle (S)">⤢</button>
      <div class="tool-sep"></div>
      <button class="tool-btn" id="tool-extrude" onclick="setTool('extrude')" title="Extrude (E)">⬆</button>
      <button class="tool-btn" id="tool-inset" onclick="setTool('inset')" title="Inset (I)">⬡</button>
      <button class="tool-btn" id="tool-loop" onclick="setTool('loop')" title="Loop Cut (Ctrl+R)">⌇</button>
      <div class="tool-sep"></div>
      <button class="tool-btn" onclick="focusSelected()" title="Odaklan (F)">🎯</button>
      <button class="tool-btn" onclick="duplicateSelected()" title="Kopyala (Shift+D)">⧉</button>
      <button class="tool-btn" onclick="deleteSelected()" title="Sil (X)">✕</button>
    </div>

    <!-- Viewport -->
    <div id="viewport-area">
      <canvas id="viewport-canvas"></canvas>

      <!-- Overlays -->
      <div class="vp-overlay" id="vp-mode-label">Object Mode</div>
      <div class="vp-overlay" id="vp-proj-label">Perspektif</div>
      <div class="vp-overlay" id="vp-hint">LMB: Seç | G/R/S: Dönüşüm | Tab: Mod Geç</div>

      <!-- Axis gizmo canvas -->
      <canvas id="axis-gizmo" width="70" height="70"></canvas>

      <!-- Edit mode toolbar -->
      <div id="edit-toolbar">
        <button class="et-btn active" id="em-vert" onclick="setSubMode('vertex')">● Vertex (1)</button>
        <button class="et-btn" id="em-edge" onclick="setSubMode('edge')">— Edge (2)</button>
        <button class="et-btn" id="em-face" onclick="setSubMode('face')">■ Face (3)</button>
        <hr style="border-color:#444;margin:3px 0">
        <button class="et-btn" onclick="doExtrude()">⬆ Extrude (E)</button>
        <button class="et-btn" onclick="doInset()">⬡ Inset (I)</button>
        <button class="et-btn" onclick="doLoopCut()">⌇ Loop Cut (Ctrl+R)</button>
        <button class="et-btn" onclick="doBevel()">◈ Bevel (Ctrl+B)</button>
        <button class="et-btn" onclick="doSubdivide()">🔼 Subdivide</button>
        <button class="et-btn" onclick="doMergeAtCenter()">⊙ Merge at Center</button>
      </div>
    </div>

    <!-- Right panels -->
    <div id="right-panels">

      <!-- Right Tab Header -->
      <div class="right-tab-bar">
        <button class="right-tab-btn active" id="tab-btn-properties" onclick="switchRightTab('properties')">📐 Özellikler</button>
        <button class="right-tab-btn" id="tab-btn-texture" onclick="switchRightTab('texture')">🎨 Texture Studio</button>
        <button class="right-tab-btn" id="tab-btn-ai" onclick="switchRightTab('ai')">🤖 AI Studio</button>
      </div>

      <!-- ═══ TAB 1: PROPERTIES ═══ -->
      <div id="panel-view-properties">
        <!-- Outliner -->
        <div id="outliner">
          <div class="panel-header" onclick="togglePanel('outliner-body')">
            🌲 OUTLINER
            <span id="obj-count" style="color:#666">0 nesne</span>
          </div>
          <div class="panel-body" id="outliner-body"></div>
        </div>

        <!-- Transform -->
        <div class="prop-section">
          <div class="prop-section-header">📐 TRANSFORM</div>
          <div class="prop-section-body" id="props-transform">
            <div class="xyz-labels">
              <span></span>
              <span class="xyz-label x-label">X</span>
              <span class="xyz-label y-label">Y</span>
              <span class="xyz-label z-label">Z</span>
            </div>
            <div class="prop-row3">
              <span class="prop-label">Konum</span>
              <input type="number" id="px" step="0.1" onchange="applyTransform()">
              <input type="number" id="py" step="0.1" onchange="applyTransform()">
              <input type="number" id="pz" step="0.1" onchange="applyTransform()">
            </div>
            <div class="prop-row3">
              <span class="prop-label">Dönüş°</span>
              <input type="number" id="rx" step="1" onchange="applyTransform()">
              <input type="number" id="ry" step="1" onchange="applyTransform()">
              <input type="number" id="rz" step="1" onchange="applyTransform()">
            </div>
            <div class="prop-row3">
              <span class="prop-label">Ölçek</span>
              <input type="number" id="sx" step="0.1" onchange="applyTransform()">
              <input type="number" id="sy" step="0.1" onchange="applyTransform()">
              <input type="number" id="sz" step="0.1" onchange="applyTransform()">
            </div>
          </div>
        </div>

        <!-- Material -->
        <div class="prop-section">
          <div class="prop-section-header">🎨 MATERYAL (PBR)</div>
          <div class="prop-section-body">
            <div class="prop-row">
              <label>Renk</label>
              <div style="display:flex;gap:4px;align-items:center">
                <input type="color" id="mat-color" value="#7777cc" onchange="applyMaterial()">
                <input type="text" id="mat-color-hex" value="#7777cc" style="width:70px" onchange="syncColorFromHex()">
              </div>
            </div>
            <div class="prop-row">
              <label>Metalness</label>
              <input type="range" min="0" max="1" step="0.01" id="mat-metal" value="0.1" oninput="applyMaterial();updateSliderLabel('mat-metal','lbl-metal')">
            </div>
            <div style="text-align:right;font-size:10px;color:#666" id="lbl-metal">0.10</div>
            <div class="prop-row">
              <label>Roughness</label>
              <input type="range" min="0" max="1" step="0.01" id="mat-rough" value="0.4" oninput="applyMaterial();updateSliderLabel('mat-rough','lbl-rough')">
            </div>
            <div style="text-align:right;font-size:10px;color:#666" id="lbl-rough">0.40</div>
            <div class="prop-row">
              <label>Emissive</label>
              <input type="color" id="mat-emissive" value="#000000" onchange="applyMaterial()">
            </div>
            <div class="prop-row">
              <label>Wireframe</label>
              <input type="checkbox" id="mat-wire" onchange="applyMaterial()">
            </div>
            <button class="tb-btn" style="width:100%;margin-top:4px" onclick="switchRightTab('texture')">🎨 Texture Studio'yu Aç</button>
          </div>
        </div>

        <!-- Modifiers -->
        <div class="prop-section">
          <div class="prop-section-header">🔧 MODİFİER'LAR</div>
          <div class="prop-section-body">
            <button class="tb-btn" style="width:100%;margin-bottom:4px" onclick="applyModifier('subdivision')">+ Subdivision Surface</button>
            <button class="tb-btn" style="width:100%;margin-bottom:4px" onclick="applyModifier('mirror')">+ Mirror X</button>
            <button class="tb-btn" style="width:100%" onclick="applyModifier('wireframe')">+ Wireframe</button>
            <div id="modifier-list" style="margin-top:6px"></div>
          </div>
        </div>

        <!-- Object info -->
        <div class="prop-section">
          <div class="prop-section-header">ℹ️ NESNE BİLGİSİ</div>
          <div class="prop-section-body">
            <div class="prop-row">
              <label>İsim</label>
              <input type="text" id="obj-name" onchange="renameSelected()">
            </div>
            <div id="obj-info" style="font-size:10px;color:#666;margin-top:4px"></div>
          </div>
        </div>

        <!-- Animation -->
        <div class="prop-section">
          <div class="prop-section-header">🎬 ANİMASYON</div>
          <div class="prop-section-body">
            <div class="prop-row">
              <label>Kare (Frame)</label>
              <input type="number" id="anim-frame" value="1" min="1" onchange="goToFrame(this.value)">
            </div>
            <div class="prop-row">
              <label>Başlangıç</label>
              <input type="number" id="anim-start" value="1" min="1">
            </div>
            <div class="prop-row">
              <label>Bitiş</label>
              <input type="number" id="anim-end" value="120" min="1">
            </div>
            <div class="prop-row">
              <label>FPS</label>
              <input type="number" id="anim-fps" value="24" min="1" max="120">
            </div>
            <button class="tb-btn" style="width:100%;margin-top:4px" onclick="insertKeyframe()">🔑 Keyframe Ekle (I)</button>
          </div>
        </div>

        <!-- Scene settings -->
        <div class="prop-section">
          <div class="prop-section-header">🌐 SAHNE AYARLARI</div>
          <div class="prop-section-body">
            <div class="prop-row">
              <label>Arka Plan</label>
              <input type="color" id="scene-bg" value="#1a1a1a" onchange="setBgColor()">
            </div>
            <div class="prop-row">
              <label>Grid</label>
              <input type="checkbox" id="scene-grid" checked onchange="toggleGrid()">
            </div>
            <div class="prop-row">
              <label>Eksenler</label>
              <input type="checkbox" id="scene-axes" checked onchange="toggleAxes()">
            </div>
            <div class="prop-row">
              <label>Ambient</label>
              <input type="range" min="0" max="2" step="0.1" id="scene-ambient" value="0.5" oninput="setAmbient(this.value)">
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ TAB 2: TEXTURE STUDIO ═══ -->
      <div id="panel-view-texture" style="display:none;padding:8px 10px">
        <div class="prop-section-header" style="margin:-8px -10px 8px -10px">🖌️ 2D DOKU BOYAMA (PAINTER)</div>

        <!-- 2D Painting Canvas -->
        <div class="tex-canvas-box">
          <canvas id="tex-paint-canvas" width="256" height="256"></canvas>
        </div>

        <!-- Brush & Paint Tools -->
        <div class="tex-tools-row">
          <button class="tt-tool-btn active" id="tt-brush" onclick="setTexTool('brush')">🖌 Fırça</button>
          <button class="tt-tool-btn" id="tt-eraser" onclick="setTexTool('eraser')">🧹 Silgi</button>
          <button class="tt-tool-btn" id="tt-fill" onclick="setTexTool('fill')">🪣 Doldur</button>
          <button class="tt-tool-btn" id="tt-picker" onclick="setTexTool('picker')">💧 Damlalık</button>
        </div>

        <div class="prop-row">
          <label>Fırça Rengi</label>
          <div style="display:flex;gap:4px;align-items:center">
            <input type="color" id="tex-brush-color" value="#E87D0D" onchange="setBrushColor(this.value)">
            <input type="text" id="tex-brush-hex" value="#E87D0D" style="width:70px" onchange="setBrushColor(this.value)">
          </div>
        </div>

        <div class="prop-row">
          <label>Boyut: <span id="lbl-brush-size">10px</span></label>
          <input type="range" min="1" max="50" value="10" oninput="setBrushSize(this.value)">
        </div>

        <div class="prop-row">
          <label>Opaklık: <span id="lbl-brush-opacity">100%</span></label>
          <input type="range" min="0.1" max="1" step="0.05" value="1.0" oninput="setBrushOpacity(this.value)">
        </div>

        <button class="tb-btn" style="width:100%;margin-bottom:8px" onclick="clearTexCanvas()">🗑 Tuvali Temizle</button>

        <hr>

        <div class="prop-section-header" style="margin:8px -10px 8px -10px">🎯 HEDEF DOKU KANALI (PBR)</div>
        <div class="tex-channel-grid">
          <button class="tex-chan-btn active" id="tc-map" onclick="setTexChannel('map')">Base Color (Renk)</button>
          <button class="tex-chan-btn" id="tc-roughnessMap" onclick="setTexChannel('roughnessMap')">Roughness Map</button>
          <button class="tex-chan-btn" id="tc-metalnessMap" onclick="setTexChannel('metalnessMap')">Metalness Map</button>
          <button class="tex-chan-btn" id="tc-normalMap" onclick="setTexChannel('normalMap')">Normal Map</button>
          <button class="tex-chan-btn" id="tc-emissiveMap" onclick="setTexChannel('emissiveMap')">Emissive (Işıma)</button>
        </div>

        <hr>

        <div class="prop-section-header" style="margin:8px -10px 8px -10px">⚡ HAZIR PROCEDURAL DOKULAR (10 ADET)</div>
        <div class="tex-preset-grid">
          <button class="tex-preset-btn" onclick="applyPresetTexture('wood')">🌲 Ahşap Dokusu</button>
          <button class="tex-preset-btn" onclick="applyPresetTexture('brick')">🧱 Tuğla Duvar</button>
          <button class="tex-preset-btn" onclick="applyPresetTexture('carbon')">🏁 Karbon Fiber</button>
          <button class="tex-preset-btn" onclick="applyPresetTexture('hex')">⚡ Neon Hexagon</button>
          <button class="tex-preset-btn" onclick="applyPresetTexture('marble')">🏛️ Mermer Damar</button>
          <button class="tex-preset-btn" onclick="applyPresetTexture('metal')">⚙️ Fırçalanmış Metal</button>
          <button class="tex-preset-btn" onclick="applyPresetTexture('lava')">🌋 Magma / Lav</button>
          <button class="tex-preset-btn" onclick="applyPresetTexture('camo')">🪖 Kamuflaj</button>
          <button class="tex-preset-btn" onclick="applyPresetTexture('checker')">🏁 Dama Deseni</button>
          <button class="tex-preset-btn" onclick="applyPresetTexture('galaxy')">🌌 Derin Uzay / Nebula</button>
        </div>

        <hr>

        <div class="prop-section-header" style="margin:8px -10px 8px -10px">📁 DOKU İÇE / DIŞA AKTAR</div>
        <label style="display:block;margin-bottom:4px">Kendi Doku Dosyanızı Yükleyin (PNG/JPG):</label>
        <input type="file" accept="image/*" onchange="importCustomTextureFile(event)" style="font-size:10px;margin-bottom:6px">
        <button class="tb-btn" style="width:100%" onclick="exportTexturePNG()">📸 Doku PNG Olarak İndir</button>
      </div>

      <!-- ═══ TAB 3: AI STUDIO (ANTIGRAVITY / GROK / COPILOT) ═══ -->
      <div id="panel-view-ai" style="display:none;padding:8px 10px">
        <div class="prop-section-header" style="margin:-8px -10px 8px -10px">🤖 AI BRIDGE (OTOMATİK MODELLEME)</div>

        <div class="ai-status-card">
          <div class="badge"><span class="dot"></span> AI Bridge API: Online</div>
          <div style="font-size:10px;color:#aaa;margin-top:2px">Endpoint: http://127.0.0.1:37400/api</div>
        </div>

        <label style="font-weight:600;color:#E87D0D;display:block;margin-bottom:4px">Doğal Dil ile 3D Model Üret:</label>
        <textarea id="ai-prompt-input" rows="3" placeholder="Örn: Siberpunk gökdelen, mavi neon pencereler, fütüristik uzay gemisi, ortaçağ kalesi..."></textarea>
        <button class="ai-btn-primary" onclick="generateAIModel(document.getElementById('ai-prompt-input').value)">✨ 3D Model ve Doku Üret</button>

        <hr>

        <div class="prop-section-header" style="margin:8px -10px 8px -10px">📦 YÜKSEK KALİTE HAZIR AI MODELLERİ</div>
        <div class="ai-preset-grid">
          <button class="ai-card-btn" onclick="generatePresetModel('spaceship')">🚀 Uzay Gemisi</button>
          <button class="ai-card-btn" onclick="generatePresetModel('scifi_tower')">🏙️ Sci-Fi Kule</button>
          <button class="ai-card-btn" onclick="generatePresetModel('castle')">🏰 Ortaçağ Kalesi</button>
          <button class="ai-card-btn" onclick="generatePresetModel('car')">🚗 Spor Araba</button>
          <button class="ai-card-btn" onclick="generatePresetModel('robot')">🤖 Robot Droid</button>
          <button class="ai-card-btn" onclick="generatePresetModel('tree_forest')">🌲 Doğa Adası</button>
          <button class="ai-card-btn" onclick="generatePresetModel('sword')">⚔️ Efsane Kılıç</button>
          <button class="ai-card-btn" onclick="generatePresetModel('drone')">🛸 İHA Drone</button>
        </div>

        <hr>

        <div class="prop-section-header" style="margin:8px -10px 8px -10px">⚡ COPILOT / SCRIPT TERMİNALİ</div>
        <p style="font-size:10px;color:#888;margin-bottom:4px">Copilot, Grok veya Antigravity tarafından doğrudan çalıştırılabilen Three.js betik alanı:</p>
        <textarea id="ai-code-editor" placeholder="// JavaScript Three.js kodu:
const m = new THREE.Mesh(
  new THREE.TorusKnotGeometry(0.8, 0.2, 64, 16),
  createMaterial({ color: 0x00ffee, metalness: 0.9, roughness: 0.1 })
);
m.position.y = 1.5;
scene.add(m);
objects.push(m);
selectObject(m);"></textarea>
        <button class="tb-btn" style="width:100%;margin-top:4px" onclick="evalThreeCode(document.getElementById('ai-code-editor').value)">⚡ Kodu 3D Sahnede Çalıştır</button>
      </div>

    </div><!-- /right-panels -->
  </div><!-- /main -->

  <!-- Timeline -->
  <div id="timeline">
    <div id="timeline-header">
      <button class="tl-btn" onclick="tlPrev()" title="Önceki kare">⏮</button>
      <button class="tl-btn active" id="btn-play" onclick="tlPlayPause()">▶ Oynat</button>
      <button class="tl-btn" onclick="tlNext()" title="Sonraki kare">⏭</button>
      <button class="tl-btn" onclick="insertKeyframe()" title="Keyframe ekle (I)">🔑</button>
      <button class="tl-btn" onclick="deleteKeyframe()" title="Keyframe sil">🗑</button>
      <span class="tb-sep"></span>
      <span id="frame-display">Kare: 1 / 120</span>
      <span class="tb-sep"></span>
      <button class="tl-btn" onclick="clearAnimation()" style="font-size:10px">🗑 Animasyonu Temizle</button>
    </div>
    <div id="timeline-scrubber" onmousedown="tlScrubStart(event)" onmousemove="tlScrubMove(event)" onmouseup="tlScrubEnd()">
      <div id="tl-track"></div>
      <div id="tl-playhead" style="left:0"></div>
    </div>
  </div>

  <!-- Status bar -->
  <div id="statusbar">
    <span id="status-mode">Object Mode</span>
    <span>|</span>
    <span id="status-sel">Seçili: Yok</span>
    <span>|</span>
    <span id="status-verts">Vertex: 0</span>
    <span>|</span>
    <span id="status-kf">Keyframe: 0</span>
    <span>|</span>
    <span id="status-ai" style="color:#d4ff99">🤖 AI Bridge: Active (Port 37400)</span>
  </div>

</div><!-- /app -->

<!-- Context menu -->
<div id="ctx-menu">
  <button class="ctx-item" onclick="ctxDuplicate()">📋 Kopyala</button>
  <button class="ctx-item" onclick="deleteSelected()">🗑 Sil</button>
  <div class="ctx-sep"></div>
  <button class="ctx-item" onclick="setMode('edit')">✏️ Edit Moduna Geç</button>
  <button class="ctx-item" onclick="resetTransform()">↩ Transformu Sıfırla</button>
  <button class="ctx-item" onclick="focusSelected()">🎯 Odaklan</button>
  <div class="ctx-sep"></div>
  <button class="ctx-item" onclick="applyModifier('subdivision')">🔼 Subdivide</button>
  <button class="ctx-item" onclick="applyModifier('mirror')">🪞 Mirror X</button>
  <button class="ctx-item" onclick="smoothShading()">⭕ Smooth Shading</button>
</div>

<!-- Modal for rename / add mesh options -->
<div id="modal-overlay">
  <div id="modal-box">
    <div id="modal-title">Modal</div>
    <div id="modal-content"></div>
    <div class="modal-actions">
      <button class="modal-btn" onclick="closeModal()">İptal</button>
      <button class="modal-btn primary" id="modal-ok" onclick="modalOk()">Tamam</button>
    </div>
  </div>
</div>

<!-- Bundled Local Editor Script -->
<script src="${scriptUri}"></script>
</body>
</html>`;
}
