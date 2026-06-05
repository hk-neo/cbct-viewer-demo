import {
  AxesHelper,
  BoxGeometry,
  CircleGeometry,
  GridHelper,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type Object3D
} from 'three';

/**
 * Adds orientation helpers and decorative meshes to the scene.
 *
 * The returned `Object3D`s are added to the scene as side effects; the
 * function returns them so the caller can keep references if needed.
 */
export function addSceneObjects(scene: { add: (obj: Object3D) => void }): {
  axes: AxesHelper;
  grid: GridHelper;
  cube: Mesh;
  referenceSphere: Mesh;
  ground: Mesh;
} {
  // AxesHelper — RGBXYZ orientation (X red, Y green, Z blue), 1.0 unit long.
  const axes = new AxesHelper(1.0);
  scene.add(axes);

  // GridHelper — 10x10 units, divided into 20 cells. Sits on the ground plane.
  // The "ground" in this scene is the world Y=0 plane, which is also
  // where the DICOM origin of the volume is anchored (so the patient's
  // feet are resting on it).
  const grid = new GridHelper(10, 20, 0x444c56, 0x2a313a);
  grid.position.y = 0;
  scene.add(grid);

  // Decorative orange cube — proves we can compose a regular mesh with the volume.
  const cube = new Mesh(
    new BoxGeometry(0.4, 0.4, 0.4),
    new MeshStandardMaterial({ color: 0xff8a3d, roughness: 0.5, metalness: 0.1 })
  );
  cube.position.set(0.7, 0.2, 0.0);
  scene.add(cube);

  // 10 cm reference sphere. Placed at world (-0.7, 0.2, 0) — the same
  // XZ the blue knot used to live at, so the sphere is now the only
  // object occupying the "decorative scene element next to the volume"
  // slot. Painted with depthTest: false + renderOrder 999 so it's
  // always visible regardless of what the volume's ray-march ray is
  // doing (its colour is the scale reference for the volume).
  // With VOLUME_DISPLAY_SCALE = 0.02, 1 world unit = 50 mm so a 10 cm
  // diameter sphere is 2.0 world units across (radius 1.0).
  const referenceSphere = new Mesh(
    new SphereGeometry(1.0, 48, 32),
    new MeshStandardMaterial({
      color: 0xffd23f, // high-contrast yellow
      roughness: 0.35,
      metalness: 0.1,
      emissive: 0x402200,
      emissiveIntensity: 0.15,
      depthTest: false,
      depthWrite: false,
    }),
  );
  referenceSphere.name = 'ReferenceSphere10cm';
  referenceSphere.position.set(-0.7, 0.2, 0.0);
  referenceSphere.renderOrder = 999;
  scene.add(referenceSphere);

  // Subtle ground plane — gives the scene a floor.
  const ground = new Mesh(
    new CircleGeometry(8, 64),
    new MeshStandardMaterial({
      color: 0x1c2128,
      roughness: 0.9,
      metalness: 0.0
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  return { axes, grid, cube, referenceSphere, ground };
}
