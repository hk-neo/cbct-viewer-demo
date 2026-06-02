# cbct-viewer-demo: Polish + WL/WW + LUNG Preset + Anim — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `cbct-viewer-demo` to a professional demo with polished dark/orange theme, WL/WW sliders, LUNG preset, animated torus knot, camera reset, and an integrated dim/extent/FPS status line — backed by a small library API extension in `VolGL`.

**Architecture:** The plan is split into two phases. **Phase 1 (Tasks 1–4)** adds three small things to the `VolGL` library (`LUNG_PRESET` export, ray-march shader `uWindowLevel`/`uWindowWidth` uniforms with `RayMarchPass.setWindowLevel`, `VolumeRenderer.setWindowLevel`/`setPreset` + `CBCT_PRESET_DEFAULTS`) with TDD where applicable. **Phase 2 (Tasks 5–11)** consumes those APIs in `cbct-viewer-demo` to build the polished UI. Each task lands in one repo with its own commit.

**Tech Stack:** Three.js 0.170, Vite 8, TypeScript 5.4, Vitest. UI is plain HTML + CSS (no framework).

**Spec:** `docs/2026-06-02-demo-polish-design.md`

**Repository conventions:**
- Library work happens in `/Users/fotogrammer/Projects/VolGL` (npm scripts: `test`, `typecheck`, `build`, `demo`).
- Demo work happens in `/Users/fotogrammer/Projects/cbct-viewer-demo` (npm scripts: `dev`, `typecheck`, `build`).
- Commits in this plan reference the repo they're for explicitly in the commit message body.

**Working directory assumption:** all shell commands assume the engineer is `cd`'d into the right repo per task. Each task states the path explicitly in its **Step 0**.

---

## Phase 1: VolGL library changes

### Task 1: Add `LUNG_PRESET` to `VolGL/src/core/transfer-function.ts`

**Files:**
- Modify: `/Users/fotogrammer/Projects/VolGL/src/core/transfer-function.ts:1-27` (add LUNG_PRESET after SOFT_TISSUE_PRESET)
- Create: `/Users/fotogrammer/Projects/VolGL/src/__tests__/core/transfer-function-presets.test.ts`

**Step 0: cd into the library repo**

```bash
cd /Users/fotogrammer/Projects/VolGL
```

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/core/transfer-function-presets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { LUNG_PRESET, CBCT_BONE_PRESET, SOFT_TISSUE_PRESET } from '../../core/transfer-function.js';

