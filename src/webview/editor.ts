import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';

// ── VS Code API ──
declare function acquireVsCodeApi(): any;
let vscode: any;
try {
  vscode = acquireVsCodeApi();
} catch (e) {
  vscode = null;
}

function vsPost(msg: any) {
  if (vscode) vscode.postMessage(msg);
}
function vsInfo(t: string) {
  vsPost({ command: 'info', text: t });
}
function vsWarn(t: string) {
  vsPost({ command: 'warn', text: t });
}

// ── THREE GLOBALS ──
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
let orbitControls: OrbitControls;
let transformControls: TransformControls;
let animFrameId: number;
let clock: THREE.Clock;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let gridHelper: THREE.GridHelper;
let axesHelper: THREE.AxesHelper;
let ambientLight: THREE.AmbientLight;
let hemiLight: THREE.HemisphereLight;

// ── STATE ──
interface KeyframeData {
  frame: number;
  pos: THREE.Vector3;
  rot: THREE.Euler;
  scale: THREE.Vector3;
}

const state: {
  mode: 'object' | 'edit';
  subMode: 'vertex' | 'edge' | 'face';
  tool: string;
  shading: string;
  projection: string;
  selected: THREE.Mesh | any | null;
  hovered: any;
  editMesh: THREE.Mesh | null;
  selectedVerts: Set<number>;
  selectedEdges: Set<number>;
  selectedFaces: Set<number>;
  transformActive: boolean;
  transformAxis: string | null;
  keyframes: Record<string, KeyframeData[]>;
  currentFrame: number;
  startFrame: number;
  endFrame: number;
  fps: number;
  playing: boolean;
  playInterval: any;
  tlScrubbing: boolean;
  modalCallback: (() => void) | null;
  editHighlights: THREE.Mesh[];
  modifiers: Record<string, string[]>;
  counters: { mesh: number; light: number; camera: number };
  // Texture Studio State
  texCanvas: HTMLCanvasElement | null;
  texCtx: CanvasRenderingContext2D | null;
  texChannel: 'map' | 'roughnessMap' | 'metalnessMap' | 'normalMap' | 'emissiveMap';
  texTool: 'brush' | 'eraser' | 'fill' | 'picker';
  brushColor: string;
  brushSize: number;
  brushOpacity: number;
  isPainting: boolean;
  lastPaintPos: { x: number; y: number } | null;
} = {
  mode: 'object',
  subMode: 'vertex',
  tool: 'select',
  shading: 'solid',
  projection: 'perspective',
  selected: null,
  hovered: null,
  editMesh: null,
  selectedVerts: new Set(),
  selectedEdges: new Set(),
  selectedFaces: new Set(),
  transformActive: false,
  transformAxis: null,
  keyframes: {},
  currentFrame: 1,
  startFrame: 1,
  endFrame: 120,
  fps: 24,
  playing: false,
  playInterval: null,
  tlScrubbing: false,
  modalCallback: null,
  editHighlights: [],
  modifiers: {},
  counters: { mesh: 0, light: 0, camera: 0 },
  // Texture Studio State
  texCanvas: null,
  texCtx: null,
  texChannel: 'map',
  texTool: 'brush',
  brushColor: '#E87D0D',
  brushSize: 10,
  brushOpacity: 1.0,
  isPainting: false,
  lastPaintPos: null,
};

const objects: any[] = [];

// ── INIT ──
export function init() {
  const canvas = document.getElementById('viewport-canvas') as HTMLCanvasElement;
  if (!canvas) return;

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  (renderer as any).outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  resize();

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  // Camera
  const vpa = document.getElementById('viewport-area');
  const w = vpa ? vpa.clientWidth : window.innerWidth;
  const h = vpa ? vpa.clientHeight : window.innerHeight;
  camera = new THREE.PerspectiveCamera(60, w / Math.max(h, 1), 0.01, 10000);
  camera.position.set(5, 4, 6);

  // Lights
  ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 7);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  scene.add(dirLight);

  // Grid
  gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x2a2a2a);
  scene.add(gridHelper);

  // Axes
  axesHelper = new THREE.AxesHelper(1.5);
  scene.add(axesHelper);

  // OrbitControls
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.screenSpacePanning = true;
  orbitControls.maxPolarAngle = Math.PI;

  // TransformControls
  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.addEventListener('dragging-changed', (e: any) => {
    orbitControls.enabled = !e.value;
    state.transformActive = e.value;
  });
  transformControls.addEventListener('change', () => {
    updatePropertiesPanel();
  });
  scene.add(transformControls.getHelper());

  // Raycaster
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  clock = new THREE.Clock();

  // Default initial cube
  addMesh('box');

  // Initialize Texture Studio Paint Canvas
  initTexturePaintCanvas();

  // Events
  setupEvents();

  // Timeline
  buildTimelineRuler();

  // Start render loop
  animate();
}

// ── RENDER LOOP ──
let fpsCounter = 0;
let fpsTime = 0;
function animate() {
  animFrameId = requestAnimationFrame(animate);
  const delta = clock.getDelta();
  orbitControls.update();

  fpsCounter++;
  fpsTime += delta;
  if (fpsTime >= 1) {
    const fpsEl = document.getElementById('tb-fps');
    if (fpsEl) fpsEl.textContent = 'FPS: ' + fpsCounter;
    fpsCounter = 0;
    fpsTime = 0;
  }

  if (state.playing) {
    updatePlayback(delta);
  }

  renderer.render(scene, camera);
  drawAxisGizmo();
}

// ── RESIZE ──
function resize() {
  const vpa = document.getElementById('viewport-area');
  if (!vpa || !renderer) return;
  const w = vpa.clientWidth;
  const h = vpa.clientHeight;
  renderer.setSize(w, h, false);
  if (camera) {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      (camera as THREE.PerspectiveCamera).aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    }
  }
}
window.addEventListener('resize', resize);

// ── AXIS GIZMO ──
function drawAxisGizmo() {
  const c = document.getElementById('axis-gizmo') as HTMLCanvasElement;
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const cx = 35;
  const cy = 35;
  const r = 28;
  ctx.clearRect(0, 0, 70, 70);

  const proj = new THREE.Vector3();
  const axes = [
    { dir: new THREE.Vector3(1, 0, 0), label: 'X', color: '#d55' },
    { dir: new THREE.Vector3(0, 1, 0), label: 'Y', color: '#5a5' },
    { dir: new THREE.Vector3(0, 0, 1), label: 'Z', color: '#55d' },
  ];

  const mat = new THREE.Matrix4().extractRotation(camera.matrixWorldInverse);
  axes.forEach((ax) => {
    proj.copy(ax.dir).applyMatrix4(mat);
    const ex = cx + proj.x * r;
    const ey = cy - proj.y * r;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = ax.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = ax.color;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ax.label, ex + (ex - cx) * 0.2, ey + (ey - cy) * 0.2);
  });
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#aaa';
  ctx.fill();
}

// ── MESH & OBJECT CREATION ──
const matDefaults = { color: 0x7777cc, metalness: 0.1, roughness: 0.4 };

function createMaterial(params: any = {}) {
  return new THREE.MeshStandardMaterial({
    color: params.color !== undefined ? params.color : matDefaults.color,
    metalness: params.metalness !== undefined ? params.metalness : matDefaults.metalness,
    roughness: params.roughness !== undefined ? params.roughness : matDefaults.roughness,
    wireframe: params.wireframe || false,
  });
}

function addMesh(type: string) {
  let geo: THREE.BufferGeometry;
  switch (type) {
    case 'box':
      geo = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
      break;
    case 'sphere':
      geo = new THREE.SphereGeometry(0.6, 32, 16);
      break;
    case 'cylinder':
      geo = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32);
      break;
    case 'cone':
      geo = new THREE.ConeGeometry(0.6, 1.5, 32);
      break;
    case 'torus':
      geo = new THREE.TorusGeometry(0.6, 0.2, 16, 64);
      break;
    case 'plane':
      geo = new THREE.PlaneGeometry(2, 2, 4, 4);
      break;
    case 'icosphere':
      geo = new THREE.IcosahedronGeometry(0.7, 2);
      break;
    case 'monkey':
      geo = createMonkeyGeo();
      break;
    default:
      geo = new THREE.BoxGeometry(1, 1, 1);
      break;
  }

  const mat = createMaterial();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  state.counters.mesh++;
  mesh.name = (type === 'monkey' ? 'Suzanne' : capitalize(type)) + '.' + String(state.counters.mesh).padStart(3, '0');
  mesh.userData = { type: 'mesh', meshType: type, modifiers: [] };

  scene.add(mesh);
  objects.push(mesh);

  selectObject(mesh);
  updateOutliner();
  return mesh;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function createMonkeyGeo(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(0.7, 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setX(i, x * 1.2);
    pos.setY(i, y * 1.0);
    pos.setZ(i, z * 0.9);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function addLight(type: string) {
  let light: THREE.Light;
  state.counters.light++;
  const name = capitalize(type) + 'Light.' + String(state.counters.light).padStart(3, '0');

  if (type === 'point') {
    light = new THREE.PointLight(0xffffff, 1.5, 20);
    light.castShadow = true;
    light.position.set(2, 4, 2);
  } else if (type === 'dir') {
    light = new THREE.DirectionalLight(0xffffff, 1.0);
    light.castShadow = true;
    light.position.set(5, 8, 5);
  } else {
    light = new THREE.SpotLight(0xffffff, 2.0, 20, Math.PI / 6);
    light.castShadow = true;
    light.position.set(3, 5, 3);
  }

  light.name = name;
  light.userData = { type: 'light', lightType: type };

  const geo = new THREE.SphereGeometry(0.15, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffff44 });
  const proxy = new THREE.Mesh(geo, mat);
  proxy.name = name;
  proxy.userData = { type: 'lightProxy', light };
  proxy.position.copy(light.position);
  scene.add(proxy);
  scene.add(light);
  objects.push(proxy);

  updateOutliner();
}

function addCamera() {
  state.counters.camera++;
  const name = 'Camera.' + String(state.counters.camera).padStart(3, '0');
  const geo = new THREE.ConeGeometry(0.15, 0.3, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0x44aaff });
  const proxy = new THREE.Mesh(geo, mat);
  proxy.name = name;
  proxy.userData = { type: 'camera' };
  proxy.position.set(0, 1, 3);
  scene.add(proxy);
  objects.push(proxy);
  updateOutliner();
}

