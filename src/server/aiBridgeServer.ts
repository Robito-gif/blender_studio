import * as http from 'http';
import * as vscode from 'vscode';
import { BlenderStudioPanel } from '../views/blenderStudioPanel';

export class AIBridgeServer {
  private static instance: AIBridgeServer | undefined;
  private server: http.Server | null = null;
  private port: number = 37400;

  public static start(context: vscode.ExtensionContext): AIBridgeServer {
    if (!AIBridgeServer.instance) {
      AIBridgeServer.instance = new AIBridgeServer(context);
    }
    return AIBridgeServer.instance;
  }

  public static stop() {
    if (AIBridgeServer.instance) {
      AIBridgeServer.instance.dispose();
      AIBridgeServer.instance = undefined;
    }
  }

  private constructor(private readonly context: vscode.ExtensionContext) {
    this.initServer();
  }

  private initServer() {
    this.server = http.createServer(async (req, res) => {
      // CORS headers for local AI agents, web applications, Copilot, Grok
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = req.url || '/';

      try {
        if (url === '/api/status' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'online',
            editorOpen: !!BlenderStudioPanel.currentPanel,
            port: this.port,
            bridge: 'Blender Studio AI Bridge (Antigravity / Grok / Copilot)',
            version: '1.1.0'
          }));
          return;
        }

        if (url === '/api/help' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            name: 'Blender Studio AI Bridge API',
            endpoints: [
              { path: '/api/status', method: 'GET', description: 'Get editor and server status' },
              { path: '/api/action', method: 'POST', description: 'Send commands (createMesh, setMaterial, applyTexture, executeCode)' },
              { path: '/api/prompt', method: 'POST', description: 'Generate 3D model or texture from natural language prompt' },
              { path: '/api/code', method: 'POST', description: 'Directly execute custom Three.js code in 3D scene' },
            ],
            example_prompt: {
              prompt: 'Create a cyberpunk skyscraper with glowing blue neon windows'
            },
            example_action: {
              action: 'createModel',
              preset: 'scifi_tower',
              color: '#00ffee'
            }
          }));
          return;
        }

        if ((url === '/api/action' || url === '/api/prompt' || url === '/api/code') && req.method === 'POST') {
          const body = await this.readBody(req);
          const data = JSON.parse(body || '{}');

          // Ensure editor panel is open
          if (!BlenderStudioPanel.currentPanel) {
            await vscode.commands.executeCommand('blenderStudio.open');
            // Give webview 500ms to ready
            await new Promise(r => setTimeout(r, 600));
          }

          if (url === '/api/prompt') {
            BlenderStudioPanel.currentPanel?.postMessage({
              command: 'aiGenerate',
              prompt: data.prompt || data.text || ''
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'AI model generation initiated for: ' + (data.prompt || '') }));
            return;
          }

          if (url === '/api/code') {
            BlenderStudioPanel.currentPanel?.postMessage({
              command: 'evalCode',
              code: data.code || ''
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Three.js code executed in 3D scene' }));
            return;
          }

          // /api/action
          BlenderStudioPanel.currentPanel?.postMessage({
            command: 'aiAction',
            data
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, receivedAction: data.action || 'dispatched' }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found. Use /api/help for API documentation.' }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Internal error' }));
      }
    });

    this.startListen(this.port);
  }

  private startListen(port: number) {
    this.server?.listen(port, '127.0.0.1', () => {
      this.port = port;
      console.log(`[Blender Studio] AI Bridge Server running on http://127.0.0.1:${port}`);
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} in use, trying ${port + 1}...`);
        this.startListen(port + 1);
      } else {
        console.error('[Blender Studio AI Bridge] Server error:', err);
      }
    });
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', err => reject(err));
    });
  }

  public getPort(): number {
    return this.port;
  }

  public dispose() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
