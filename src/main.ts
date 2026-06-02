import {
  AmbientLight,
  Clock,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  VolumeRenderer,
  loadDicomVolume,
  type TransferFunction,
  type VolumeData
} from '@volgl/renderer';

import { addSceneObjects } from './scene-objects';
import { bindUi, type VolumeController } from './ui';

// ---- Renderer / scene / camera -------------------------------------------
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

const scene = new Scene();

const camera = new PerspectiveCamera(
  45,
  canvas.clientWidth / canvas.clientHeight,
  0.1,
  100
);
camera.position.set(2.2, 1.6, 2.4);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// ---- Lighting ------------------------------------------------------------
scene.add(new AmbientLight(0xffffff, 0.55));
const key = new DirectionalLight(0xffffff, 0.9);
key.position.set(3, 4, 2);
scene.add(key);
const rim = new DirectionalLight(0xa0b8ff, 0.3);
rim.position.set(-3, 2, -1);
scene.add(rim);

// ---- Helper meshes -------------------------------------------------------
// Keep a handle on the knot so the tick loop can rotate it.
const sceneObjects = addSceneObjects(scene);
const knot = sceneObjects.knot;

// ---- Volume renderer -----------------------------------------------------
// The volume data is in millimetres (e.g. 160×160×100 mm), but the rest of
// the scene (knot, cube, grid, ground) is sized in Three.js's natural
// unit-scale (0.3–10 units). To make the volume sit alongside those
// objects instead of dwarfing them, we wrap the renderer in a Group and
// scale it down. The chosen factor maps a 160 mm volume to ~3 units,
// comparable to the grid cell footprint.
const VOLUME_DISPLAY_SCALE = 0.02;

const vol = new VolumeRenderer({ stepSize: 0.01, earlyRayTermination: 0.99 });
const volumeRoot = new Group();
volumeRoot.name = 'CBCTVolume';
volumeRoot.scale.setScalar(VOLUME_DISPLAY_SCALE);
// DICOM stores voxel data in the LPS (Left-Posterior-Superior) basis:
//   texture X  = column index  = patient Left  → Right
//   texture Y  = row index     = patient Post   → Ant
//   texture Z  = slice index   = patient Sup    → Inf   (head → feet)
// Without a reorientation, our unit box maps these directly to Three.js's
// XYZ, which leaves the patient lying on their side (head pointing -Z).
// Rotate +90° about X so the head (texture Z=0, box -Z) ends up at
// +Y, and the patient's anterior (texture Y=0, box -Y) faces the camera
// at -Z — the standard "feet-up viewer" medical-imaging pose.
volumeRoot.rotation.x = Math.PI / 2;
volumeRoot.add(vol.root);
scene.add(volumeRoot);

// Adapter that the UI module talks to.
let lastVolume: VolumeData | null = null;

const controller: VolumeController = {
  setStepSize: (s) => vol.setStepSize(s),
  setEarlyRayTermination: (t) => vol.setEarlyRayTermination(t),
  setTransferFunction: (tf: TransferFunction) => vol.setTransferFunction(tf),
  setWindowLevel: (level, width) => vol.setWindowLevel(level, width),
  setPreset: (name) => vol.setPreset(name),
  async setVolume(files: File[]): Promise<VolumeData> {
    const data: VolumeData = await loadDicomVolume(files);
    await vol.setVolume(data);
    return data;
  }
};

// ---- Camera fit-to-volume ----------------------------------------------
function cameraFitToVolume(volume: VolumeData): void {
  const [w, h, d] = volume.dimensions;
  const [sx, sy, sz] = volume.spacing;
  const ex = sx * w;
  const ey = sy * h;
  const ez = sz * d;
  // The volume's mesh is wrapped in a Group scaled by VOLUME_DISPLAY_SCALE,
  // so the camera has to frame the *scaled* world-space size, not the raw
  // physical extent. Multiplying maxExtent by the scale converts mm into
  // the same unit space the rest of the scene uses.
  const maxExtent = Math.max(ex, ey, ez) * VOLUME_DISPLAY_SCALE;
  const fovRad = (camera.fov * Math.PI) / 180;
  const dist = (maxExtent * 0.6) / Math.tan(fovRad * 0.5);
  camera.position.set(dist, dist * 0.75, dist);
  camera.near = Math.max(0.001, maxExtent * 0.001);
  camera.far = Math.max(20, maxExtent * 20);
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.update();
}

function formatVolumeInfo(volume: VolumeData): string {
  const [w, h, d] = volume.dimensions;
  const [sx, sy, sz] = volume.spacing;
  const ex = sx * w, ey = sy * h, ez = sz * d;
  return `${w}×${h}×${d} · ${ex.toFixed(0)}×${ey.toFixed(0)}×${ez.toFixed(0)} mm`;
}

// ---- UI wiring -----------------------------------------------------------
const ui = bindUi(controller, {
  onAutoRotateChange: (enabled) => {
    controls.autoRotate = enabled;
    controls.autoRotateSpeed = 1.0;
  },
  onResetView: () => {
    if (lastVolume) cameraFitToVolume(lastVolume);
  },
  onVolumeLoaded: (data) => {
    lastVolume = data;
    cameraFitToVolume(data);
    ui.setVolumeInfo(formatVolumeInfo(data));
  }
});

ui.setStatus('Scene ready. Drop DICOM files to load a volume.');

// ---- Resize --------------------------------------------------------------
function handleResize(): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  vol.resize(w, h);
}
window.addEventListener('resize', handleResize);
handleResize();

// ---- Render loop ---------------------------------------------------------
// ---- FPS counter --------------------------------------------------------
const clock = new Clock();
let frameCount = 0;
let fpsTimer = 0;
ui.setFps('— FPS');

function tick(): void {
  const delta = clock.getDelta();
  // Clamp first-frame or tab-switch deltas so the knot doesn't jump.
  const safeDelta = delta > 0 && delta < 0.1 ? delta : 0.016;
  controls.update();
  knot.rotation.y += safeDelta * 0.1; // ~6°/s independent of camera auto-rotate
  renderer.render(scene, camera);

  // FPS sampling: count frames in a 1s window.
  frameCount += 1;
  fpsTimer += delta;
  if (fpsTimer >= 1.0) {
    ui.setFps(`${frameCount} FPS`);
    frameCount = 0;
    fpsTimer = 0;
  }
  requestAnimationFrame(tick);
}
tick();

// Expose a tiny diagnostic handle for headless smoke tests.
(window as unknown as { __demoReady: boolean }).__demoReady = true;