// ── SELECTION ──
function selectObject(obj: any) {
  if (state.selected && state.selected.material) {
    if (state.selected.material.emissive) state.selected.material.emissive.set(0x000000);
  }
  if (state.mode === 'edit') exitEditMode();

  state.selected = obj;
  transformControls.detach();

  if (obj) {
    if (obj.material && obj.material.emissive) {
      obj.material.emissive.set(0x222200);
    }
    transformControls.attach(obj);
    updatePropertiesPanel();
    const selEl = document.getElementById('status-sel');
    if (selEl) selEl.textContent = 'Seçili: ' + obj.name;

    if (obj.geometry) {
      const count = obj.geometry.attributes.position ? obj.geometry.attributes.position.count : 0;
      const vEl = document.getElementById('status-verts');
      if (vEl) vEl.textContent = 'Vertex: ' + count;
    }
  } else {
    const selEl = document.getElementById('status-sel');
    if (selEl) selEl.textContent = 'Seçili: Yok';
    const vEl = document.getElementById('status-verts');
    if (vEl) vEl.textContent = 'Vertex: 0';
  }

  updateOutliner();
}

// ── MODES ──
function setMode(mode: 'object' | 'edit') {
  if (mode === 'edit' && (!state.selected || state.selected.userData.type !== 'mesh')) {
    vsWarn('Edit moduna girmek için bir mesh seçmelisiniz!');
    return;
  }
  if (state.mode === 'edit' && mode === 'object') exitEditMode();

  state.mode = mode;
  document.getElementById('btn-object-mode')?.classList.toggle('active', mode === 'object');
  document.getElementById('btn-edit-mode')?.classList.toggle('active', mode === 'edit');
  const vml = document.getElementById('vp-mode-label');
  if (vml) vml.textContent = mode === 'object' ? 'Object Mode' : 'Edit Mode';
  const sm = document.getElementById('status-mode');
  if (sm) sm.textContent = mode === 'object' ? 'Object Mode' : 'Edit Mode';
  document.getElementById('edit-toolbar')?.classList.toggle('visible', mode === 'edit');

  if (mode === 'edit') enterEditMode();
}

function enterEditMode() {
  if (!state.selected) return;
  state.editMesh = state.selected;
  transformControls.detach();
  buildEditHelpers();
}

function exitEditMode() {
  clearEditHelpers();
  state.selectedVerts.clear();
  state.selectedEdges.clear();
  state.selectedFaces.clear();
  state.editMesh = null;
}

function buildEditHelpers() {
  clearEditHelpers();
  if (!state.editMesh || !state.editMesh.geometry) return;

  const geo = state.editMesh.geometry;
  const pos = geo.attributes.position;
  const worldMat = state.editMesh.matrixWorld;

  if (state.subMode === 'vertex') {
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      v.applyMatrix4(worldMat);
      const sphereGeo = new THREE.SphereGeometry(0.025, 6, 6);
      const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff8800 });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.copy(v);
      sphere.userData = { type: 'editHelper', vertIndex: i };
      scene.add(sphere);
      state.editHighlights.push(sphere);
    }
  } else if (state.subMode === 'face') {
    const index = geo.index;
    const faces = index ? index.count / 3 : pos.count / 3;
    for (let f = 0; f < faces; f++) {
      let ia = f * 3;
      let ib = f * 3 + 1;
      let ic = f * 3 + 2;
      if (index) {
        ia = index.getX(ia);
        ib = index.getX(ib);
        ic = index.getX(ic);
      }
      const a = new THREE.Vector3(pos.getX(ia), pos.getY(ia), pos.getZ(ia));
      const b = new THREE.Vector3(pos.getX(ib), pos.getY(ib), pos.getZ(ib));
      const c2 = new THREE.Vector3(pos.getX(ic), pos.getY(ic), pos.getZ(ic));
      const center = new THREE.Vector3().addVectors(a, b).add(c2).divideScalar(3);
      center.applyMatrix4(worldMat);
      const sg = new THREE.SphereGeometry(0.02, 4, 4);
      const sm = new THREE.MeshBasicMaterial({ color: 0x4488ff });
      const sp = new THREE.Mesh(sg, sm);
      sp.position.copy(center);
      sp.userData = { type: 'editHelper', faceIndex: f };
      scene.add(sp);
      state.editHighlights.push(sp);
    }
  }
}

function clearEditHelpers() {
  state.editHighlights.forEach((h) => scene.remove(h));
  state.editHighlights = [];
}

function setSubMode(m: 'vertex' | 'edge' | 'face') {
  state.subMode = m;
  ['vertex', 'edge', 'face'].forEach((s) => {
    document.getElementById('em-' + (s === 'vertex' ? 'vert' : s))?.classList.toggle('active', s === m);
  });
  buildEditHelpers();
}

// ── TOOLS ──
function setTool(t: string) {
  state.tool = t;
  document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
  const btn = document.getElementById('tool-' + t);
  if (btn) btn.classList.add('active');

  if (['grab', 'rotate', 'scale'].includes(t)) {
    const modeMap: Record<string, 'translate' | 'rotate' | 'scale'> = {
      grab: 'translate',
      rotate: 'rotate',
      scale: 'scale',
    };
    transformControls.setMode(modeMap[t]);
  } else {
    transformControls.setMode('translate');
  }
}

// ── TRANSFORM ──
const DEG = Math.PI / 180;

function applyTransform() {
  if (!state.selected) return;
  const obj = state.selected;
  const px = parseFloat((document.getElementById('px') as HTMLInputElement)?.value) || 0;
  const py = parseFloat((document.getElementById('py') as HTMLInputElement)?.value) || 0;
  const pz = parseFloat((document.getElementById('pz') as HTMLInputElement)?.value) || 0;
  const rx = parseFloat((document.getElementById('rx') as HTMLInputElement)?.value) || 0;
  const ry = parseFloat((document.getElementById('ry') as HTMLInputElement)?.value) || 0;
  const rz = parseFloat((document.getElementById('rz') as HTMLInputElement)?.value) || 0;
  const sx = parseFloat((document.getElementById('sx') as HTMLInputElement)?.value) || 1;
  const sy = parseFloat((document.getElementById('sy') as HTMLInputElement)?.value) || 1;
  const sz = parseFloat((document.getElementById('sz') as HTMLInputElement)?.value) || 1;

  obj.position.set(px, py, pz);
  obj.rotation.set(rx * DEG, ry * DEG, rz * DEG);
  obj.scale.set(sx, sy, sz);
}

function updatePropertiesPanel() {
  if (!state.selected) return;
  const obj = state.selected;
  const r = obj.rotation;
  const s = obj.scale;
  const p = obj.position;

  setVal('px', round3(p.x));
  setVal('py', round3(p.y));
  setVal('pz', round3(p.z));
  setVal('rx', round3(r.x / DEG));
  setVal('ry', round3(r.y / DEG));
  setVal('rz', round3(r.z / DEG));
  setVal('sx', round3(s.x));
  setVal('sy', round3(s.y));
  setVal('sz', round3(s.z));
  setVal('obj-name', obj.name);

  if (obj.geometry) {
    const vc = obj.geometry.attributes.position ? obj.geometry.attributes.position.count : 0;
    const fc = obj.geometry.index ? obj.geometry.index.count / 3 : vc / 3;
    const oi = document.getElementById('obj-info');
    if (oi) oi.textContent = 'Vertex: ' + vc + '  |  Yüz: ' + Math.floor(fc);
  }

  if (obj.material) {
    const colorHex = '#' + obj.material.color.getHexString();
    setVal('mat-color', colorHex);
    setVal('mat-color-hex', colorHex);
    setVal('mat-metal', String(obj.material.metalness || 0));
    setVal('mat-rough', String(obj.material.roughness !== undefined ? obj.material.roughness : 0.5));
    setVal('mat-emissive', obj.material.emissive ? '#' + obj.material.emissive.getHexString() : '#000000');
    const mw = document.getElementById('mat-wire') as HTMLInputElement;
    if (mw) mw.checked = obj.material.wireframe || false;
    updateSliderLabel('mat-metal', 'lbl-metal');
    updateSliderLabel('mat-rough', 'lbl-rough');
  }

  updateModifierList();
}

function setVal(id: string, v: string | number) {
  const el = document.getElementById(id) as HTMLInputElement;
  if (el) el.value = String(v);
}
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
function updateSliderLabel(sliderId: string, labelId: string) {
  const el = document.getElementById(sliderId) as HTMLInputElement;
  const lbl = document.getElementById(labelId);
  if (el && lbl) {
    lbl.textContent = parseFloat(el.value).toFixed(2);
  }
}

function resetTransform() {
  if (!state.selected) return;
  state.selected.position.set(0, 0, 0);
  state.selected.rotation.set(0, 0, 0);
  state.selected.scale.set(1, 1, 1);
  updatePropertiesPanel();
}

// ── MATERIAL & BASIC TEXTURE ──
function applyMaterial() {
  if (!state.selected || !state.selected.material) return;
  const mat = state.selected.material;
  const mc = (document.getElementById('mat-color') as HTMLInputElement)?.value;
  const mm = (document.getElementById('mat-metal') as HTMLInputElement)?.value;
  const mr = (document.getElementById('mat-rough') as HTMLInputElement)?.value;
  const me = (document.getElementById('mat-emissive') as HTMLInputElement)?.value;
  const mw = (document.getElementById('mat-wire') as HTMLInputElement)?.checked;

  if (mc) mat.color.set(mc);
  if (mm) mat.metalness = parseFloat(mm);
  if (mr) mat.roughness = parseFloat(mr);
  if (me) mat.emissive.set(me);
  if (mw !== undefined) mat.wireframe = mw;
  mat.needsUpdate = true;
}

