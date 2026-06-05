import {
  AxesHelper,
  BoxGeometry,
  CircleGeometry,
  GridHelper,
  Mesh,
  MeshStandardMaterial,
  TorusKnotGeometry,
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
  knot: Mesh;
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

  // Decorative blue torus knot — purely visual. Sits inside the
  // volume's world box (the user's original placement) so it reads
  // as a "tube through the patient" rather than a separate scene
  // element next to the box. The "real" fix for the user-reported
  // issue — knot disappearing at some angles — is to render it with
  // depthTest: false and a high renderOrder: then it always paints
  // on top of the volume regardless of whether the volume's
  // ray-march ray happens to traverse a tissue voxel at the knot's
  // screen pixel. Without this, the ray's alpha accumulation
  // (which integrates ALL the voxels the ray crosses, not just the
  // one under the knot) intermittently occludes the knot.
  const knot = new Mesh(
    new TorusKnotGeometry(0.3, 0.08, 100, 16),
    new MeshStandardMaterial({
      color: 0x58a6ff,
      roughness: 0.3,
      metalness: 0.2,
      depthTest: false,
      depthWrite: false,
    }),
  );
  knot.position.set(-0.7, 0.2, 0.0);
  knot.renderOrder = 999;
  scene.add(knot);

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

  return { axes, grid, cube, knot, ground };
}