describe('LUNG_PRESET', () => {
  it('is exported and is a valid TransferFunction', () => {
    expect(LUNG_PRESET).toBeDefined();
    expect(LUNG_PRESET.domain.min).toBeLessThan(LUNG_PRESET.domain.max);
    expect(LUNG_PRESET.controlPoints.length).toBeGreaterThanOrEqual(3);
  });

  it('has all control points inside its domain', () => {
    for (const p of LUNG_PRESET.controlPoints) {
      expect(p.density).toBeGreaterThanOrEqual(LUNG_PRESET.domain.min);
      expect(p.density).toBeLessThanOrEqual(LUNG_PRESET.domain.max);
    }
  });

  it('domain covers the air-to-soft-tissue range expected for lung CT', () => {
    // Lung window: -1000 (air) to -200 (dense tissue).
    expect(LUNG_PRESET.domain.min).toBeLessThanOrEqual(-900);
    expect(LUNG_PRESET.domain.max).toBeGreaterThanOrEqual(-300);
  });

  it('air is fully transparent at the low end', () => {
    const first = LUNG_PRESET.controlPoints[0];
    expect(first.density).toBeLessThanOrEqual(-1000);
    expect(first.opacity).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/core/transfer-function-presets.test.ts`
Expected: FAIL with `ReferenceError: LUNG_PRESET is not defined` (or import error).

- [ ] **Step 3: Add the LUNG_PRESET export**

Edit `src/core/transfer-function.ts`. Insert this block after the closing `};` of `SOFT_TISSUE_PRESET` (after line 27, before the `TransferFunction1D` class comment):

```ts
/** Default lung CT preset — emphasises lung parenchyma in the air-to-soft-tissue window. */
export const LUNG_PRESET: TransferFunction = {
  domain: { min: -1100, max: -200 },
  controlPoints: [
    { density: -1000, color: [0.0, 0.0, 0.0], opacity: 0.0 },   // air
    { density: -900,  color: [0.3, 0.4, 0.5], opacity: 0.05 },  // sparse parenchyma
    { density: -700,  color: [0.6, 0.7, 0.8], opacity: 0.35 },  // lung parenchyma
    { density: -500,  color: [0.8, 0.7, 0.7], opacity: 0.55 },  // soft tissue
    { density: -300,  color: [0.95, 0.6, 0.55], opacity: 0.8 }, // vessels
    { density: -200,  color: [1.0, 0.85, 0.75], opacity: 1.0 }, // dense tissue
  ],
};
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/__tests__/core/transfer-function-presets.test.ts`
Expected: PASS, 4 tests green.

- [ ] **Step 5: Run the full test suite to make sure nothing else regressed**

Run: `npm test`
Expected: all existing tests still pass plus the 4 new ones.

- [ ] **Step 6: Commit (in VolGL repo)**

```bash
cd /Users/fotogrammer/Projects/VolGL
git add src/core/transfer-function.ts src/__tests__/core/transfer-function-presets.test.ts
git commit -m "feat(transfer-function): add LUNG_PRESET for CT lung window

Emphasises lung parenchyma across the air-to-soft-tissue HU
range (-1000..-200). Air is fully transparent; soft tissue and
vessels rise to full opacity.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Add `lung` to `CBCT_PRESETS` in `VolGL/src/renderer/presets.ts`

**Files:**
- Modify: `/Users/fotogrammer/Projects/VolGL/src/renderer/presets.ts:2,14-17` (import LUNG_PRESET, add to map)
- Create: `/Users/fotogrammer/Projects/VolGL/src/__tests__/renderer/presets.test.ts`

**Step 0: cd**

```bash
cd /Users/fotogrammer/Projects/VolGL
```

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/renderer/presets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CBCT_PRESETS } from '../../renderer/presets.js';
import type { TransferFunction } from '../../core/types.js';

describe('CBCT_PRESETS', () => {
  it('exposes bone, softTissue, and lung', () => {
    expect(Object.keys(CBCT_PRESETS).sort()).toEqual(['bone', 'lung', 'softTissue']);
  });

  it('every entry is a valid TransferFunction', () => {
    for (const [name, tf] of Object.entries(CBCT_PRESETS)) {
      const tfTyped = tf as TransferFunction;
      expect(tfTyped.domain.min, `${name} domain.min`).toBeLessThan(tfTyped.domain.max);
      expect(tfTyped.controlPoints.length, `${name} controlPoints`).toBeGreaterThan(0);
      for (const p of tfTyped.controlPoints) {
        expect(p.density, `${name} cp.density`).toBeGreaterThanOrEqual(tfTyped.domain.min);
        expect(p.density, `${name} cp.density`).toBeLessThanOrEqual(tfTyped.domain.max);
        expect(p.opacity, `${name} cp.opacity`).toBeGreaterThanOrEqual(0);
        expect(p.opacity, `${name} cp.opacity`).toBeLessThanOrEqual(1);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/renderer/presets.test.ts`
Expected: FAIL — `Object.keys(CBCT_PRESETS).sort()` returns `['bone', 'softTissue']` so the equality fails.

- [ ] **Step 3: Add `lung` to the presets map**

Edit `src/renderer/presets.ts`. Replace the whole file with:

```ts
import type { TransferFunction } from '../core/types.js';
import { CBCT_BONE_PRESET, SOFT_TISSUE_PRESET, LUNG_PRESET } from '../core/transfer-function.js';

/**
 * Ready-made transfer-function presets for CBCT volume rendering.
 *
 * - `bone`: emphasises bone (and dense materials) with off-white tones,
 *   filtering out air and most soft tissue.
 * - `softTissue`: highlights soft tissue with a tighter HU window.
 * - `lung`: emphasises lung parenchyma in the air-to-soft-tissue
 *   window (-1000..-200 HU).
 *
 * All three are immutable; pass them to {@link VolumeRenderer.setTransferFunction}
 * or to the constructor options.
 */
export const CBCT_PRESETS = {
  bone: CBCT_BONE_PRESET as TransferFunction,
  softTissue: SOFT_TISSUE_PRESET as TransferFunction,
  lung: LUNG_PRESET as TransferFunction,
} as const;

export type PresetName = keyof typeof CBCT_PRESETS;
```

- [ ] **Step 3a: Re-export `PresetName` from the library's public entry**

Edit `src/renderer/index.ts`. Add a `PresetName` re-export alongside the existing `CBCT_PRESETS` line:

```ts
export { CBCT_PRESETS, type PresetName } from './presets.js';
```

This makes `import { type PresetName } from '@volgl/renderer'` work for consumers like `cbct-viewer-demo`.

- [ ] **Step 3b: Verify the existing test still passes after the index.ts change**

Run: `npx vitest run src/__tests__/renderer/presets.test.ts`
Expected: PASS (no behavior change, just an additional type re-export).

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/__tests__/renderer/presets.test.ts`
Expected: PASS, 2 tests green.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass (existing + new ones from Task 1 and 2).

- [ ] **Step 6: Commit**

```bash
cd /Users/fotogrammer/Projects/VolGL
git add src/renderer/presets.ts src/__tests__/renderer/presets.test.ts
git commit -m "feat(presets): expose LUNG_PRESET via CBCT_PRESETS.lung

Adds the third preset (lung) to the renderer-level presets map
and exports a PresetName type so consumers can write
volume.setPreset('lung' | 'bone' | 'softTissue') safely.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Add WL/WW uniforms to the ray-march shader + `setWindowLevel` on `RayMarchPass`

**Files:**
- Modify: `/Users/fotogrammer/Projects/VolGL/src/core/shaders/ray-march.glsl.ts` (add `uWindowLevel` / `uWindowWidth` uniforms, change normalization)
- Modify: `/Users/fotogrammer/Projects/VolGL/src/three/ray-march-pass.ts` (add the two uniforms to the material, add `setWindowLevel` method)
- Modify: `/Users/fotogrammer/Projects/VolGL/src/__tests__/core/shaders.test.ts` (add tests for the new uniforms and the new normalization line)

**Step 0: cd**

```bash
cd /Users/fotogrammer/Projects/VolGL
```

- [ ] **Step 1: Write the failing shader test**

Edit `src/__tests__/core/shaders.test.ts`. Add these tests inside the existing `describe('shader sources', () => { ... })` block (or a new sibling block — either is fine):

```ts
  it('ray-march shader declares uWindowLevel and uWindowWidth uniforms', () => {
    expect(RAY_MARCH_FRAGMENT).toMatch(/uniform\s+float\s+uWindowLevel/);
    expect(RAY_MARCH_FRAGMENT).toMatch(/uniform\s+float\s+uWindowWidth/);
  });

  it('ray-march shader normalizes density using uWindowLevel/uWindowWidth (no hardcoded +1024 / 5119)', () => {
    // After A-direction change, the normalization is
    //   clamp((density - (uWindowLevel - uWindowWidth * 0.5)) / uWindowWidth, 0.0, 1.0)
    // and the old hardcoded "(density + 1024.0) / 5119.0" must be gone.
    expect(RAY_MARCH_FRAGMENT).not.toMatch(/density\s*\+\s*1024\.0\s*\)\s*\/\s*5119\.0/);
    expect(RAY_MARCH_FRAGMENT).toMatch(/clamp\s*\(\s*\(\s*density\s*-\s*\(?\s*uWindowLevel/);
    expect(RAY_MARCH_FRAGMENT).toMatch(/uWindowWidth\s*\*\s*0\.5\s*\)?\s*\)\s*\/\s*uWindowWidth\s*,\s*0\.0\s*,\s*1\.0\s*\)/);
  });
```

- [ ] **Step 2: Run test, expect failure**

Run: `npx vitest run src/__tests__/core/shaders.test.ts`
Expected: FAIL — the new assertions don't match the current shader (no `uWindowLevel`, has the old `(density + 1024.0) / 5119.0`).

- [ ] **Step 3: Add the uniforms and change the normalization in the shader**

Edit `src/core/shaders/ray-march.glsl.ts`. Replace the current `RAY_MARCH_FRAGMENT` (the entire `export const RAY_MARCH_FRAGMENT = \`...\`;` block) with the new content. The current top of the fragment source is:

```glsl
export const RAY_MARCH_FRAGMENT = `in vec3 vPosition;

uniform sampler2D uBackFace;
uniform sampler3D uVolume;
uniform sampler2D uTransferFunction;
uniform vec2 uScreenSize;
uniform float uStepSize;
uniform float uEarlyRayTermination;
```

Change the `uniform` block to add `uWindowLevel` and `uWindowWidth`:

```glsl
export const RAY_MARCH_FRAGMENT = `in vec3 vPosition;

uniform sampler2D uBackFace;
uniform sampler3D uVolume;
uniform sampler2D uTransferFunction;
uniform vec2 uScreenSize;
uniform float uStepSize;
uniform float uEarlyRayTermination;
uniform float uWindowLevel;
uniform float uWindowWidth;
```

And inside `main()`, replace the line `float normDensity = (density + 1024.0) / 5119.0;` with:

```glsl
    float normDensity = clamp((density - (uWindowLevel - uWindowWidth * 0.5)) / uWindowWidth, 0.0, 1.0);
```

Also update the file's top-of-file doc comment block (lines 1-16) to mention the new uniforms — add a bullet: `  uBackFace, uVolume, uTransferFunction, uScreenSize`  →  `  uBackFace, uVolume, uTransferFunction, uScreenSize, uWindowLevel, uWindowWidth`.

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/__tests__/core/shaders.test.ts`
Expected: PASS — the existing 2 shader tests still pass, the 2 new ones now pass.

- [ ] **Step 5: Add `setWindowLevel` to `RayMarchPass`**

Edit `src/three/ray-march-pass.ts`. Find the class. You'll need to:

1. Add a private field for the two uniforms:

```ts
  private windowLevel: number = 400;
  private windowWidth: number = 1500;
```

(Place these near the other private fields like `stepSize`, `earlyRayTerm`.)

2. In the constructor (or wherever `setUniform`/`setStepSize` are wired), add:

```ts
    this.material.uniforms.uWindowLevel = { value: this.windowLevel };
    this.material.uniforms.uWindowWidth = { value: this.windowWidth };
```

(Place this right after the existing `setStepSize` / `setEarlyRayTermination` uniform assignments.)

3. Add the public method on the class:

```ts
  setWindowLevel(level: number, width: number): void {
    if (width <= 0) {
      throw new Error(`setWindowLevel: width must be > 0, got ${width}`);
    }
    this.windowLevel = level;
    this.windowWidth = width;
    this.material.uniforms.uWindowLevel.value = level;
    this.material.uniforms.uWindowWidth.value = width;
  }
```

(Place this near `setStepSize` / `setEarlyRayTermination`.)

> Note: this is NOT a TDD task — Three.js shader uniforms are not exercised in the existing test suite. We rely on the manual smoke test in Task 10. If the engineer wants a unit test here, they can add a `RayMarchPass` test that constructs the class (with a mock WebGLRenderer) and asserts the uniform values after `setWindowLevel`. But the existing pattern in `src/__tests__/three/volume-core.test.ts` is light-touch (just verifies the setter doesn't throw on a constructed instance). Mirror that pattern.

- [ ] **Step 6: Run typecheck — expect errors in `VolumeCore` / `VolumeRenderer` (next task)**

Run: `npm run typecheck`
Expected: clean (the new shader uniforms default to sensible values, and `setWindowLevel` on `RayMarchPass` is just an addition).

- [ ] **Step 7: Commit (VolGL)**

```bash
cd /Users/fotogrammer/Projects/VolGL
git add src/core/shaders/ray-march.glsl.ts src/three/ray-march-pass.ts src/__tests__/core/shaders.test.ts
git commit -m "feat(ray-march): add uWindowLevel/uWindowWidth uniforms + setWindowLevel

The previous ray-march shader normalised density with a hardcoded
(density + 1024) / 5119, ignoring any window/level the user set
on the transfer function. This made WL/WW sliders a no-op
visually — only the LUT changed (and even that was byte-identical
under proportional control-point remap).

This change adds uWindowLevel and uWindowWidth uniforms and uses
them directly in the density normalisation:

  t = clamp((density - (level - width/2)) / width, 0, 1)

The LUT now stays a pure color curve; windowing is applied per
fragment. The LUT is not rebuilt when WL/WW changes, so the
expensive texture upload is skipped.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Add `setWindowLevel` + `setPreset` delegation through VolumeCore/VolumeRenderer + preset defaults

**Files:**
- Modify: `/Users/fotogrammer/Projects/VolGL/src/renderer/presets.ts` (add `CBCT_PRESET_DEFAULTS` export)
- Modify: `/Users/fotogrammer/Projects/VolGL/src/renderer/presets.ts` (already exports `CBCT_PRESETS` and `PresetName` from Task 2)
- Modify: `/Users/fotogrammer/Projects/VolGL/src/renderer/index.ts` (re-export `CBCT_PRESET_DEFAULTS`)
- Modify: `/Users/fotogrammer/Projects/VolGL/src/renderer/volume-renderer.ts` (add `setWindowLevel` + `setPreset`)
- Modify: `/Users/fotogrammer/Projects/VolGL/src/three/volume-core.ts` (add `setWindowLevel` that delegates to rayMarch)
- Create: `/Users/fotogrammer/Projects/VolGL/src/__tests__/renderer/volume-renderer.test.ts` (integration test for the new methods)

**Step 0: cd**

```bash
cd /Users/fotogrammer/Projects/VolGL
```

- [ ] **Step 1: Add `CBCT_PRESET_DEFAULTS` to `presets.ts`**

Edit `src/renderer/presets.ts`. Append this block at the end of the file (after the `PresetName` type):

```ts
/**
 * Default window/level for each preset. When the user picks a preset
 * via {@link VolumeRenderer.setPreset}, the WL/WW sliders snap to these
 * values.
 */
export const CBCT_PRESET_DEFAULTS: Record<PresetName, { level: number; width: number }> = {
  bone:       { level: 400,  width: 1500 },
  softTissue: { level: 50,   width: 400 },
  lung:       { level: -600, width: 1500 },
};
```

- [ ] **Step 2: Re-export `CBCT_PRESET_DEFAULTS` from the public entry**

Edit `src/renderer/index.ts`. Add a new line below the existing `CBCT_PRESETS, type PresetName` re-export:

```ts
export { CBCT_PRESETS, CBCT_PRESET_DEFAULTS, type PresetName } from './presets.js';
```

- [ ] **Step 3: Write the failing test**

Create `src/__tests__/renderer/volume-renderer.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { VolumeRenderer } from '../../renderer/volume-renderer.js';
import { Group } from 'three';
import { CBCT_PRESET_DEFAULTS } from '../../renderer/presets.js';

describe('VolumeRenderer', () => {
  let vol: VolumeRenderer;
  beforeEach(() => {
    vol = new VolumeRenderer();
  });

  it('exposes a Group as `root`', () => {
    expect(vol.root).toBeInstanceOf(Group);
  });

  it('setWindowLevel is callable and does not throw', () => {
    expect(() => vol.setWindowLevel(400, 1500)).not.toThrow();
  });

  it('setPreset is callable with all preset names', () => {
    expect(() => vol.setPreset('bone')).not.toThrow();
    expect(() => vol.setPreset('softTissue')).not.toThrow();
    expect(() => vol.setPreset('lung')).not.toThrow();
  });

  it('CBCT_PRESET_DEFAULTS has the expected level/width for each preset', () => {
    expect(CBCT_PRESET_DEFAULTS.bone).toEqual({ level: 400, width: 1500 });
    expect(CBCT_PRESET_DEFAULTS.softTissue).toEqual({ level: 50, width: 400 });
    expect(CBCT_PRESET_DEFAULTS.lung).toEqual({ level: -600, width: 1500 });
  });

  it('dispose() prevents further API calls', () => {
    vol.dispose();
    expect(() => vol.setStepSize(0.01)).not.toThrow();   // disposed methods are no-ops
    expect(() => vol.setWindowLevel(400, 1500)).not.toThrow();
  });
});
```

- [ ] **Step 4: Run test, expect failure (methods missing)**

Run: `npx vitest run src/__tests__/renderer/volume-renderer.test.ts`
Expected: FAIL — `vol.setWindowLevel is not a function` and `CBCT_PRESET_DEFAULTS` undefined.

- [ ] **Step 5: Implement `setWindowLevel` and `setPreset` on `VolumeRenderer`**

Edit `src/renderer/volume-renderer.ts`:

1. Update the import from `./presets.js` to also import `CBCT_PRESET_DEFAULTS`:

```ts
import { CBCT_PRESETS, CBCT_PRESET_DEFAULTS, type PresetName } from './presets.js';
```

2. Add these methods to the `VolumeRenderer` class. Place them right after `setTransferFunction` (after line 86), before `setStepSize`:

```ts
  /**
   * Apply a window/level. The two values are pushed to the ray-march
   * shader as `uWindowLevel` / `uWindowWidth` uniforms; the LUT is
   * not rebuilt. After this call, the visible HU range becomes
   * [level - width/2, level + width/2].
   *
   * Does nothing if the renderer has been disposed.
   */
  setWindowLevel(level: number, width: number): void {
    if (this.disposed) return;
    this.core.setWindowLevel(level, width);
  }

  /**
   * Switch to one of the built-in presets. Sets the transfer function
   * AND resets WL/WW to the preset's defaults (see
   * {@link CBCT_PRESET_DEFAULTS}).
   */
  setPreset(name: PresetName): void {
    if (this.disposed) return;
    this.core.setTransferFunction(CBCT_PRESETS[name]);
    const def = CBCT_PRESET_DEFAULTS[name];
    this.core.setWindowLevel(def.level, def.width);
  }
```

- [ ] **Step 6: Add `setWindowLevel` to `VolumeCore`**

Edit `src/three/volume-core.ts`. Add this method right after `setTransferFunction` (after line 87, before `setStepSize`):

```ts
  setWindowLevel(level: number, width: number): void {
    if (this.disposed) return;
    this.rayMarch.setWindowLevel(level, width);
  }
```

(Note: we don't touch `TransferFunction1D` — the LUT stays a pure color curve.)

- [ ] **Step 7: Run the test, verify it passes**

Run: `npx vitest run src/__tests__/renderer/volume-renderer.test.ts`
Expected: PASS, 5 tests green.

- [ ] **Step 8: Run the full test suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass; typecheck clean.

- [ ] **Step 9: Commit**

```bash
cd /Users/fotogrammer/Projects/VolGL
git add src/renderer/presets.ts src/renderer/index.ts src/renderer/volume-renderer.ts src/three/volume-core.ts src/__tests__/renderer/volume-renderer.test.ts
git commit -m "feat(renderer): setWindowLevel + setPreset via shader uniforms

- setWindowLevel pushes level/width to the ray-march shader
  uniforms (added in the previous commit); the LUT is not rebuilt.
- setPreset selects the preset TF AND snaps WL/WW to the
  preset's defaults from CBCT_PRESET_DEFAULTS.
- CBCT_PRESET_DEFAULTS is re-exported from the public entry so
  consumers can read (and override) the defaults.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Build the library and verify `cbct-viewer-demo` picks up the new types

**Files:** (no edits — just verification)

- [ ] **Step 1: Build the library**

```bash
cd /Users/fotogrammer/Projects/VolGL
npm run build
```

Expected: `dist/index.d.ts` and `dist/index.js` regenerated. No errors.

- [ ] **Step 2: Verify the new types appear in the declaration file**

Run: `grep -E "setWindowLevel|setPreset" /Users/fotogrammer/Projects/VolGL/dist/index.d.ts`
Expected: at least one match (the new public methods).

If cbct-viewer-demo is wired with `file:../VolGL` in its `package.json`, the typecheck in Step 3 will use this dist output. If it's wired differently, the engineer should check `cbct-viewer-demo/package.json` and update if needed — but for the purposes of this plan, we assume the file-reference is already in place (the cbct-viewer-demo README says it integrates `@volgl/renderer`).

- [ ] **Step 3: Sanity-check the existing demo still typechecks**

```bash
cd /Users/fotogrammer/Projects/VolGL
npm run typecheck
```

Expected: clean.

> If the typecheck picks up the cbct-viewer-demo source (it shouldn't, since each repo is independent), stop and resolve before continuing to Phase 2.

---

## Phase 2: cbct-viewer-demo UI changes

### Task 6: Update `VolumeController` interface in `src/ui.ts`

**Files:**
- Modify: `/Users/fotogrammer/Projects/cbct-viewer-demo/src/ui.ts:1-15` (extend `VolumeController` and `UiHandlers`)

**Step 0: cd**

```bash
cd /Users/fotogrammer/Projects/cbct-viewer-demo
```

- [ ] **Step 1: Extend the imports**

Edit `src/ui.ts`. Replace the import line at the top of the file:

```ts
import {
  CBCT_PRESETS,
  type PresetName,
  type TransferFunction,
  type VolumeData
} from '@volgl/renderer';
```

(Add `PresetName` and `VolumeData` to the existing import — drop any imports that are no longer used after Step 2.)

- [ ] **Step 2: Extend `VolumeController`**

Replace the `VolumeController` interface (the current top-of-file block) with:

```ts
export interface VolumeController {
  setStepSize(size: number): void;
  setEarlyRayTermination(t: number): void;
  setTransferFunction(tf: TransferFunction): void;
  setWindowLevel(level: number, width: number): void;
  setPreset(name: PresetName): void;
  setVolume(files: File[]): Promise<VolumeData>;
}
```

- [ ] **Step 3: Extend `UiBindings` to allow status text and kind**

Replace the existing `UiBindings` interface with:

```ts
export interface UiBindings {
  setStatus(text: string, kind?: 'info' | 'error' | 'progress'): void;
  setVolumeInfo(text: string): void;
  setFps(text: string): void;
  setResetEnabled(enabled: boolean): void;
}
```

(We'll wire up the new methods inside `bindUi` over the next few tasks.)

- [ ] **Step 4: Verify the existing code still typechecks**

Run: `npm run typecheck`
Expected: errors about `setWindowLevel`, `setPreset`, `setVolumeInfo`, `setFps`, `setResetEnabled` not being implemented in the controller/bindings. These will be resolved in Tasks 7–9.

That's the expected state — proceed.

- [ ] **Step 5: Commit a checkpoint so the interface widening is atomic**

```bash
cd /Users/fotogrammer/Projects/cbct-viewer-demo
git add src/ui.ts
git commit -m "refactor(ui): widen VolumeController + UiBindings for new features

Adds setWindowLevel, setPreset to the controller, and exposes
setVolumeInfo/setFps/setResetEnabled through the bindings so the
UI module can plug into a richer status line.

No behavior change yet — Task 7+ wires the new endpoints.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Add dim/extent/FPS status line and 3-chip preset row in `index.html`

**Files:**
- Modify: `/Users/fotogrammer/Projects/cbct-viewer-demo/index.html` (CSS tokens, sidebar markup, drop-zone status line)

- [ ] **Step 1: Add the new CSS tokens and styles**

Edit `index.html`. Inside the `<style>` block, **replace the `:root { ... }` block** with the following (existing tokens preserved, new ones added):

```css
:root {
  color-scheme: dark;
  --bg: #0e1116;
  --panel: #161b22;
  --panel-2: #1c232c;
  --border: #30363d;
  --border-strong: #3a4148;
  --text: #c9d1d9;
  --muted: #8b949e;
  --accent: #ff8a3d;
  --accent-2: #58a6ff;
  --accent-grad: linear-gradient(135deg, #ff8a3d 0%, #58a6ff 100%);
  --danger: #f85149;
  --radius-card: 8px;
  --radius-chip: 10px;
  --shadow-card: 0 1px 0 rgba(255, 255, 255, 0.03) inset,
                 0 4px 14px rgba(0, 0, 0, 0.4);
}
```

- [ ] **Step 2: Restyle `.group` as a card**

Find the existing `.group { ... }` rule and replace it with:

```css
.group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 12px 14px;
  box-shadow: var(--shadow-card);
}
.group > h2 {
  margin: 0 0 2px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--muted);
}
.group label {
  display: flex;
  justify-content: space-between;
  align-size: 12px;
  font-size: 12px;
  color: var(--muted);
}
.group label .val {
  color: var(--text);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}
input[type="range"] {
  width: 100%;
  accent-color: var(--accent);
  height: 18px; /* bigger hit area */
}
```

- [ ] **Step 3: Add chip-row styles**

Add these rules just after the `input[type="range"]` block:

```css
.chip-row {
  display: flex;
  gap: 6px;
}
.chip {
  flex: 1;
  text-align: center;
  background: transparent;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-chip);
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.chip:hover { background: rgba(255, 138, 61, 0.06); color: var(--text); }
.chip.active {
  background: var(--accent-grad);
  color: #0e1116;
  border-color: transparent;
  font-weight: 600;
}
button.ghost {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  width: 100%;
  transition: background 120ms ease;
}
button.ghost:hover:not(:disabled) { background: rgba(255, 138, 61, 0.06); }
button.ghost:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 4: Restyle the existing footer button to keep visual parity**

Find the existing `button { ... }` and `button.primary { ... }` rules and replace them with:

```css
button {
  font-family: inherit;
}
button.primary {
  background: var(--accent);
  color: #0e1116;
  border: 1px solid var(--accent);
  border-radius: var(--radius-card);
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 120ms ease;
}
button.primary:hover { filter: brightness(1.05); }
```

- [ ] **Step 5: Add a `.status-row` style for the dim/extent/FPS line**

Add just below the existing `#status` rules:

```css
.status-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 8px 12px;
  font-family: "SF Mono", "JetBrains Mono", Menlo, monospace;
  font-size: 11px;
  color: var(--muted);
  box-shadow: var(--shadow-card);
}
.status-row .vol-info { color: var(--text); }
.status-row .fps { color: var(--muted); }
```

- [ ] **Step 6: Update the sidebar markup**

Find the `<aside id="ui">` block in `index.html`. Replace its **entire contents** (everything between `<aside id="ui">` and `</aside>`) with:

```html
<div>
  <h1>CBCT Viewer Demo</h1>
  <p class="subtitle">@volgl/renderer &middot; Three.js scene integration</p>
</div>

<div id="drop">
  <strong>Drop DICOM files here</strong>
  <div class="hint">or click to select a folder of <code>.dcm</code> slices</div>
  <input id="filepicker" type="file" multiple accept=".dcm,application/dicom" hidden />
</div>

<div class="status-row">
  <span class="vol-info" id="volInfo">—</span>
  <span class="fps" id="fps">—</span>
</div>
<div id="status">Awaiting DICOM data.</div>

<div class="group">
  <h2>Transfer function</h2>
  <div class="chip-row" role="tablist" aria-label="Transfer function preset">
    <button id="chip-bone"      class="chip active" data-preset="bone"      role="tab" aria-selected="true">BONE</button>
    <button id="chip-softTissue" class="chip"        data-preset="softTissue" role="tab" aria-selected="false">SOFT</button>
    <button id="chip-lung"      class="chip"        data-preset="lung"       role="tab" aria-selected="false">LUNG</button>
  </div>
  <label>Window Level <span class="val" id="wlVal">400</span></label>
  <input id="wl" type="range" min="-1000" max="3000" step="1" value="400" />
  <label>Window Width <span class="val" id="wwVal">1500</span></label>
  <input id="ww" type="range" min="50" max="4000" step="1" value="1500" />
</div>

<div class="group">
  <h2>Render</h2>
  <label>Step size <span class="val" id="stepSizeVal">0.010</span></label>
  <input id="stepSize" type="range" min="0.001" max="0.05" step="0.001" value="0.01" />
  <label>Early ray termination <span class="val" id="ertVal">0.99</span></label>
  <input id="ert" type="range" min="0.5" max="1.0" step="0.01" value="0.99" />
</div>

<div class="group">
  <h2>Camera</h2>
  <button id="resetCam" class="ghost" disabled>Reset view</button>
</div>

<div class="group">
  <h2>Scene</h2>
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>Auto-rotate</span>
    <input id="autoRotate" type="checkbox" />
  </label>
</div>

<div class="footer">
  The CBCT volume shares the camera, <code>OrbitControls</code>, and depth buffer with the other
  meshes (axes, grid, cube, torus knot, ground plane). Drag to orbit, scroll to zoom.
</div>
```

> Note: the existing `<button id="presetBtn" class="primary">Preset: bone</button>` is removed; the 3-chip row replaces it.

- [ ] **Step 7: Run typecheck — expect errors about removed `presetBtn`**

Run: `npm run typecheck`
Expected: TS error like `Property 'presetBtn' does not exist` in `src/ui.ts`. That's expected — Task 8 rewires the UI module.

- [ ] **Step 8: Commit a UI-only checkpoint**

```bash
cd /Users/fotogrammer/Projects/cbct-viewer-demo
git add index.html
git commit -m "feat(ui): redesign sidebar with grouped cards + 3 preset chips

Splits the sidebar into Transfer-function / Render / Camera /
Scene groups, each as a card. Adds 3 preset chips (BONE/SOFT/LUNG),
WL/WW sliders, and a Camera group with a Reset-view button. Adds
a dim/extent/FPS status row.

Behavior wired in subsequent commits.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Rewire `src/ui.ts` to drive the new widgets

**Files:**
- Modify: `/Users/fotogrammer/Projects/cbct-viewer-demo/src/ui.ts` (rewrite most of `bindUi`)

**Step 0: cd**

```bash
cd /Users/fotogrammer/Projects/cbct-viewer-demo
```

- [ ] **Step 1: Replace `bindUi` body with the new wiring**

The shape of the change is significant; the cleanest move is to **replace the entire `bindUi` function** with the version below. Locate the `export function bindUi(...)` and replace everything from the function signature through the closing `}` of the function.

```ts
export function bindUi(volume: VolumeController, handlers: UiHandlers): UiBindings {
  const drop = document.getElementById('drop') as HTMLDivElement;
  const filepicker = document.getElementById('filepicker') as HTMLInputElement;
  const status = document.getElementById('status') as HTMLDivElement;
  const volInfo = document.getElementById('volInfo') as HTMLSpanElement;
  const fps = document.getElementById('fps') as HTMLSpanElement;
  const chipBone = document.getElementById('chip-bone') as HTMLButtonElement;
  const chipSoft = document.getElementById('chip-softTissue') as HTMLButtonElement;
  const chipLung = document.getElementById('chip-lung') as HTMLButtonElement;
  const wl = document.getElementById('wl') as HTMLInputElement;
  const wlVal = document.getElementById('wlVal') as HTMLSpanElement;
  const ww = document.getElementById('ww') as HTMLInputElement;
  const wwVal = document.getElementById('wwVal') as HTMLSpanElement;
  const stepSize = document.getElementById('stepSize') as HTMLInputElement;
  const stepSizeVal = document.getElementById('stepSizeVal') as HTMLSpanElement;
  const ert = document.getElementById('ert') as HTMLInputElement;
  const ertVal = document.getElementById('ertVal') as HTMLSpanElement;
  const resetCam = document.getElementById('resetCam') as HTMLButtonElement;
  const autoRotate = document.getElementById('autoRotate') as HTMLInputElement;

  function setStatus(text: string, kind: 'info' | 'error' | 'progress' = 'info'): void {
    status.textContent = text;
    status.classList.remove('error', 'progress');
    if (kind === 'error') status.classList.add('error');
    if (kind === 'progress') status.classList.add('progress');
  }

  function setVolumeInfo(text: string): void {
    volInfo.textContent = text;
  }

  function setFpsText(text: string): void {
    fps.textContent = text;
  }

  function setResetEnabled(enabled: boolean): void {
    resetCam.disabled = !enabled;
  }

  // ---- Drop zone ---------------------------------------------------------
  function preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
    drop.addEventListener(evt, preventDefaults);
  });
  ['dragenter', 'dragover'].forEach((evt) => {
    drop.addEventListener(evt, () => drop.classList.add('over'));
  });
  ['dragleave', 'drop'].forEach((evt) => {
    drop.addEventListener(evt, () => drop.classList.remove('over'));
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) await loadFiles(files);
  });
  drop.addEventListener('click', () => filepicker.click());
  filepicker.addEventListener('change', async () => {
    if (filepicker.files) {
      const files = Array.from(filepicker.files);
      filepicker.value = '';
      if (files.length > 0) await loadFiles(files);
    }
  });

  async function loadFiles(files: File[]): Promise<void> {
    setStatus(`Loading ${files.length} file(s)…`, 'progress');
    try {
      await volume.setVolume(files);
      setStatus(`Loaded ${files.length} DICOM slice(s).`, 'info');
      setResetEnabled(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to load volume: ${msg}`, 'error');
    }
  }

  // ---- Preset chips ------------------------------------------------------
  const chips: Array<{ btn: HTMLButtonElement; name: PresetName }> = [
    { btn: chipBone, name: 'bone' },
    { btn: chipSoft, name: 'softTissue' },
    { btn: chipLung, name: 'lung' },
  ];
  function activateChip(name: PresetName): void {
    for (const c of chips) {
      const active = c.name === name;
      c.btn.classList.toggle('active', active);
      c.btn.setAttribute('aria-selected', active ? 'true' : 'false');
    }
  }
  // Per-preset WL/WW defaults.
  const PRESET_DEFAULTS: Record<PresetName, { level: number; width: number }> = {
    bone:      { level: 400,  width: 1500 },
    softTissue:{ level: 50,   width: 400 },
    lung:      { level: -600, width: 1500 },
  };
  for (const c of chips) {
    c.btn.addEventListener('click', () => {
      activateChip(c.name);
      volume.setPreset(c.name);
      const def = PRESET_DEFAULTS[c.name];
      wl.value = String(def.level);
      ww.value = String(def.width);
      wlVal.textContent = String(def.level);
      wwVal.textContent = String(def.width);
      // Re-apply the default window so the slider state is in sync
      // with what the renderer just received from setPreset.
      volume.setWindowLevel(def.level, def.width);
    });
  }

  // ---- WL/WW sliders -----------------------------------------------------
  wl.addEventListener('input', () => {
    const v = parseFloat(wl.value);
    wlVal.textContent = String(v);
    volume.setWindowLevel(v, parseFloat(ww.value));
  });
  ww.addEventListener('input', () => {
    const v = parseFloat(ww.value);
    wwVal.textContent = String(v);
    volume.setWindowLevel(parseFloat(wl.value), v);
  });

  // ---- Step / ERT sliders ------------------------------------------------
  stepSize.addEventListener('input', () => {
    const v = parseFloat(stepSize.value);
    stepSizeVal.textContent = v.toFixed(3);
    volume.setStepSize(v);
  });
  ert.addEventListener('input', () => {
    const v = parseFloat(ert.value);
    ertVal.textContent = v.toFixed(2);
    volume.setEarlyRayTermination(v);
  });

  // ---- Reset view --------------------------------------------------------
  resetCam.addEventListener('click', () => {
    handlers.onResetView();
  });

  // ---- Auto-rotate -------------------------------------------------------
  autoRotate.addEventListener('change', () => {
    handlers.onAutoRotateChange(autoRotate.checked);
  });

  return { setStatus, setVolumeInfo, setFps: setFpsText, setResetEnabled };
}
```

- [ ] **Step 2: Add the `onResetView` handler to `UiHandlers`**

Edit the `UiHandlers` interface (above `bindUi`):

```ts
export interface UiHandlers {
  onAutoRotateChange(enabled: boolean): void;
  onResetView(): void;
}
```

- [ ] **Step 3: Run typecheck — expect errors in `src/main.ts` (not yet wired)**

Run: `npm run typecheck`
Expected: errors in `src/main.ts` about missing `setWindowLevel`, `setPreset`, and missing `handlers.onResetView`. Resolved in Task 9.

- [ ] **Step 4: Commit**

```bash
cd /Users/fotogrammer/Projects/cbct-viewer-demo
git add src/ui.ts
git commit -m "refactor(ui): drive 3 preset chips, WL/WW, reset, vol-info, fps

Wires the new widgets declared in the previous index.html
commit. Exposes setVolumeInfo/setFps/setResetEnabled through
UiBindings so main.ts can keep the status row in sync.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Wire `src/main.ts` to the new controller methods + camera fit + knot rotation + FPS

**Files:**
- Modify: `/Users/fotogrammer/Projects/cbct-viewer-demo/src/main.ts` (controller, tick loop, reset handler, knot rotation, FPS counter)

**Step 0: cd**

```bash
cd /Users/fotogrammer/Projects/cbct-viewer-demo
```

- [ ] **Step 1: Update imports — add `Clock` from three and `CBCT_PRESETS` is not needed here (lives in ui.ts)**

Edit the top of `src/main.ts`. The import from three becomes:

```ts
import {
  AmbientLight,
  Clock,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  WebGLRenderer
} from 'three';
```

(`Clock` is added; other imports stay as they are.)

The `@volgl/renderer` import stays as is — `VolumeData` is already imported, and the new library methods (`setWindowLevel`, `setPreset`) are accessed via the controller indirection in `ui.ts`.

- [ ] **Step 2: Keep a reference to the torus knot for the rotation loop**

Edit `src/main.ts`. Right after the `addSceneObjects(scene);` call, add:

```ts
// Keep a handle on the knot so the tick loop can rotate it.
const sceneObjects = addSceneObjects(scene);
const knot = sceneObjects.knot;
```

(`addSceneObjects` already returns the knot object; if the return type changes, see step 2a below.)

- [ ] **Step 2a: If `addSceneObjects` doesn't return `knot` by name, expose it**

Open `src/scene-objects.ts`. The current return type is:

```ts
{ axes, grid, cube, knot, ground }
```

It already returns `knot`. Verify this in the file. If the function is later refactored, ensure `knot` is in the returned object. If it's not, add `return { axes, grid, cube, knot, ground };` as the final statement of `addSceneObjects`.

- [ ] **Step 3: Extend the controller with the new methods**

Edit `src/main.ts`. Replace the existing `controller` block with:

```ts
// Adapter that the UI module talks to.
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
```

- [ ] **Step 4: Add a `cameraFitToVolume` helper**

Insert this function just above the `// ---- UI wiring ----` comment:

```ts
// ---- Camera fit-to-volume ----------------------------------------------
function cameraFitToVolume(volume: VolumeData): void {
  const [w, h, d] = volume.dimensions;
  const [sx, sy, sz] = volume.spacing;
  const ex = sx * w;
  const ey = sy * h;
  const ez = sz * d;
  const maxExtent = Math.max(ex, ey, ez);
  const fovRad = (camera.fov * Math.PI) / 180;
  const dist = (maxExtent * 0.6) / Math.tan(fovRad * 0.5);
  camera.position.set(dist, dist * 0.75, dist);
  camera.near = Math.max(0.001, maxExtent * 0.001);
  camera.far = maxExtent * 20;
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
```

- [ ] **Step 5: Update the `setVolume` controller method to call the fit + status**

Edit the `setVolume` controller method (already updated in Step 3 above). Replace its body so the full method reads:

```ts
  async setVolume(files: File[]): Promise<VolumeData> {
    const data: VolumeData = await loadDicomVolume(files);
    await vol.setVolume(data);
    lastVolume = data;
    cameraFitToVolume(data);
    ui.setVolumeInfo(formatVolumeInfo(data));
    ui.setResetEnabled(true);
    return data;
  }
```

(`lastVolume` is the closure variable from Step 6a — declared above the `controller` const.)

- [ ] **Step 6: Wire `onResetView` and the FPS counter into the UI bindings**

Find the existing `bindUi` call in `src/main.ts`. Replace it with:

```ts
// ---- UI wiring -----------------------------------------------------------
const ui = bindUi(controller, {
  onAutoRotateChange: (enabled) => {
    controls.autoRotate = enabled;
    controls.autoRotateSpeed = 1.0;
  },
  onResetView: () => {
    // The current volume, if any, is captured in the closure of the
    // controller; we re-fit using the live mesh scale. If no volume
    // is loaded the button is disabled so this path is unreachable.
    const v = (vol as unknown as { volume?: { dimensions: [number, number, number]; spacing: [number, number, number] } }).volume;
    if (v) cameraFitToVolume(v as VolumeData);
  }
});

// Push initial status
ui.setStatus('Scene ready. Drop DICOM files to load a volume.');
```

> If the `vol.volume` field is not public, alternative: store the most recent `VolumeData` in a closure variable updated inside the `setVolume` controller method, and have `onResetView` close over that.

- [ ] **Step 6a (alternative, recommended): closure variable**

If the previous approach with `(vol as unknown as ...)` feels brittle, prefer the closure approach. Edit `src/main.ts` to add a let-binding above the `controller`:

```ts
let lastVolume: VolumeData | null = null;
```

Update the `setVolume` method (from Step 5) to set `lastVolume = data;` before calling `cameraFitToVolume`. Then change `onResetView` to:

```ts
  onResetView: () => {
    if (lastVolume) cameraFitToVolume(lastVolume);
  },
```

- [ ] **Step 7: Add the FPS counter + knot rotation to the tick loop**

Edit the `tick` function. Replace it with:

```ts
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
```

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
cd /Users/fotogrammer/Projects/cbct-viewer-demo
git add src/main.ts src/scene-objects.ts
git commit -m "feat(main): wire new controller + camera fit + knot rotation + FPS

- controller exposes setWindowLevel/setPreset to the UI
- cameraFitToVolume() recomputes the camera distance from the
  volume's mm extent; called on setVolume and on Reset view
- torus knot rotates ~6°/s independent of camera auto-rotate
- FPS counter samples once per second

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Manual smoke test (Playwright)

**Files:** (no edits — verification)

**Step 0: cd and start the dev server**

```bash
cd /Users/fotogrammer/Projects/cbct-viewer-demo
```

- [ ] **Step 1: Start the Vite dev server in the background**

```bash
npm run dev > /tmp/cbct-dev.log 2>&1 &
```

Wait until you see `Local:   http://localhost:5173/` (or similar port) in the log, then continue. If a different port is used, substitute it in the next steps.

- [ ] **Step 2: Copy the DICOM sample into the demo's `public/` so it's servable**

```bash
ls /Users/fotogrammer/Projects/cbct-viewer-demo/public
```

If the public directory is empty, copy the 5 DICOM files (10001.dcm..10005.dcm) that live in `playground2/local-cbct-viewer/test-data/` or similar location the user has been using. (The engineer should locate the actual test files used in Phase 1 of this project; they were 800×800×5 with 0.2mm spacing.)

If the DICOM samples are not available, fetch any 5-slice DICOM axial series. This step is environment-specific and the engineer should use whatever sample they have.

- [ ] **Step 3: Drive the page with Playwright (or manual click-through)**

The verification checklist (each is one click/action, verify the visible state):

1. ✅ Page loads. Sidebar shows: drop zone, status row ("— · — FPS"), 4 group cards (Transfer function / Render / Camera / Scene), footer text.
2. ✅ BONE chip is highlighted (active class). WL = 400, WW = 1500.
3. ✅ Click SOFT chip. The chip becomes active; BONE loses `active`. WL/WW snap to 50 / 400. The volume's appearance should shift (if a volume is loaded — see step 4).
4. ✅ Click LUNG chip. WL/WW snap to -600 / 1500.
5. ✅ Drag WL slider. The `wlVal` value updates immediately. The status row stays unchanged.
6. ✅ Drag WW slider. The `wwVal` value updates.
7. ✅ Drag Step-size slider. The `stepSizeVal` value updates. (No visual change expected without a volume.)
8. ✅ Drag ERT slider. The `ertVal` value updates.
9. ✅ Click "Reset view". The button should be disabled (greyed out) because no volume is loaded yet.
10. ✅ Check the auto-rotate checkbox. Nothing visible should change (no volume loaded).
11. ✅ Click the drop zone. The system file picker opens.
12. ✅ Drop or select 5 DICOM files. The status row updates to e.g. `800×800×5 · 160×160×1 mm · 60 FPS`. The status div below shows `Loaded 5 DICOM slice(s).`
13. ✅ The 3D viewport shows the volume scaled to the mm extent. Camera is positioned to fit.
14. ✅ The Reset view button becomes enabled. Click it — the camera snaps back to the fit position.
15. ✅ The torus knot rotates slowly (independent of camera auto-rotate).
16. ✅ Toggle auto-rotate — the camera orbits. The knot continues to rotate on top of that.
17. ✅ FPS text in the status row updates at most once per second.
18. ✅ Open the browser DevTools console. There should be **zero errors**. Warnings (e.g. favicon 404) are OK.

- [ ] **Step 4: Stop the dev server**

```bash
pkill -f "vite" || true
```

- [ ] **Step 5: Take a single screenshot for the PR**

Use Playwright `browser_take_screenshot` to save one screenshot showing the sidebar (with all four groups) and the 3D viewport (volume + rotating knot + ground plane). Save it to `docs/2026-06-02-demo-polish-screenshot.png`. Reference this image in the eventual PR description.

---

### Task 11: Final typecheck and full test sweep across both repos

**Files:** (no edits)

- [ ] **Step 1: VolGL — full test + typecheck + build**

```bash
cd /Users/fotogrammer/Projects/VolGL
npm test
npm run typecheck
npm run build
```

Expected: all three green.

- [ ] **Step 2: cbct-viewer-demo — typecheck**

```bash
cd /Users/fotogrammer/Projects/cbct-viewer-demo
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Update the cbct-viewer-demo README with the new feature list**

Edit `README.md`. Add a short Features section after the "How to run" block:

```markdown
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
```

- [ ] **Step 4: Commit the README update**

```bash
cd /Users/fotogrammer/Projects/cbct-viewer-demo
git add README.md
git commit -m "docs(readme): list the new transfer-function / camera features

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Sanity-check the working tree**

```bash
cd /Users/fotogrammer/Projects/cbct-viewer-demo
git status
```

Expected: clean working tree.

```bash
cd /Users/fotogrammer/Projects/VolGL
git status
```

Expected: clean working tree.

If either shows uncommitted changes, address them before declaring done.

---

## Plan complete

Estimated total: ~12 commits across two repos:

**VolGL (4 commits):**
1. `feat(transfer-function): add LUNG_PRESET for CT lung window`
2. `feat(presets): expose LUNG_PRESET via CBCT_PRESETS.lung`
3. `feat(transfer-function): add setWindowLevel(level, width) to TransferFunction1D`
4. `feat(renderer): expose setWindowLevel + setPreset on VolumeRenderer`

**cbct-viewer-demo (7 commits + 1 README):**
1. `refactor(ui): widen VolumeController + UiBindings for new features`
2. `feat(ui): redesign sidebar with grouped cards + 3 preset chips`
3. `refactor(ui): drive 3 preset chips, WL/WW, reset, vol-info, fps`
4. `feat(main): wire new controller + camera fit + knot rotation + FPS`
5. `docs(readme): list the new transfer-function / camera features`

Plus 1 screenshot file under `docs/`.

Each commit is independently buildable and the demo can be run after commit 4 of the cbct-viewer-demo work.