function syncColorFromHex() {
  const hex = (document.getElementById('mat-color-hex') as HTMLInputElement)?.value;
  setVal('mat-color', hex);
  applyMaterial();
}

// ═══════════════════════════════════════════════════════════════════
//  🎨 ADVANCED TEXTURE STUDIO & PAINTER ENGINE
// ═══════════════════════════════════════════════════════════════════

function initTexturePaintCanvas() {
  const c = document.getElementById('tex-paint-canvas') as HTMLCanvasElement;
  if (!c) return;
  state.texCanvas = c;
  state.texCtx = c.getContext('2d', { willReadFrequently: true });
  if (state.texCtx) {
    state.texCtx.fillStyle = '#445577';
    state.texCtx.fillRect(0, 0, c.width, c.height);
  }

  // Paint events on 2D texture canvas
  c.addEventListener('mousedown', (e) => {
    state.isPainting = true;
    paintOnCanvas(e);
  });

  c.addEventListener('mousemove', (e) => {
    if (!state.isPainting) return;
    paintOnCanvas(e);
  });

  window.addEventListener('mouseup', () => {
    if (state.isPainting) {
      state.isPainting = false;
      state.lastPaintPos = null;
      syncCanvasToSelectedMesh();
    }
  });
}

function paintOnCanvas(e: MouseEvent) {
  if (!state.texCanvas || !state.texCtx) return;
  const rect = state.texCanvas.getBoundingClientRect();
  const scaleX = state.texCanvas.width / rect.width;
  const scaleY = state.texCanvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  const ctx = state.texCtx;

  if (state.texTool === 'picker') {
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = '#' + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
    setBrushColor(hex);
    state.isPainting = false;
    return;
  }

  if (state.texTool === 'fill') {
    ctx.fillStyle = state.brushColor;
    ctx.fillRect(0, 0, state.texCanvas.width, state.texCanvas.height);
    syncCanvasToSelectedMesh();
    return;
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = state.brushSize;

  if (state.texTool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = state.brushColor;
    ctx.globalAlpha = state.brushOpacity;
  }

  ctx.beginPath();
  if (state.lastPaintPos) {
    ctx.moveTo(state.lastPaintPos.x, state.lastPaintPos.y);
    ctx.lineTo(x, y);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
  }
  ctx.stroke();
  ctx.restore();

  state.lastPaintPos = { x, y };
  syncCanvasToSelectedMesh();
}

function syncCanvasToSelectedMesh() {
  if (!state.selected || !state.selected.material || !state.texCanvas) return;
  const mat = state.selected.material;
  const texture = new THREE.CanvasTexture(state.texCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;

  if (state.texChannel === 'map') {
    mat.map = texture;
  } else if (state.texChannel === 'roughnessMap') {
    mat.roughnessMap = texture;
  } else if (state.texChannel === 'metalnessMap') {
    mat.metalnessMap = texture;
  } else if (state.texChannel === 'normalMap') {
    mat.normalMap = texture;
    mat.normalScale = new THREE.Vector2(1, 1);
  } else if (state.texChannel === 'emissiveMap') {
    mat.emissiveMap = texture;
    mat.emissive = new THREE.Color(0xffffff);
  }
  mat.needsUpdate = true;
}

function setTexTool(tool: 'brush' | 'eraser' | 'fill' | 'picker') {
  state.texTool = tool;
  document.querySelectorAll('.tt-tool-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById('tt-' + tool)?.classList.add('active');
}

function setBrushColor(color: string) {
  state.brushColor = color;
  const bi = document.getElementById('tex-brush-color') as HTMLInputElement;
  if (bi) bi.value = color;
  const bih = document.getElementById('tex-brush-hex') as HTMLInputElement;
  if (bih) bih.value = color;
}

function setBrushSize(size: number) {
  state.brushSize = size;
  const lbl = document.getElementById('lbl-brush-size');
  if (lbl) lbl.textContent = String(size) + 'px';
}

function setBrushOpacity(opacity: number) {
  state.brushOpacity = opacity;
  const lbl = document.getElementById('lbl-brush-opacity');
  if (lbl) lbl.textContent = Math.round(opacity * 100) + '%';
}

function clearTexCanvas() {
  if (!state.texCanvas || !state.texCtx) return;
  state.texCtx.fillStyle = '#222222';
  state.texCtx.fillRect(0, 0, state.texCanvas.width, state.texCanvas.height);
  syncCanvasToSelectedMesh();
  vsInfo('🎨 Doku tuvali temizlendi.');
}

function setTexChannel(channel: 'map' | 'roughnessMap' | 'metalnessMap' | 'normalMap' | 'emissiveMap') {
  state.texChannel = channel;
  document.querySelectorAll('.tex-chan-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById('tc-' + channel)?.classList.add('active');
  vsInfo('🎨 Aktif Doku Kanalı: ' + channel);
}

// ── 10 PROCEDURAL PBR TEXTURE GENERATORS ──
function generateProceduralTexture(type: string): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;

  switch (type) {
    case 'wood': {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - size / 2;
          const dy = y - size / 2;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const ring = Math.sin(dist * 0.15 + Math.sin(x * 0.04) * 3) * 0.5 + 0.5;
          const plank = Math.floor(x / (size / 4));
          const plankLine = x % (size / 4) < 2 ? 0.6 : 1.0;
          const r = Math.floor((160 + ring * 50 + plank * 8) * plankLine);
          const g = Math.floor((100 + ring * 35 + plank * 5) * plankLine);
          const b = Math.floor((45 + ring * 20 + plank * 3) * plankLine);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
      break;
    }
    case 'brick': {
      ctx.fillStyle = '#a04830';
      ctx.fillRect(0, 0, size, size);
      const bw = size / 4;
      const bh = size / 8;
      for (let row = 0; row < 8; row++) {
        const offset = (row % 2) * (bw / 2);
        for (let col = -1; col < 5; col++) {
          const brickR = Math.floor(160 + Math.random() * 30);
          const brickG = Math.floor(70 + Math.random() * 20);
          const brickB = Math.floor(50 + Math.random() * 15);
          ctx.fillStyle = `rgb(${brickR},${brickG},${brickB})`;
          ctx.fillRect(col * bw + offset + 3, row * bh + 3, bw - 6, bh - 6);
        }
      }
      break;
    }
    case 'carbon': {
      ctx.fillStyle = '#151515';
      ctx.fillRect(0, 0, size, size);
      const cell = 16;
      for (let y = 0; y < size; y += cell) {
        for (let x = 0; x < size; x += cell) {
          const isEven = ((x / cell) + (y / cell)) % 2 === 0;
          const grad = ctx.createLinearGradient(x, y, x + cell, y + cell);
          if (isEven) {
            grad.addColorStop(0, '#2b2b2b');
            grad.addColorStop(0.5, '#4a4a4a');
            grad.addColorStop(1, '#1b1b1b');
          } else {
            grad.addColorStop(0, '#1a1a1a');
            grad.addColorStop(0.5, '#333333');
            grad.addColorStop(1, '#111111');
          }
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, cell, cell);
        }
      }
      break;
    }
    case 'hex': {
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, size, size);
      const hexR = 24;
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 8;
      for (let y = -hexR; y < size + hexR; y += hexR * 1.5) {
        for (let x = -hexR; x < size + hexR; x += Math.sqrt(3) * hexR) {
          const cx = x + ((Math.floor(y / (hexR * 1.5)) % 2) * (Math.sqrt(3) * hexR) / 2);
          drawHexagon(ctx, cx, y, hexR - 2);
        }
      }
      break;
    }
    case 'marble': {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const n = Math.sin(x * 0.03 + Math.sin(y * 0.04) * 4 + Math.sin((x + y) * 0.02) * 2);
          const v = Math.abs(n);
          const r = Math.floor(220 + v * 35);
          const g = Math.floor(220 + v * 35);
          const b = Math.floor(225 + v * 30);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
      break;
    }
    case 'metal': {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#888');
      grad.addColorStop(0.5, '#ccc');
      grad.addColorStop(1, '#777');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < size; i += 2) {
        ctx.strokeStyle = Math.random() > 0.5 ? '#bbb' : '#999';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.stroke();
      }
      break;
    }
    case 'lava': {
      ctx.fillStyle = '#110a08';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = '#ff4400';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 12;
      for (let i = 0; i < 15; i++) {
        ctx.beginPath();
        let px = Math.random() * size;
        let py = Math.random() * size;
        ctx.moveTo(px, py);
        for (let j = 0; j < 8; j++) {
          px += (Math.random() - 0.5) * 80;
          py += (Math.random() - 0.5) * 80;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      break;
    }
    case 'camo': {
      const colors = ['#3e4f32', '#283618', '#606c38', '#dda15e'];
      ctx.fillStyle = colors[0];
      ctx.fillRect(0, 0, size, size);
      for (let cIdx = 1; cIdx < colors.length; cIdx++) {
        ctx.fillStyle = colors[cIdx];
        for (let i = 0; i < 20; i++) {
          const rx = Math.random() * size;
          const ry = Math.random() * size;
          const rad = 25 + Math.random() * 45;
          ctx.beginPath();
          ctx.arc(rx, ry, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'checker': {
      const cell = size / 8;
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#eeeeee' : '#222222';
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
      break;
    }
    case 'galaxy': {
      ctx.fillStyle = '#050512';
      ctx.fillRect(0, 0, size, size);
      const radGrad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 1.5);
      radGrad.addColorStop(0, 'rgba(180, 0, 255, 0.4)');
      radGrad.addColorStop(0.5, 'rgba(0, 100, 255, 0.2)');
      radGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, size, size);
      for (let s = 0; s < 300; s++) {
        const sx = Math.random() * size;
        const sy = Math.random() * size;
        const sr = Math.random() * 1.5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx, sy, sr, sr);
      }
      break;
    }
    default: {
      ctx.fillStyle = '#555555';
      ctx.fillRect(0, 0, size, size);
      break;
    }
  }

  // Copy to texture canvas preview
  if (state.texCtx && state.texCanvas) {
    state.texCtx.drawImage(c, 0, 0, state.texCanvas.width, state.texCanvas.height);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const hx = x + r * Math.cos(angle);
    const hy = y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.stroke();
}

function applyPresetTexture(type: string) {
  if (!state.selected || !state.selected.material) {
    vsWarn('Doku uygulamak için sahneden bir nesne seçin!');
    return;
  }
  const tex = generateProceduralTexture(type);
  state.selected.material.map = tex;
  state.selected.material.needsUpdate = true;
  vsInfo('✅ Procedural PBR dokusu uygulandı: ' + type);
}

function importCustomTextureFile(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (re) => {
    const img = new Image();
    img.onload = () => {
      if (state.texCanvas && state.texCtx) {
        state.texCtx.drawImage(img, 0, 0, state.texCanvas.width, state.texCanvas.height);
        syncCanvasToSelectedMesh();
        vsInfo('✅ Resim dokusu başarıyla yüklendi: ' + file.name);
      }
    };
    img.src = re.target?.result as string;
  };
  reader.readAsDataURL(file);
}

function exportTexturePNG() {
  if (!state.texCanvas) return;
  const url = state.texCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'texture_' + (state.selected ? state.selected.name : 'pbr') + '.png';
  a.click();
  vsInfo('📸 Doku PNG olarak indirildi.');
}

// ═══════════════════════════════════════════════════════════════════
//  🤖 AI MODEL SYNTHESIZER & COPILOT / GROK BRIDGE ENGINE
// ═══════════════════════════════════════════════════════════════════

function generatePresetModel(preset: string) {
  const root = new THREE.Group();
  state.counters.mesh++;
  root.name = capitalize(preset) + '.' + String(state.counters.mesh).padStart(3, '0');

  switch (preset) {
    case 'scifi_tower': {
      // Base
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.8, 0.6, 8),
        createMaterial({ color: 0x22222b, metalness: 0.8, roughness: 0.2 })
      );
      root.add(base);

      // Main spire
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 4.5, 1.2),
        createMaterial({ color: 0x181824, metalness: 0.9, roughness: 0.3 })
      );
      tower.position.y = 2.5;
      root.add(tower);

      // Glowing Neon Bands
      for (let i = 0; i < 4; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.7, 0.05, 8, 32),
          new THREE.MeshStandardMaterial({ color: 0x00ffee, emissive: 0x00ffee, emissiveIntensity: 2 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 1.0 + i * 0.9;
        root.add(ring);
      }

      // Antenna
      const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.08, 1.8, 16),
        createMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.1 })
      );
      antenna.position.y = 5.4;
      root.add(antenna);
      break;
    }

    case 'spaceship': {
      // Fuselage
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.8, 3.5, 5),
        createMaterial({ color: 0xd0d0d8, metalness: 0.8, roughness: 0.2 })
      );
      body.rotation.x = Math.PI / 2;
      root.add(body);

      // Cockpit canopy
      const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x112244, metalness: 0.9, roughness: 0.1 })
      );
      canopy.position.set(0, 0.3, 0.3);
      canopy.scale.set(0.8, 0.6, 1.6);
      root.add(canopy);

      // Wings
      const wingGeo = new THREE.BoxGeometry(3.6, 0.06, 1.2);
      const wings = new THREE.Mesh(
        wingGeo,
        createMaterial({ color: 0x334466, metalness: 0.7, roughness: 0.3 })
      );
      wings.position.set(0, 0, -0.4);
      root.add(wings);

      // Thrusters with blue emissive flame
      [-0.4, 0.4].forEach((tx) => {
        const thruster = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.25, 0.6, 16),
          createMaterial({ color: 0x222222, metalness: 0.9 })
        );
        thruster.rotation.x = Math.PI / 2;
        thruster.position.set(tx, 0, -1.8);
        root.add(thruster);

        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.16, 0.6, 16),
          new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x00ddff, emissiveIntensity: 3 })
        );
        flame.rotation.x = -Math.PI / 2;
        flame.position.set(tx, 0, -2.2);
        root.add(flame);
      });
      break;
    }

    case 'castle': {
      // Main Fortress
      const keep = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 2.0, 2.4),
        createMaterial({ color: 0x888888, roughness: 0.9 })
      );
      keep.position.y = 1.0;
      root.add(keep);

      // 4 Corner Towers
      const towerOffsets = [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]];
      towerOffsets.forEach(([tx, tz]) => {
        const t = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.5, 2.8, 16),
          createMaterial({ color: 0x777777, roughness: 0.9 })
        );
        t.position.set(tx, 1.4, tz);
        root.add(t);

        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(0.55, 0.9, 16),
          createMaterial({ color: 0x992222, roughness: 0.6 })
        );
        roof.position.set(tx, 3.1, tz);
        root.add(roof);
      });

      // Wooden gate
      const gate = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.1, 0.1),
        createMaterial({ color: 0x5a3311, roughness: 0.8 })
      );
      gate.position.set(0, 0.55, 1.22);
      root.add(gate);
      break;
    }

    case 'robot': {
      // Torso
      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 1.2, 0.7),
        createMaterial({ color: 0x334455, metalness: 0.8, roughness: 0.2 })
      );
      torso.position.y = 1.8;
      root.add(torso);

      // Head + Visor
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.6, 0.6),
        createMaterial({ color: 0x445566, metalness: 0.8 })
      );
      head.position.y = 2.8;
      root.add(head);

      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.15, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 2 })
      );
      visor.position.set(0, 2.8, 0.32);
      root.add(visor);

      // Limbs
      [-0.7, 0.7].forEach((ax) => {
        const arm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 1.2, 12),
          createMaterial({ color: 0x223344, metalness: 0.7 })
        );
        arm.position.set(ax, 1.7, 0);
        root.add(arm);
      });

      [-0.3, 0.3].forEach((lx) => {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.14, 1.3, 12),
          createMaterial({ color: 0x223344, metalness: 0.7 })
        );
        leg.position.set(lx, 0.65, 0);
        root.add(leg);
      });
      break;
    }

    case 'car': {
      // Body chassis
      const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.45, 3.2),
        createMaterial({ color: 0xdd1122, metalness: 0.7, roughness: 0.2 })
      );
      chassis.position.y = 0.5;
      root.add(chassis);

      // Cabin
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.5, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 })
      );
      cabin.position.set(0, 0.9, -0.2);
      root.add(cabin);

      // 4 Wheels
      const wheelOffsets = [
        [-0.85, 0.35, 1.0],
        [0.85, 0.35, 1.0],
        [-0.85, 0.35, -1.0],
        [0.85, 0.35, -1.0],
      ];
      wheelOffsets.forEach(([wx, wy, wz]) => {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16),
          createMaterial({ color: 0x1a1a1a, roughness: 0.9 })
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, wy, wz);
        root.add(wheel);
      });
      break;
    }

    case 'tree_forest': {
      // Island ground
      const ground = new THREE.Mesh(
        new THREE.CylinderGeometry(2.5, 2.8, 0.5, 16),
        createMaterial({ color: 0x3d7828, roughness: 0.9 })
      );
      ground.position.y = 0.25;
      root.add(ground);

      // 3 Pine Trees
      const treeLocs = [[-0.8, -0.6], [0.7, 0.4], [-0.3, 0.9]];
      treeLocs.forEach(([tx, tz]) => {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.15, 0.8, 8),
          createMaterial({ color: 0x5a3311, roughness: 0.9 })
        );
        trunk.position.set(tx, 0.9, tz);
        root.add(trunk);

        for (let l = 0; l < 3; l++) {
          const leaves = new THREE.Mesh(
            new THREE.ConeGeometry(0.6 - l * 0.15, 0.7, 8),
            createMaterial({ color: 0x226618 + l * 0x051105, roughness: 0.8 })
          );
          leaves.position.set(tx, 1.4 + l * 0.45, tz);
          root.add(leaves);
        }
      });
      break;
    }

    case 'sword': {
      // Blade
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 2.6, 0.04),
        createMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.1 })
      );
      blade.position.y = 1.8;
      root.add(blade);

      // Crossguard
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.12, 0.16),
        createMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 })
      );
      guard.position.y = 0.5;
      root.add(guard);

      // Grip
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.5, 12),
        createMaterial({ color: 0x4a2a11, roughness: 0.8 })
      );
      grip.position.y = 0.2;
      root.add(grip);

      // Pommel gem
      const pommel = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.12, 1),
        new THREE.MeshStandardMaterial({ color: 0xff0044, emissive: 0xff0044, emissiveIntensity: 2 })
      );
      pommel.position.y = -0.1;
      root.add(pommel);
      break;
    }

    case 'drone': {
      // Core
      const core = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.25, 0.8),
        createMaterial({ color: 0x222228, metalness: 0.8, roughness: 0.2 })
      );
      core.position.y = 1.0;
      root.add(core);

      // Glowing Eye Camera
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 2.5 })
      );
      eye.position.set(0, 0.95, 0.42);
      root.add(eye);

      // 4 Arms & Rotors
      const armAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
      armAngles.forEach((ang) => {
        const ax = Math.cos(ang) * 0.9;
        const az = Math.sin(ang) * 0.9;
        const arm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8),
          createMaterial({ color: 0x444444, metalness: 0.8 })
        );
        arm.rotation.z = Math.PI / 2;
        arm.rotation.y = -ang;
        arm.position.set(ax / 2, 1.0, az / 2);
        root.add(arm);

        const rotor = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 0.02, 16),
          createMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.3 })
        );
        rotor.position.set(ax, 1.05, az);
        root.add(rotor);
      });
      break;
    }

    default: {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), createMaterial());
      root.add(box);
      break;
    }
  }

  root.userData = { type: 'mesh', preset };
  scene.add(root);
  objects.push(root);
  selectObject(root);
  updateOutliner();
  vsInfo(`🤖 AI Modeli başarıyla oluşturuldu: ${preset}`);
  return root;
}

