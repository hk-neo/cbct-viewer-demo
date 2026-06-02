import { CBCT_PRESETS, type TransferFunction } from '@volgl/renderer';

export interface VolumeController {
  setStepSize(size: number): void;
  setEarlyRayTermination(t: number): void;
  setTransferFunction(tf: TransferFunction): void;
  setVolume(files: File[]): Promise<void>;
}

export interface UiHandlers {
  onAutoRotateChange(enabled: boolean): void;
}

export interface UiBindings {
  setStatus(text: string, kind?: 'info' | 'error' | 'progress'): void;
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
  const stepSize = document.getElementById('stepSize') as HTMLInputElement;
  const stepSizeVal = document.getElementById('stepSizeVal') as HTMLSpanElement;
  const ert = document.getElementById('ert') as HTMLInputElement;
  const ertVal = document.getElementById('ertVal') as HTMLSpanElement;
  const presetBtn = document.getElementById('presetBtn') as HTMLButtonElement;
  const autoRotate = document.getElementById('autoRotate') as HTMLInputElement;

  function setStatus(text: string, kind: 'info' | 'error' | 'progress' = 'info'): void {
    status.textContent = text;
    status.classList.remove('error', 'progress');
    if (kind === 'error') status.classList.add('error');
    if (kind === 'progress') status.classList.add('progress');
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

  // The user can drop anywhere on the document — not just on the drop zone —
  // so that dropping on the canvas still loads the volume.
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) {
      await loadFiles(files);
    }
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to load volume: ${msg}`, 'error');
    }
  }

  // ---- Sliders -----------------------------------------------------------
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

  // ---- Preset toggle -----------------------------------------------------
  let preset: 'bone' | 'softTissue' = 'bone';
  presetBtn.addEventListener('click', () => {
    preset = preset === 'bone' ? 'softTissue' : 'bone';
    volume.setTransferFunction(CBCT_PRESETS[preset]);
    presetBtn.textContent = `Preset: ${preset}`;
  });

  // ---- Auto-rotate -------------------------------------------------------
  autoRotate.addEventListener('change', () => {
    handlers.onAutoRotateChange(autoRotate.checked);
  });

  return { setStatus };
}
