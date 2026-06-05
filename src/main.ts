// VolGL-based CBCT viewer with:
//   - DICOM volume rendering (ray-march in mm texture space)
//   - 3D model display (axes / grid / cube / 10cm reference sphere / ground plane in unit space)
//   - OBJ file loader for user-supplied meshes (dental implant, marker, etc.)
//
// The volume's mesh is scaled to its physical extent in mm and wrapped in
// a Group (volumeRoot) that is itself scaled by VOLUME_DISPLAY_SCALE so the
// rendered volume fits in the same unit space as the scene objects and any
// loaded 3D models. cameraFitToVolume accounts for the scale so the camera
// distance is correct in world units.

import {
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import {
  VolumeRenderer,
  loadDicomVolume,
  type VolumeData,
} from '@volgl/renderer';

import { addSceneObjects } from './scene-objects';
import { bindUi, type VolumeController } from './ui';

/** Scale factor that maps the volume's mm dimensions to a unit-scale space
 *  shared with the scene objects and any loaded 3D models. */
const VOLUME_DISPLAY_SCALE = 0.02;

async function main(): Promise<void> {
  // ---- Renderer / scene / camera ---------------------------------------
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  // ---- WebGL context loss handling --------------------------------------
  // When the browser decides to reclaim the WebGL context (typically
  // when the GPU runs out of memory, or the tab is sent to the
  // background and the OS evicts the context), the canvas flashes
  // and then stops rendering until the page is reloaded. We listen
  // for the event so we can (a) let the user know what's happening
  // via the status line and (b) try to recover by re-uploading the
  // volume texture on `webglcontextrestored` if we have one cached.
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    console.warn('[cbct-viewer-demo] WebGL context lost');
    ui.setStatus('WebGL context lost — recovering…', 'error');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    console.log('[cbct-viewer-demo] WebGL context restored');
    // The easiest correct path: if we have a volume cached, re-run
    // setVolume on the same data so the texture gets re-uploaded to
    // the fresh context. We do this synchronously in the next tick
    // to make sure the renderer is in a usable state.
    if (lastVolume) {
      queueMicrotask(() => {
        vol.setVolume(lastVolume!).catch((err) => {
          ui.setStatus(`Restore failed: ${(err as Error).message}`, 'error');
        });
        ui.setStatus('WebGL context restored — re-uploading volume…', 'progress');
      });
    } else {
      // No cached volume — ask the user to reload.
      ui.setStatus('WebGL context restored — please re-drop DICOM files.', 'error');
    }
  });

  const scene = new Scene();
  scene.background = new Color(0x0b0d12);

  const camera = new PerspectiveCamera(
    45,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    1000,
  );
  camera.position.set(2.2, 1.6, 2.4);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);

  scene.add(new AmbientLight(0xffffff, 0.6));
  const sun = new DirectionalLight(0xffffff, 0.7);
  sun.position.set(3, 4, 2);
  scene.add(sun);
  const rim = new DirectionalLight(0xa0b8ff, 0.3);
  rim.position.set(-3, 2, -1);
  scene.add(rim);

  // ---- Scene objects (axes, grid, cube, 10cm reference sphere, ground) ----
  // Stored in unit space; the volumeRoot below is scaled to match.
  // The 10cm reference sphere now lives in scene-objects.ts at the
  // same XZ as the old knot (-0.7, 0.2, 0) so it sits at the
  // bottom-front of the volume. depthTest: false + renderOrder 999
  // keep it always on top regardless of the volume's data.
  addSceneObjects(scene);

  // ---- Volume renderer (wrapped in a scaled Group) ---------------------
  // The volume mesh is scaled to the physical extent in mm (e.g.
  // 160×160×100). We wrap it in volumeRoot and apply
  // VOLUME_DISPLAY_SCALE so the volume fits in the same unit space as
  // the scene objects. The DICOM orientation (head up, anterior
  // toward camera) is now applied automatically by VolGL inside
  // VolumeCore, so we no longer need a manual rotation here — the
  // library handles axial / coronal / sagittal orientations uniformly.
  const volumeRoot = new Group();
  volumeRoot.name = 'CBCTVolume';
  volumeRoot.scale.setScalar(VOLUME_DISPLAY_SCALE);
  // Position the volume so the DICOM origin (ImagePositionPatient of
  // the first slice) maps to world (0, 0, 0). The DICOM origin voxel
  // sits at the box's (-0.5, -0.5, -0.5) corner in local space; after
  // the LPS→medical-pose orientation and 0.02 scale it lands at
  // (1.6, -1.0, -1.6) in volumeRoot-local units. Negating that puts
  // the DICOM origin at world (0, 0, 0), so the patient occupies
  // the same world-space bounding box the scanner produced and
  // reference objects (e.g. a 10 cm sphere at world (1.0, 0.5, 1.0)
  // or wherever) can be placed in CBCT-relative coordinates directly.
  volumeRoot.position.set(-1.6, 1.0, 1.6);
  scene.add(volumeRoot);

  // devicePixelRatio: see notes in handleResize — FBO must be sized to
  // the drawing buffer, not the CSS size, or back-face sampling breaks.
  const dpr = window.devicePixelRatio;

  const vol = new VolumeRenderer();
  vol.resize(canvas.clientWidth * dpr, canvas.clientHeight * dpr);
  volumeRoot.add(vol.root);

  // ---- Controller + UI binding ----------------------------------------
  let lastVolume: VolumeData | null = null;

  function cameraFitToVolume(volume: VolumeData): void {
    const [w, h, d] = volume.dimensions;
    const [sx, sy, sz] = volume.spacing;
    // Raw mm extents...
    const ex = sx * w, ey = sy * h, ez = sz * d;
    // ...then scaled into the same unit space as the scene objects so
    // the camera frames both the volume and any 3D models.
    const scaledEx = ex * VOLUME_DISPLAY_SCALE;
    const scaledEy = ey * VOLUME_DISPLAY_SCALE;
    const scaledEz = ez * VOLUME_DISPLAY_SCALE;
    const maxExtent = Math.max(scaledEx, scaledEy, scaledEz);
    const fovRad = (camera.fov * Math.PI) / 180;
    const dist = (maxExtent * 0.6) / Math.tan(fovRad * 0.5);
    camera.position.set(dist, dist * 0.75, dist);
    camera.near = Math.max(0.001, maxExtent * 0.001);
    camera.far = Math.max(20, maxExtent * 20);
    camera.updateProjectionMatrix();
    // The DICOM origin is anchored at world (0, 0, 0). The volume's
    // centre in world space is at half-extent along each world axis.
    // With VolGL's LPS_TO_MEDICAL_POSE the orientation maps:
    //   col (local +X) → world -X  →  centre.x = -scaledEx/2
    //   row (local +Y) → world +Z  →  centre.z =  scaledEy/2
    //   slice (local +Z) → world +Y →  centre.y =  scaledEz/2
    // Aim the orbit controls at that centre so the camera frames the
    // patient instead of staring at the bottom-back-left corner.
    controls.target.set(
      -scaledEx / 2,
      scaledEz / 2,
      scaledEy / 2,
    );
    controls.update();
  }

  function formatVolumeInfo(volume: VolumeData): string {
    const [w, h, d] = volume.dimensions;
    const [sx, sy, sz] = volume.spacing;
    const ex = sx * w, ey = sy * h, ez = sz * d;
    return `${w}×${h}×${d} · ${ex.toFixed(0)}×${ey.toFixed(0)}×${ez.toFixed(0)} mm`;
  }

  const controller: VolumeController = {
    setStepSize: (s) => vol.setStepSize(s),
    setEarlyRayTermination: (t) => vol.setEarlyRayTermination(t),
    setTransferFunction: (tf) => vol.setTransferFunction(tf),
    setWindowLevel: (level, width) => vol.setWindowLevel(level, width),
    setPreset: (name) => vol.setPreset(name),
    async setVolume(files: File[]): Promise<VolumeData> {
      const data = await loadDicomVolume(files);
      await vol.setVolume(data);
      lastVolume = data;
      cameraFitToVolume(data);
      ui.setVolumeInfo(formatVolumeInfo(data));
      ui.setResetEnabled(true);
      return data;
    },
  };

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
    },
  });

  // ---- 3D model (OBJ) loader ------------------------------------------
  // A separate hidden <input type="file"> lets the user drop/select an
  // .obj mesh (dental implant, fiducial marker, segmentation export).
  // Loaded models are added to sceneRoot so they sit alongside the scene
  // objects in unit space, then centered on the volume's origin and
  // scaled to a sensible size relative to a 100mm volume.
  const sceneRoot = new Group();
  sceneRoot.name = 'ImportedModels';
  scene.add(sceneRoot);

  const modelInput = document.createElement('input');
  modelInput.type = 'file';
  modelInput.accept = '.obj';
  modelInput.style.display = 'none';
  document.body.appendChild(modelInput);
  modelInput.addEventListener('change', () => {
    const file = modelInput.files?.[0];
    modelInput.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const objLoader = new OBJLoader();
        const obj = objLoader.parse(reader.result as string);
        // First, set the renderOrder on every mesh so the model
        // renders AFTER the volume. Then the dynamic-import
        // traversal below attaches the actual material with
        // depthTest: false so it survives the volume's ray-march
        // occlusion. This is the standard clinical-viewer behaviour:
        // a surgeon needs to see the implant / scan even when the
        // patient is "in front" of it from the camera's POV.
        obj.traverse((child) => {
          const mesh = child as unknown as {
            isMesh?: boolean;
            renderOrder?: number;
          };
          if (mesh.isMesh) mesh.renderOrder = 999;
        });
        // Now attach the actual metal-ceramic material.
        obj.traverse((child) => {
          const mesh = child as unknown as {
            isMesh?: boolean;
            material?: { depthTest?: boolean; depthWrite?: boolean; needsUpdate?: boolean };
          };
          if (mesh.isMesh) {
            import('three').then(({ MeshStandardMaterial, Color }) => {
              mesh.material = new MeshStandardMaterial({
                color: new Color(0x9bc3d4),
                metalness: 0.55,
                roughness: 0.35,
              });
              // Always-on-top so the implant / IOS scan stays
              // visible when it overlaps the volume.
              mesh.material.depthTest = false;
              mesh.material.depthWrite = false;
              mesh.material.needsUpdate = true;
            });
          }
        });
        // Normalise: center the bounding box on origin and scale so the
        // longest axis is ~0.4 units (well within the 3.2-unit volume box).
        // OBJLoader produces Group of Meshes; traverse to compute bbox.
        const bbox = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
        let first = true;
        obj.traverse((c) => {
          const mesh = c as unknown as {
            geometry?: {
              computeBoundingBox?: () => void;
              boundingBox?: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
            };
          };
          if (mesh.geometry?.computeBoundingBox) {
            mesh.geometry.computeBoundingBox();
            const bb = mesh.geometry.boundingBox!;
            if (first) {
              bbox.min.x = bb.min.x; bbox.min.y = bb.min.y; bbox.min.z = bb.min.z;
              bbox.max.x = bb.max.x; bbox.max.y = bb.max.y; bbox.max.z = bb.max.z;
              first = false;
            } else {
              bbox.min.x = Math.min(bbox.min.x, bb.min.x);
              bbox.min.y = Math.min(bbox.min.y, bb.min.y);
              bbox.min.z = Math.min(bbox.min.z, bb.min.z);
              bbox.max.x = Math.max(bbox.max.x, bb.max.x);
              bbox.max.y = Math.max(bbox.max.y, bb.max.y);
              bbox.max.z = Math.max(bbox.max.z, bb.max.z);
            }
          }
        });
        const cx = (bbox.min.x + bbox.max.x) / 2;
        const cy = (bbox.min.y + bbox.max.y) / 2;
        const cz = (bbox.min.z + bbox.max.z) / 2;
        const longest = Math.max(
          bbox.max.x - bbox.min.x,
          bbox.max.y - bbox.min.y,
          bbox.max.z - bbox.min.z,
        );
        const targetSize = 0.4;
        const scaleFactor = longest > 0 ? targetSize / longest : 1;
        obj.position.set(-cx * scaleFactor, -cy * scaleFactor, -cz * scaleFactor);
        obj.scale.setScalar(scaleFactor);
        sceneRoot.add(obj);
        ui.setStatus(`Imported ${file.name} (${(file.size / 1024).toFixed(1)} KB).`);
      } catch (err) {
        ui.setStatus(`OBJ parse failed: ${(err as Error).message}`, 'error');
      }
    };
    reader.onerror = () => ui.setStatus(`Read failed: ${reader.error?.message ?? 'unknown'}`, 'error');
    reader.readAsText(file);
  });

  // Wire the OBJ loader to a button we'll add to the side panel.
  const importBtn = document.getElementById('importObj') as HTMLButtonElement | null;
  if (importBtn) {
    importBtn.addEventListener('click', () => modelInput.click());
  }
  // Also accept .obj files dropped onto the window.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f && f.name.toLowerCase().endsWith('.obj')) {
      e.preventDefault();
      const dt = new DataTransfer();
      dt.items.add(f);
      modelInput.files = dt.files;
      modelInput.dispatchEvent(new Event('change'));
    }
  });

  ui.setStatus('Ready. Drop DICOM files to load a volume, or use "Import OBJ" for a 3D model.');

  // ---- Resize ----------------------------------------------------------
  function handleResize(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    vol.resize(w * dpr, h * dpr);
  }
  window.addEventListener('resize', handleResize);
  handleResize();

  // ---- Render loop ----------------------------------------------------
  const clock = new Clock();
  let frameCount = 0;
  let fpsTimer = 0;
  ui.setFps('— FPS');

  function tick(): void {
    const delta = clock.getDelta();
    controls.update();
    renderer.render(scene, camera);

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

  // ---- Debug hooks ---------------------------------------------------
  (window as unknown as { __demoReady: boolean }).__demoReady = true;
  (window as unknown as Record<string, unknown>).__debug = {
    renderer,
    scene,
    camera,
    controls,
    vol,
    volumeRoot,
    controller,
    sceneRoot,
    fitToVolume: () => {
      if (lastVolume) cameraFitToVolume(lastVolume);
    },
    getInfo: () => ({
      cameraPos: camera.position.toArray(),
      cameraNear: camera.near,
      cameraFar: camera.far,
      cameraTarget: controls.target.toArray(),
      volumeRootScale: volumeRoot.scale.toArray(),
      volumeRootRot: [volumeRoot.rotation.x, volumeRoot.rotation.y, volumeRoot.rotation.z],
      importedModelCount: sceneRoot.children.length,
      volumeLoaded: lastVolume
        ? { dimensions: lastVolume.dimensions, spacing: lastVolume.spacing }
        : null,
    }),
  };

  // Keyboard cheat-sheet for the shader diagnostic modes.
  //   0 normal composited output
  //   1 raw density (first sample, full HU range)
  //   2 back-face position (xyz -> rgb)
  //   3 step count (blue=stopped immediately, red=travelled the full box)
  //   4 transfer-function alpha sum along the ray
  //   5 normalized windowed density (post WL/WW, pre-LUT)
  window.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '5') {
      vol.setDebugMode(Number(e.key));
      ui.setStatus(`Debug mode: ${e.key}`);
    }
  });
}

main().catch((err) => {
  console.error(err);
  const status = document.getElementById('status');
  if (status) status.textContent = `Fatal: ${(err as Error).message}`;
});