// ── NATURAL LANGUAGE AI MODEL SYNTHESIZER ──
function generateAIModel(prompt: string) {
  if (!prompt || !prompt.trim()) return;
  const p = prompt.toLowerCase();
  vsInfo(`🤖 AI Prompt işleniyor: "${prompt}"...`);

  if (p.includes('kule') || p.includes('tower') || p.includes('bina') || p.includes('skyscraper') || p.includes('gökdelen')) {
    generatePresetModel('scifi_tower');
  } else if (p.includes('gemi') || p.includes('uzay') || p.includes('ship') || p.includes('space') || p.includes('plane') || p.includes('uçak')) {
    generatePresetModel('spaceship');
  } else if (p.includes('kale') || p.includes('castle') || p.includes('fort') || p.includes('saray')) {
    generatePresetModel('castle');
  } else if (p.includes('araba') || p.includes('car') || p.includes('araç') || p.includes('vehicle')) {
    generatePresetModel('car');
  } else if (p.includes('robot') || p.includes('mech') || p.includes('droid') || p.includes('cyborg')) {
    generatePresetModel('robot');
  } else if (p.includes('ağaç') || p.includes('tree') || p.includes('orman') || p.includes('forest') || p.includes('doğa') || p.includes('ada') || p.includes('island')) {
    generatePresetModel('tree_forest');
  } else if (p.includes('kılıç') || p.includes('sword') || p.includes('silah') || p.includes('weapon') || p.includes('bıçak')) {
    generatePresetModel('sword');
  } else if (p.includes('drone') || p.includes('iha') || p.includes('quadcopter')) {
    generatePresetModel('drone');
  } else {
    // Custom parametric synthesizer based on keywords
    synthesizeCustomModel(p);
  }
}

