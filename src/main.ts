import {
  AmbientLight,
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
addSceneObjects(scene);

// ---- Volume renderer -----------------------------------------------------
const vol = new VolumeRenderer({ stepSize: 0.01, earlyRayTermination: 0.99 });
const volumeRoot = new Group();
volumeRoot.name = 'CBCTVolume';
volumeRoot.add(vol.root);
scene.add(volumeRoot);

// Adapter that the UI module talks to.
const controller: VolumeController = {
  setStepSize: (s) => vol.setStepSize(s),
  setEarlyRayTermination: (t) => vol.setEarlyRayTermination(t),
  setTransferFunction: (tf: TransferFunction) => vol.setTransferFunction(tf),
  async setVolume(files: File[]): Promise<void> {
    const data: VolumeData = await loadDicomVolume(files);
    await vol.setVolume(data);
  }
};

// ---- UI wiring -----------------------------------------------------------
const ui = bindUi(controller, {
  onAutoRotateChange: (enabled) => {
    controls.autoRotate = enabled;
    controls.autoRotateSpeed = 1.0;
  }
});

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
function tick(): void {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// Expose a tiny diagnostic handle for headless smoke tests.
(window as unknown as { __demoReady: boolean }).__demoReady = true;
ui.setStatus('Scene ready. Drop DICOM files to load a volume.');
