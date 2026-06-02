# cbct-viewer-demo

A minimal Vite + TypeScript demo that shows how the
[`@volgl/renderer`](https://github.com/fotogrammer/VolGL) library integrates
with a regular Three.js scene. A `VolumeRenderer` is added to a scene that
also contains standard meshes (axes, grid, a cube, a torus knot, a ground
plane), and the volume shares the camera, `OrbitControls`, lights, and depth
buffer with those meshes.

## How to run

The library lives at `../VolGL/` and is wired in via `npm link` so that edits
to the library are picked up immediately by the dev server.

```bash
# One-time: register the local library as a global link
cd ../VolGL
npm install      # only needed if node_modules is missing
npm run build    # produces dist/ which the link points at
npm link

# Back in the demo
cd ../cbct-viewer-demo
npm install
npm link @volgl/renderer
npm run dev
```

Open <http://127.0.0.1:5173/> in a browser.

## Features

- Drop or pick a folder of `.dcm` slices to load a CBCT volume.
- 3 transfer-function presets (BONE / SOFT / LUNG) plus a per-preset
  Window Level / Window Width slider pair for radiology-style windowing.
- Step size and early ray termination sliders for tuning render cost.
- Camera reset (fit-to-volume) and FPS counter.
- Auto-rotate toggle for hands-free viewing.
- Coexists in the scene with axes, grid, cube, torus knot, and a
  ground plane — all sharing the same camera, OrbitControls, and
  depth buffer.

## How to use

1. Drag a folder of DICOM `.dcm` files onto the page (or click the drop
   zone to pick them with the file dialog).
2. The status line shows loading progress; on success the volume is
   rendered alongside the cube / torus knot / axes.
3. Use the sliders to tune `stepSize` and `earlyRayTermination`; click
   the preset button to flip between `CBCT_PRESETS.bone` and
   `CBCT_PRESETS.softTissue`; toggle "Auto-rotate" to spin the camera
   around the scene.

## What this demo shows

That `vol.root` is a `THREE.Group` like any other. The library only adds
two render passes; everything else (controls, lights, depth sorting with
other meshes) is just plain Three.js.

The drop zone is wired to `loadDicomVolume(files)` from the library, and
the result is fed into `vol.setVolume(data)`. No project-specific code
in the library — this is exactly the pattern from the library's README.