function synthesizeCustomModel(prompt: string) {
  const root = new THREE.Group();
  state.counters.mesh++;
  root.name = 'AI_Object.' + String(state.counters.mesh).padStart(3, '0');

  const isGold = prompt.includes('altın') || prompt.includes('gold');
  const isNeon = prompt.includes('neon') || prompt.includes('cyber') || prompt.includes('glow') || prompt.includes('parlak');
  const isDark = prompt.includes('kara') || prompt.includes('black') || prompt.includes('dark');

  const mainColor = isGold ? 0xd4af37 : isDark ? 0x222228 : 0x3366cc;
  const metal = isGold ? 0.95 : 0.6;
  const rough = isGold ? 0.15 : 0.4;

  const mat = createMaterial({ color: mainColor, metalness: metal, roughness: rough });

  const core = new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.25, 100, 16), mat);
  core.position.y = 1.5;
  root.add(core);

  if (isNeon) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.06, 16, 64),
      new THREE.MeshStandardMaterial({ color: 0x00ffee, emissive: 0x00ffee, emissiveIntensity: 2.5 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.5;
    root.add(ring);
  }

  root.userData = { type: 'mesh' };
  scene.add(root);
  objects.push(root);
  selectObject(root);
  updateOutliner();
  vsInfo('✨ Özel parametrik 3D model başarıyla sentezlendi.');
}

