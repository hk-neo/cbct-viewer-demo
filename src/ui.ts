import {
  type PresetName,
  type TransferFunction,
  type VolumeData
} from '@volgl/renderer';

export interface VolumeController {
  setStepSize(size: number): void;
  setEarlyRayTermination(t: number): void;
  setTransferFunction(tf: TransferFunction): void;
  setWindowLevel(level: number, width: number): void;
  setPreset(name: PresetName): void;
  setVolume(files: File[]): Promise<VolumeData>;
}

export interface UiHandlers {
  onAutoRotateChange(enabled: boolean): void;
  onResetView(): void;
  onVolumeLoaded(volume: VolumeData): void;
}

export interface UiBindings {
  setStatus(text: string, kind?: 'info' | 'error' | 'progress'): void;
  setVolumeInfo(text: string): void;
  setFps(text: string): void;
  setResetEnabled(enabled: boolean): void;
}

/**
 * Wires up the side panel: drop zone, file picker, status line,
 * step-size / early-ray-termination sliders, preset toggle, and
 * auto-rotate checkbox.
 */
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
      const data = await volume.setVolume(files);
      setStatus(`Loaded ${files.length} DICOM slice(s).`, 'info');
      setResetEnabled(true);
      handlers.onVolumeLoaded(data);
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
  // Per-preset WL/WW defaults. Must mirror CBCT_PRESET_DEFAULTS in the library.
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