// ── LIVE 3D JAVASCRIPT CODE EVALUATOR FOR COPILOT / ANTIGRAVITY / GROK ──
function evalThreeCode(codeStr: string) {
  if (!codeStr || !codeStr.trim()) return;
  try {
    const func = new Function(
      'THREE',
      'scene',
      'camera',
      'renderer',
      'objects',
      'createMaterial',
      'addMesh',
      'selectObject',
      'applyPresetTexture',
      'vsInfo',
      'vsWarn',
      codeStr
    );
    func(
      THREE,
      scene,
      camera,
      renderer,
      objects,
      createMaterial,
      addMesh,
      selectObject,
      applyPresetTexture,
      vsInfo,
      vsWarn
    );
    updateOutliner();
    vsInfo('⚡ Copilot/AI Script başarıyla çalıştırıldı.');
  } catch (err: any) {
    vsWarn('Script çalıştırma hatası: ' + err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  TAB SWITCHING & UI NAVIGATION
// ═══════════════════════════════════════════════════════════════════

function switchRightTab(tab: 'properties' | 'texture' | 'ai') {
  ['properties', 'texture', 'ai'].forEach((t) => {
    document.getElementById('tab-btn-' + t)?.classList.toggle('active', t === tab);
    const panel = document.getElementById('panel-view-' + t);
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
  });
}

// ═══════════════════════════════════════════════════════════════════
//  MODIFIERS
// ═══════════════════════════════════════════════════════════════════
function applyModifier(type: string) {
  if (!state.selected || state.selected.userData.type !== 'mesh') {
    vsWarn('Modifier uygulamak için bir mesh seçin!');
    return;
  }
  const obj = state.selected;
  const id = obj.uuid;
  if (!state.modifiers[id]) state.modifiers[id] = [];

  if (type === 'subdivision') {
    if (state.modifiers[id].includes('subdivision')) {
      vsInfo('Subdivision zaten uygulandı.');
      return;
    }
    subdivideGeometry(obj);
    state.modifiers[id].push('subdivision');
    vsInfo('✅ Subdivision Surface uygulandı → Vertex: ' + (obj.geometry ? obj.geometry.attributes.position.count : 0));
  } else if (type === 'mirror') {
    if (state.modifiers[id].includes('mirror')) {
      vsInfo('Mirror zaten uygulandı.');
      return;
    }
    mirrorGeometry(obj);
    state.modifiers[id].push('mirror');
    vsInfo('✅ Mirror X uygulandı.');
  } else if (type === 'wireframe') {
    if (obj.material) {
      obj.material.wireframe = !obj.material.wireframe;
      vsInfo(obj.material.wireframe ? '✅ Wireframe açıldı.' : '⬡ Wireframe kapandı.');
    }
  }

  updateModifierList();
  updatePropertiesPanel();
}

function subdivideGeometry(obj: any) {
  if (!obj.geometry) return;
  const type = obj.userData.meshType;
  const segMap: Record<string, () => THREE.BufferGeometry> = {
    box: () => new THREE.BoxGeometry(1, 1, 1, 4, 4, 4),
    sphere: () => new THREE.SphereGeometry(0.6, 48, 24),
    cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1.5, 48),
    cone: () => new THREE.ConeGeometry(0.6, 1.5, 48),
    torus: () => new THREE.TorusGeometry(0.6, 0.2, 32, 128),
    plane: () => new THREE.PlaneGeometry(2, 2, 8, 8),
    icosphere: () => new THREE.IcosahedronGeometry(0.7, 4),
  };
  if (segMap[type]) {
    const newGeo = segMap[type]();
    obj.geometry.dispose();
    obj.geometry = newGeo;
  }
}

function mirrorGeometry(obj: any) {
  if (!obj.geometry) return;
  const srcPos = obj.geometry.attributes.position;
  const positions: number[] = [];
  for (let i = 0; i < srcPos.count; i++) {
    positions.push(srcPos.getX(i), srcPos.getY(i), srcPos.getZ(i));
    positions.push(-srcPos.getX(i), srcPos.getY(i), srcPos.getZ(i));
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.computeVertexNormals();
  obj.geometry.dispose();
  obj.geometry = merged;
}

function updateModifierList() {
  if (!state.selected) return;
  const id = state.selected.uuid;
  const mods = state.modifiers[id] || [];
  const container = document.getElementById('modifier-list');
  if (!container) return;
  container.innerHTML = '';
  mods.forEach((m) => {
    const div = document.createElement('div');
    div.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;padding:3px 0;font-size:11px;color:#aaa;border-bottom:1px solid #333;';
    div.innerHTML =
      '<span>🔧 ' +
      capitalize(m) +
      '</span><button onclick="removeModifier(\'' +
      m +
      '\')" style="background:transparent;border:none;color:#d55;font-size:12px;cursor:pointer">✕</button>';
    container.appendChild(div);
  });
}

function removeModifier(type: string) {
  if (!state.selected) return;
  const id = state.selected.uuid;
  if (state.modifiers[id]) {
    state.modifiers[id] = state.modifiers[id].filter((m) => m !== type);
    vsInfo(capitalize(type) + ' modifier kaldırıldı.');
    updateModifierList();
  }
}

// ── EDIT MODE OPS ──
function doExtrude() {
  if (!state.editMesh || !state.editMesh.geometry) return;
  const geo = state.editMesh.geometry;
  const pos = geo.attributes.position;
  const normals = geo.attributes.normal;
  const amount = 0.3;

  if (state.subMode === 'vertex' && state.selectedVerts.size > 0) {
    state.selectedVerts.forEach((i) => {
      if (normals) {
        pos.setXYZ(
          i,
          pos.getX(i) + normals.getX(i) * amount,
          pos.getY(i) + normals.getY(i) * amount,
          pos.getZ(i) + normals.getZ(i) * amount
        );
      }
    });
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    buildEditHelpers();
    vsInfo('✅ Seçili vertex\'ler çekildi (Extrude).');
  } else {
    for (let i = 0; i < pos.count; i++) {
      if (normals) {
        pos.setXYZ(
          i,
          pos.getX(i) + normals.getX(i) * 0.15,
          pos.getY(i) + normals.getY(i) * 0.15,
          pos.getZ(i) + normals.getZ(i) * 0.15
        );
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    buildEditHelpers();
    vsInfo('✅ Extrude tamamlandı.');
  }
}

function doInset() {
  if (!state.editMesh || !state.editMesh.geometry) return;
  const geo = state.editMesh.geometry;
  const pos = geo.attributes.position;
  const factor = 0.8;
  const centroid = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    centroid.x += pos.getX(i);
    centroid.y += pos.getY(i);
    centroid.z += pos.getZ(i);
  }
  centroid.divideScalar(pos.count);
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, centroid.x + (pos.getX(i) - centroid.x) * factor);
    pos.setY(i, centroid.y + (pos.getY(i) - centroid.y) * factor);
    pos.setZ(i, centroid.z + (pos.getZ(i) - centroid.z) * factor);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  buildEditHelpers();
  vsInfo('✅ Inset tamamlandı.');
}

function doLoopCut() {
  if (state.editMesh) {
    subdivideGeometry(state.editMesh);
    buildEditHelpers();
    vsInfo('✅ Loop Cut / Bölme uygulandı.');
  }
}

function doBevel() {
  if (state.editMesh) {
    doInset();
    subdivideGeometry(state.editMesh);
    buildEditHelpers();
    vsInfo('✅ Bevel uygulandı.');
  }
}

function doSubdivide() {
  if (state.editMesh) {
    subdivideGeometry(state.editMesh);
    buildEditHelpers();
    vsInfo('✅ Subdivide tamamlandı.');
  }
}

function doMergeAtCenter() {
  if (!state.editMesh || !state.editMesh.geometry || state.selectedVerts.size === 0) {
    vsWarn('Birleştirmek için önce vertex seçin!');
    return;
  }
  const geo = state.editMesh.geometry;
  const pos = geo.attributes.position;
  const cx = [...state.selectedVerts].reduce((s, i) => s + pos.getX(i), 0) / state.selectedVerts.size;
  const cy = [...state.selectedVerts].reduce((s, i) => s + pos.getY(i), 0) / state.selectedVerts.size;
  const cz = [...state.selectedVerts].reduce((s, i) => s + pos.getZ(i), 0) / state.selectedVerts.size;
  state.selectedVerts.forEach((i) => {
    pos.setXYZ(i, cx, cy, cz);
  });
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  buildEditHelpers();
  vsInfo('✅ Vertex\'ler merkeze birleştirildi.');
}

// ── OBJECT OPS ──
function duplicateSelected() {
  if (!state.selected) return;
  const orig = state.selected;
  let copy: any;
  if (orig.isMesh) {
    copy = new THREE.Mesh(orig.geometry.clone(), orig.material.clone());
  } else if (orig.isGroup) {
    copy = orig.clone(true);
  } else {
    return;
  }
  copy.position.copy(orig.position).add(new THREE.Vector3(0.5, 0, 0.5));
  copy.rotation.copy(orig.rotation);
  copy.scale.copy(orig.scale);
  copy.name = orig.name + '_Copy';
  copy.userData = { ...orig.userData };
  scene.add(copy);
  objects.push(copy);
  selectObject(copy);
  updateOutliner();
  vsInfo('📋 Kopyalandı: ' + copy.name);
}

function deleteSelected() {
  if (!state.selected) return;
  const name = state.selected.name;
  transformControls.detach();
  scene.remove(state.selected);
  const idx = objects.indexOf(state.selected);
  if (idx !== -1) objects.splice(idx, 1);
  state.selected = null;
  updateOutliner();
  updatePropertiesPanel2Empty();
  vsInfo('🗑 Silindi: ' + name);
}

function updatePropertiesPanel2Empty() {
  ['px', 'py', 'pz', 'rx', 'ry', 'rz'].forEach((id) => setVal(id, '0'));
  ['sx', 'sy', 'sz'].forEach((id) => setVal(id, '1'));
  setVal('obj-name', '');
  const selEl = document.getElementById('status-sel');
  if (selEl) selEl.textContent = 'Seçili: Yok';
}

function selectAll() {
  if (objects.length > 0) selectObject(objects[objects.length - 1]);
  updateOutliner();
}
function deselectAll() {
  if (state.selected && state.selected.material) {
    if (state.selected.material.emissive) state.selected.material.emissive.set(0x000000);
  }
  transformControls.detach();
  state.selected = null;
  updateOutliner();
}

function focusSelected() {
  if (state.selected) {
    const target = state.selected.position.clone();
    orbitControls.target.copy(target);
    const dist = 3;
    camera.position.copy(target.clone().add(new THREE.Vector3(dist, dist, dist)));
    orbitControls.update();
  }
}

function renameSelected() {
  if (!state.selected) return;
  const nameInput = document.getElementById('obj-name') as HTMLInputElement;
  if (nameInput) {
    state.selected.name = nameInput.value;
    updateOutliner();
  }
}

function setOriginToGeometry() {
  if (!state.selected || !state.selected.geometry) return;
  const geo = state.selected.geometry;
  geo.computeBoundingBox();
  const center = new THREE.Vector3();
  if (geo.boundingBox) {
    geo.boundingBox.getCenter(center);
    geo.translate(-center.x, -center.y, -center.z);
    state.selected.position.add(center.applyMatrix4(state.selected.matrixWorld));
    vsInfo('📍 Orijin geometrinin merkezine taşındı.');
  }
}

function flatShading() {
  if (!state.selected || !state.selected.material) return;
  state.selected.material.flatShading = true;
  state.selected.material.needsUpdate = true;
  if (state.selected.geometry) state.selected.geometry.computeVertexNormals();
}
function smoothShading() {
  if (!state.selected || !state.selected.material) return;
  state.selected.material.flatShading = false;
  state.selected.material.needsUpdate = true;
  if (state.selected.geometry) state.selected.geometry.computeVertexNormals();
}

// ── SHADING / PROJECTION ──
function setShading(mode: string) {
  state.shading = mode;
  ['solid', 'wire', 'material'].forEach((m) => {
    document.getElementById('shade-' + m)?.classList.toggle('active', m === mode);
  });
  objects.forEach((obj) => {
    if (!obj.material) return;
    if (mode === 'wireframe') {
      obj.material.wireframe = true;
    } else {
      const mw = document.getElementById('mat-wire') as HTMLInputElement;
      obj.material.wireframe = mw?.checked || false;
    }
  });
  if (mode === 'material') {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
  } else {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.0;
  }
}

function setProjection(type: string) {
  state.projection = type;
  document.getElementById('proj-persp')?.classList.toggle('active', type === 'perspective');
  document.getElementById('proj-ortho')?.classList.toggle('active', type === 'orthographic');
  const vpl = document.getElementById('vp-proj-label');
  if (vpl) vpl.textContent = type === 'perspective' ? 'Perspektif' : 'Ortografik';

  const vpa = document.getElementById('viewport-area');
  const aspect = vpa ? vpa.clientWidth / Math.max(vpa.clientHeight, 1) : 1;
  if (type === 'orthographic') {
    const s = 5;
    camera = new THREE.OrthographicCamera(-s * aspect, s * aspect, s, -s, 0.01, 10000);
    camera.position.set(5, 4, 6);
    camera.lookAt(0, 0, 0);
  } else {
    camera = new THREE.PerspectiveCamera(60, aspect, 0.01, 10000);
    camera.position.set(5, 4, 6);
  }
  orbitControls.object = camera;
  (transformControls as any).camera = camera;
  orbitControls.update();
}

function setViewAngle(angle: string) {
  const d = 8;
  const views: Record<string, [number, number, number]> = {
    front: [0, 0, d],
    right: [d, 0, 0],
    top: [0, d, 0.001],
    back: [0, 0, -d],
    left: [-d, 0, 0],
    bottom: [0, -d, 0.001],
  };
  if (views[angle]) {
    camera.position.set(...views[angle]);
    orbitControls.target.set(0, 0, 0);
    orbitControls.update();
  }
}

// ── SCENE SETTINGS ──
function setBgColor() {
  const bg = (document.getElementById('scene-bg') as HTMLInputElement)?.value;
  if (bg) scene.background = new THREE.Color(bg);
}
function toggleGrid() {
  const sg = document.getElementById('scene-grid') as HTMLInputElement;
  if (sg) gridHelper.visible = sg.checked;
}
function toggleAxes() {
  const sa = document.getElementById('scene-axes') as HTMLInputElement;
  if (sa) axesHelper.visible = sa.checked;
}
function setAmbient(v: string) {
  ambientLight.intensity = parseFloat(v);
}
let envMapOn = false;
function toggleEnvMap() {
  if (!envMapOn) {
    scene.background = new THREE.Color(0x88aacc);
    hemiLight.intensity = 1.2;
    vsInfo('🌐 HDRI ortam simüle edildi. Arka plan rengi güncellendi.');
  } else {
    const bg = (document.getElementById('scene-bg') as HTMLInputElement)?.value;
    scene.background = new THREE.Color(bg || 0x1a1a1a);
    hemiLight.intensity = 0.6;
  }
  envMapOn = !envMapOn;
}

// ── OUTLINER ──
function updateOutliner() {
  const body = document.getElementById('outliner-body');
  if (!body) return;
  body.innerHTML = '';
  const oc = document.getElementById('obj-count');
  if (oc) oc.textContent = objects.length + ' nesne';

  objects.forEach((obj) => {
    const div = document.createElement('div');
    div.className = 'outliner-item' + (state.selected === obj ? ' selected' : '');
    const typeIcon =
      obj.userData.type === 'light' || obj.userData.type === 'lightProxy'
        ? '💡'
        : obj.userData.type === 'camera'
        ? '📷'
        : '🧊';
    div.innerHTML = `
      <span class="outliner-icon">${typeIcon}</span>
      <span class="outliner-name">${obj.name}</span>
      <span class="outliner-eye ${obj.visible ? '' : 'hidden'}" data-uuid="${obj.uuid}">👁</span>
    `;
    div.querySelector('.outliner-eye')?.addEventListener('click', (e) => {
      e.stopPropagation();
      obj.visible = !obj.visible;
      updateOutliner();
    });
    div.addEventListener('click', () => {
      if (state.mode === 'edit') setMode('object');
      selectObject(obj);
    });
    body.appendChild(div);
  });
}

function togglePanel(id: string) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

// ── TIMELINE ──
function buildTimelineRuler() {
  const track = document.getElementById('tl-track');
  if (!track) return;
  track.innerHTML = '';
  for (let f = 1; f <= 120; f += 10) {
    const tick = document.createElement('div');
    tick.className = 'tl-ruler-tick';
    tick.style.left = ((f - 1) / 119) * 100 + '%';
    tick.textContent = String(f);
    track.appendChild(tick);
  }
}

function updatePlayhead() {
  const end = parseInt((document.getElementById('anim-end') as HTMLInputElement)?.value) || 120;
  const start = parseInt((document.getElementById('anim-start') as HTMLInputElement)?.value) || 1;
  const pct = ((state.currentFrame - start) / (end - start)) * 100;
  const pl = document.getElementById('tl-playhead');
  if (pl) pl.style.left = Math.max(0, Math.min(100, pct)) + '%';
  const fd = document.getElementById('frame-display');
  if (fd) fd.textContent = 'Kare: ' + state.currentFrame + ' / ' + end;
  setVal('anim-frame', state.currentFrame);
}

function insertKeyframe() {
  if (!state.selected) {
    vsWarn('Keyframe eklemek için nesne seçin!');
    return;
  }
  const id = state.selected.uuid;
  if (!state.keyframes[id]) state.keyframes[id] = [];
  const obj = state.selected;
  state.keyframes[id].push({
    frame: state.currentFrame,
    pos: obj.position.clone(),
    rot: obj.rotation.clone(),
    scale: obj.scale.clone(),
  });
  state.keyframes[id].sort((a, b) => a.frame - b.frame);
  renderKeyframeMarkers(id);
  updateKFCount();
  vsInfo('🔑 Keyframe eklendi: Kare ' + state.currentFrame + ' → ' + obj.name);
}

function renderKeyframeMarkers(id: string) {
  const track = document.getElementById('tl-track');
  if (!track) return;
  track.querySelectorAll('.kf-marker').forEach((m) => m.remove());
  const end = parseInt((document.getElementById('anim-end') as HTMLInputElement)?.value) || 120;
  const start = parseInt((document.getElementById('anim-start') as HTMLInputElement)?.value) || 1;
  (state.keyframes[id] || []).forEach((kf) => {
    const marker = document.createElement('div');
    marker.className = 'kf-marker';
    const pct = ((kf.frame - start) / (end - start)) * 100;
    marker.style.left = pct + '%';
    marker.title = 'Kare ' + kf.frame;
    track.appendChild(marker);
  });
}

function updateKFCount() {
  let total = 0;
  Object.values(state.keyframes).forEach((kfs) => (total += kfs.length));
  const kfEl = document.getElementById('status-kf');
  if (kfEl) kfEl.textContent = 'Keyframe: ' + total;
}

function deleteKeyframe() {
  if (!state.selected) return;
  const id = state.selected.uuid;
  if (!state.keyframes[id]) return;
  const idx = state.keyframes[id].findIndex((k) => k.frame === state.currentFrame);
  if (idx !== -1) {
    state.keyframes[id].splice(idx, 1);
    renderKeyframeMarkers(id);
    updateKFCount();
    vsInfo('🗑 Keyframe silindi: Kare ' + state.currentFrame);
  }
}

function clearAnimation() {
  state.keyframes = {};
  document.getElementById('tl-track')?.querySelectorAll('.kf-marker').forEach((m) => m.remove());
  updateKFCount();
  vsInfo('🗑 Tüm animasyon temizlendi.');
}

function goToFrame(f: any) {
  state.currentFrame = parseInt(f) || 1;
  updatePlayhead();
  applyFrameToObjects(state.currentFrame);
}

function applyFrameToObjects(frame: number) {
  objects.forEach((obj) => {
    const kfs = state.keyframes[obj.uuid];
    if (!kfs || kfs.length === 0) return;
    if (kfs.length === 1) {
      obj.position.copy(kfs[0].pos);
      obj.rotation.copy(kfs[0].rot);
      obj.scale.copy(kfs[0].scale);
      return;
    }
    let prev = kfs[0];
    let next = kfs[kfs.length - 1];
    for (let i = 0; i < kfs.length - 1; i++) {
      if (kfs[i].frame <= frame && kfs[i + 1].frame >= frame) {
        prev = kfs[i];
        next = kfs[i + 1];
        break;
      }
    }
    if (prev.frame === next.frame) {
      obj.position.copy(prev.pos);
      return;
    }
    const t = (frame - prev.frame) / (next.frame - prev.frame);
    obj.position.lerpVectors(prev.pos, next.pos, t);
    obj.scale.lerpVectors(prev.scale, next.scale, t);
    obj.rotation.x = prev.rot.x + (next.rot.x - prev.rot.x) * t;
    obj.rotation.y = prev.rot.y + (next.rot.y - prev.rot.y) * t;
    obj.rotation.z = prev.rot.z + (next.rot.z - prev.rot.z) * t;
  });
  if (state.selected) updatePropertiesPanel();
}

let playDelta = 0;
function updatePlayback(delta: number) {
  const fps = parseInt((document.getElementById('anim-fps') as HTMLInputElement)?.value) || 24;
  const end = parseInt((document.getElementById('anim-end') as HTMLInputElement)?.value) || 120;
  const start = parseInt((document.getElementById('anim-start') as HTMLInputElement)?.value) || 1;
  playDelta += delta;
  if (playDelta >= 1 / fps) {
    playDelta = 0;
    state.currentFrame++;
    if (state.currentFrame > end) state.currentFrame = start;
    updatePlayhead();
    applyFrameToObjects(state.currentFrame);
  }
}

function tlPlayPause() {
  state.playing = !state.playing;
  const btn = document.getElementById('btn-play');
  if (btn) {
    btn.textContent = state.playing ? '⏸ Durdur' : '▶ Oynat';
    btn.classList.toggle('active', state.playing);
  }
}
function tlPrev() {
  goToFrame(Math.max(1, state.currentFrame - 1));
}
function tlNext() {
  const end = parseInt((document.getElementById('anim-end') as HTMLInputElement)?.value) || 120;
  goToFrame(Math.min(end, state.currentFrame + 1));
}

function tlScrubStart(e: any) {
  state.tlScrubbing = true;
  tlScrubMove(e);
}
function tlScrubEnd() {
  state.tlScrubbing = false;
}
function tlScrubMove(e: any) {
  if (!state.tlScrubbing) return;
  const target = document.getElementById('timeline-scrubber');
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const end = parseInt((document.getElementById('anim-end') as HTMLInputElement)?.value) || 120;
  const start = parseInt((document.getElementById('anim-start') as HTMLInputElement)?.value) || 1;
  goToFrame(Math.round(start + pct * (end - start)));
}

// ── IMPORT / EXPORT ──
function newScene() {
  if (!confirm('Sahneyi temizlemek istiyor musunuz?')) return;
  objects.forEach((o) => scene.remove(o));
  objects.length = 0;
  state.selected = null;
  transformControls.detach();
  state.keyframes = {};
  state.modifiers = {};
  updateOutliner();
  vsInfo('🆕 Yeni sahne oluşturuldu.');
}

function vsImport() {
  vsPost({ command: 'importFile' });
}

function exportScene(type: string) {
  if (type === 'gltf') {
    const exporter = new GLTFExporter();
    exporter.parse(
      scene,
      (result) => {
        const str = JSON.stringify(result, null, 2);
        vsPost({ command: 'exportFile', type: 'GLTF', ext: 'gltf', data: str });
      },
      (error) => {
        vsWarn('GLTF Export hatası: ' + error);
      },
      { binary: false }
    );
  } else if (type === 'obj') {
    const exporter = new OBJExporter();
    const result = exporter.parse(scene);
    vsPost({ command: 'exportFile', type: 'OBJ', ext: 'obj', data: result });
  } else if (type === 'stl') {
    let stl = 'solid scene\n';
    objects.forEach((obj) => {
      if (!obj.geometry) return;
      const geo = obj.geometry.clone();
      obj.updateMatrixWorld();
      geo.applyMatrix4(obj.matrixWorld);
      const pos = geo.attributes.position;
      const count = pos.count;
      for (let i = 0; i < count; i += 3) {
        const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
        const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
        const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
        const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
        stl += `  facet normal ${n.x} ${n.y} ${n.z}\n    outer loop\n`;
        stl += `      vertex ${a.x} ${a.y} ${a.z}\n`;
        stl += `      vertex ${b.x} ${b.y} ${b.z}\n`;
        stl += `      vertex ${c.x} ${c.y} ${c.z}\n`;
        stl += `    endloop\n  endfacet\n`;
      }
    });
    stl += 'endsolid scene\n';
    vsPost({ command: 'exportFile', type: 'STL', ext: 'stl', data: stl });
  }
}

function renderSnapshot() {
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'render.png';
  a.click();
  vsInfo('📸 Render kaydedildi: render.png');
}

// ── EVENTS ──
let isMouseDown = false;
const mouseDownPos = new THREE.Vector2();

function setupEvents() {
  const canvas = document.getElementById('viewport-canvas');
  if (!canvas) return;

  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    isMouseDown = true;
    mouseDownPos.set(e.clientX, e.clientY);
    if (e.button === 2) {
      showCtxMenu(e);
      return;
    }
  });

  canvas.addEventListener('mouseup', (e: MouseEvent) => {
    if (!isMouseDown) return;
    isMouseDown = false;
    const dist = new THREE.Vector2(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y).length();
    if (dist < 5 && e.button === 0 && !state.transformActive) {
      pickObject(e);
    }
  });

  document.addEventListener('click', (e: MouseEvent) => {
    const cm = document.getElementById('ctx-menu');
    if (cm && !cm.contains(e.target as Node)) cm.classList.remove('visible');
  });

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    handleKey(e);
  });

  // VS Code Extension & AI Bridge Message Receiver
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.command === 'loadFile') {
      loadFileData(msg.ext, msg.name, msg.data);
    } else if (msg.command === 'aiGenerate') {
      generateAIModel(msg.prompt);
    } else if (msg.command === 'evalCode') {
      evalThreeCode(msg.code);
    } else if (msg.command === 'openTab') {
      switchRightTab(msg.tab);
    } else if (msg.command === 'aiAction') {
      handleAIAction(msg.data);
    }
  });
}

function handleAIAction(data: any) {
  if (!data) return;
  if (data.action === 'createModel' || data.action === 'createMesh') {
    generatePresetModel(data.preset || data.type || 'box');
  } else if (data.action === 'applyTexture') {
    applyPresetTexture(data.texture || data.type || 'wood');
  } else if (data.action === 'setMaterial') {
    if (state.selected && state.selected.material) {
      if (data.color) state.selected.material.color.set(data.color);
      if (data.metalness !== undefined) state.selected.material.metalness = data.metalness;
      if (data.roughness !== undefined) state.selected.material.roughness = data.roughness;
      if (data.emissive) state.selected.material.emissive.set(data.emissive);
      state.selected.material.needsUpdate = true;
      updatePropertiesPanel();
    }
  } else if (data.action === 'clearScene') {
    newScene();
  } else if (data.action === 'exportScene') {
    exportScene(data.format || 'gltf');
  }
}

function pickObject(e: MouseEvent) {
  const canvas = document.getElementById('viewport-area');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  if (state.mode === 'edit') {
    const hits = raycaster.intersectObjects(state.editHighlights);
    if (hits.length > 0) {
      const h = hits[0].object;
      if (h.userData.vertIndex !== undefined) {
        if (e.shiftKey) {
          state.selectedVerts.has(h.userData.vertIndex)
            ? state.selectedVerts.delete(h.userData.vertIndex)
            : state.selectedVerts.add(h.userData.vertIndex);
        } else {
          state.selectedVerts.clear();
          state.selectedVerts.add(h.userData.vertIndex);
        }
        state.editHighlights.forEach((sp) => {
          const vi = sp.userData.vertIndex;
          if (vi !== undefined) {
            (sp.material as THREE.MeshBasicMaterial).color.set(state.selectedVerts.has(vi) ? 0xffffff : 0xff8800);
          }
        });
      }
    }
    return;
  }

  const meshes = objects.filter((o) => (o as THREE.Mesh).isMesh || (o as THREE.Group).isGroup);
  const hits = raycaster.intersectObjects(meshes, true);
  if (hits.length > 0) {
    let obj: any = hits[0].object;
    while (obj.parent && obj.parent !== scene && !objects.includes(obj)) {
      obj = obj.parent;
    }
    selectObject(obj);
  } else {
    deselectAll();
  }
}

function handleKey(e: KeyboardEvent) {
  const key = e.key.toLowerCase();
  const ctrl = e.ctrlKey || e.metaKey;

  if (key === 'tab') {
    e.preventDefault();
    setMode(state.mode === 'object' ? 'edit' : 'object');
    return;
  }

  if (key === '1' && !ctrl && state.mode === 'object') {
    setViewAngle('front');
    return;
  }
  if (key === '3' && !ctrl && state.mode === 'object') {
    setViewAngle('right');
    return;
  }
  if (key === '7' && !ctrl && state.mode === 'object') {
    setViewAngle('top');
    return;
  }
  if (key === '5' && !ctrl && state.mode === 'object') {
    setProjection(state.projection === 'perspective' ? 'orthographic' : 'perspective');
    return;
  }

  if (state.mode === 'edit') {
    if (key === '1' && !ctrl) {
      setSubMode('vertex');
      return;
    }
    if (key === '2' && !ctrl) {
      setSubMode('edge');
      return;
    }
    if (key === '3' && !ctrl) {
      setSubMode('face');
      return;
    }
    if (key === 'e') {
      doExtrude();
      return;
    }
    if (key === 'i') {
      doInset();
      return;
    }
    if (key === 'r' && ctrl) {
      doLoopCut();
      return;
    }
    if (key === 'b' && ctrl) {
      doBevel();
      return;
    }
    if (key === 'a') {
      e.preventDefault();
      toggleSelectAll();
      return;
    }
  }

  if (state.mode === 'object') {
    if (key === 'g') {
      setTool('grab');
      transformControls.setMode('translate');
      return;
    }
    if (key === 'r') {
      setTool('rotate');
      transformControls.setMode('rotate');
      return;
    }
    if (key === 's') {
      setTool('scale');
      transformControls.setMode('scale');
      return;
    }
    if (key === 'x' && !ctrl) {
      deleteSelected();
      return;
    }
    if (key === 'f') {
      focusSelected();
      return;
    }
    if (key === 'a' && !ctrl) {
      e.preventDefault();
      toggleSelectAll();
      return;
    }
    if (key === 'd' && e.shiftKey) {
      e.preventDefault();
      duplicateSelected();
      return;
    }
    if (key === 'i') {
      insertKeyframe();
      return;
    }
  }

  if (key === ' ') {
    e.preventDefault();
    tlPlayPause();
  }
  if (key === 'delete') {
    deleteSelected();
  }
}

let _allSelected = false;
function toggleSelectAll() {
  if (_allSelected) {
    deselectAll();
    _allSelected = false;
  } else {
    selectAll();
    _allSelected = true;
  }
}

// ── CONTEXT MENU ──
function showCtxMenu(e: MouseEvent) {
  e.preventDefault();
  const cm = document.getElementById('ctx-menu');
  if (!cm) return;
  cm.style.left = e.clientX + 'px';
  cm.style.top = e.clientY + 'px';
  cm.classList.add('visible');
}
function ctxDuplicate() {
  duplicateSelected();
  document.getElementById('ctx-menu')?.classList.remove('visible');
}

// ── MODAL ──
function openModal(title: string, content: string, cb: () => void) {
  const mt = document.getElementById('modal-title');
  if (mt) mt.textContent = title;
  const mc = document.getElementById('modal-content');
  if (mc) mc.innerHTML = content;
  state.modalCallback = cb;
  document.getElementById('modal-overlay')?.classList.add('visible');
}
function closeModal() {
  document.getElementById('modal-overlay')?.classList.remove('visible');
}
function modalOk() {
  if (state.modalCallback) state.modalCallback();
  closeModal();
}

// ── FILE IMPORT FROM VSCODE ──
function loadFileData(ext: string, name: string, base64: string) {
  if (ext === 'gltf') {
    const loader = new GLTFLoader();
    const str = atob(base64);
    loader.parse(
      str,
      '',
      (gltf) => {
        const obj = gltf.scene;
        obj.name = name;
        obj.userData = { type: 'mesh' };
        scene.add(obj);
        objects.push(obj);
        updateOutliner();
        vsInfo('✅ GLTF yüklendi: ' + name);
      },
      (error) => {
        vsWarn('GLTF parse hatası: ' + error);
      }
    );
  } else if (ext === 'glb') {
    const loader = new GLTFLoader();
    const buf = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
    loader.parse(
      buf,
      '',
      (gltf) => {
        const obj = gltf.scene;
        obj.name = name;
        obj.userData = { type: 'mesh' };
        scene.add(obj);
        objects.push(obj);
        updateOutliner();
        vsInfo('✅ GLB yüklendi: ' + name);
      },
      (error) => {
        vsWarn('GLB parse hatası: ' + error);
      }
    );
  } else if (ext === 'obj') {
    const loader = new OBJLoader();
    const str = atob(base64);
    const obj = loader.parse(str);
    obj.name = name;
    obj.userData = { type: 'mesh' };
    scene.add(obj);
    objects.push(obj);
    updateOutliner();
    vsInfo('✅ OBJ yüklendi: ' + name);
  } else {
    vsWarn('Desteklenmeyen format: ' + ext);
  }
}

// ── EXPOSE ALL TO WINDOW FOR HTML HANDLERS ──
const win = window as any;
win.newScene = newScene;
win.vsImport = vsImport;
win.exportScene = exportScene;
win.addMesh = addMesh;
win.addLight = addLight;
win.addCamera = addCamera;
win.duplicateSelected = duplicateSelected;
win.deleteSelected = deleteSelected;
win.selectAll = selectAll;
win.deselectAll = deselectAll;
win.focusSelected = focusSelected;
win.resetTransform = resetTransform;
win.applyModifier = applyModifier;
win.removeModifier = removeModifier;
win.setOriginToGeometry = setOriginToGeometry;
win.flatShading = flatShading;
win.smoothShading = smoothShading;
win.renderSnapshot = renderSnapshot;
win.toggleEnvMap = toggleEnvMap;
win.setMode = setMode;
win.setSubMode = setSubMode;
win.setShading = setShading;
win.setProjection = setProjection;
win.setViewAngle = setViewAngle;
win.setTool = setTool;
win.doExtrude = doExtrude;
win.doInset = doInset;
win.doLoopCut = doLoopCut;
win.doBevel = doBevel;
win.doSubdivide = doSubdivide;
win.doMergeAtCenter = doMergeAtCenter;
win.applyTransform = applyTransform;
win.applyMaterial = applyMaterial;
win.syncColorFromHex = syncColorFromHex;
win.updateSliderLabel = updateSliderLabel;
win.renameSelected = renameSelected;
win.goToFrame = goToFrame;
win.insertKeyframe = insertKeyframe;
win.deleteKeyframe = deleteKeyframe;
win.clearAnimation = clearAnimation;
win.setBgColor = setBgColor;
win.toggleGrid = toggleGrid;
win.toggleAxes = toggleAxes;
win.setAmbient = setAmbient;
win.togglePanel = togglePanel;
win.tlPrev = tlPrev;
win.tlPlayPause = tlPlayPause;
win.tlNext = tlNext;
win.tlScrubStart = tlScrubStart;
win.tlScrubMove = tlScrubMove;
win.tlScrubEnd = tlScrubEnd;
win.ctxDuplicate = ctxDuplicate;
win.openModal = openModal;
win.closeModal = closeModal;
win.modalOk = modalOk;

// AI & Texture Studio exports
win.switchRightTab = switchRightTab;
win.generateAIModel = generateAIModel;
win.generatePresetModel = generatePresetModel;
win.evalThreeCode = evalThreeCode;
win.setTexTool = setTexTool;
win.setBrushColor = setBrushColor;
win.setBrushSize = setBrushSize;
win.setBrushOpacity = setBrushOpacity;
win.clearTexCanvas = clearTexCanvas;
win.setTexChannel = setTexChannel;
win.applyPresetTexture = applyPresetTexture;
win.importCustomTextureFile = importCustomTextureFile;
win.exportTexturePNG = exportTexturePNG;

// ── AUTO START ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
